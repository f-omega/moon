import wellknown from 'wellknown'
import randomstring from 'randomstring'
import nunjucks, { Template, Loader, FileSystemLoader } from 'nunjucks';
import path from 'node:path';
import fs from 'node:fs/promises';
import frontmatter from 'gray-matter';
import express, { type Express } from 'express';
import { Request, ParamsDictionary, Response, NextFunction } from 'express-serve-static-core';
import N3 from 'n3';
import { ParsedQs } from 'qs';
import showdown from 'showdown';
import chokidar from 'chokidar'

import * as common from '../src/common/util';
import Cache from '../src/common/cache'
import { MOON_CONTENT, MOON_DATASET, MOON_SERVICE_HOST, MOON_SERVICE_PORT } from './service';
import { openUrl, readGraphFromStream } from './util';
import { NodeShape, pathToSparql, PropertyShape } from '../src/common/shacl';
import { fetchSparql, SparqlResult, isSelectResult } from './sparql';

interface ContentServiceOptions {
    port?: number
    host?: string
    contentDirs: N3.NamedNode[]
    datasets: N3.Store
}

interface ContentMeta {
    urlpattern: RegExp,
    target: string,
    content?: Template
    postprocess: (x: string) => string
}

function urlToFileName(file: URL) {
    let fname = file.pathname
    if (file.protocol == 'file:') {
        fname = fname.substring(1)
    }
    return fname
}

class IriContext implements ProxyHandler<IriContext> {
    service: ContentService
    iri: string
    _terms: { [id: string]: any }

    constructor(svc: ContentService, iri: string) {
        this.service = svc
        this.iri = iri
        this._terms = {}
    }

    get(me: IriContext, prop: string, receiver: any) {
        return this._terms[prop]
    }

    static async parse(svc: ContentService, value: N3.Term, groups: { [key: string]: string },
        depth?: number, p?: PropertyShape) {
        const extraShapes = []
        if (p !== undefined) {
            const node = p.getNode()
            if (node !== null)
                extraShapes.push(node)
        }
        if (value.termType == 'NamedNode') {
            return await IriContext.create(svc, value.value, groups, depth, extraShapes)
        } else if (value.termType == 'Literal') {
            return common.interpretLiteral(value.value, value.datatype)
        } else if (value.termType == 'BlankNode') {
            return {}
        }
    }

    static async create(svc: ContentService, iri: string, groups: { [key: string]: string },
        depth?: number, extraShapes?: NodeShape[]) {
        if (depth === undefined)
            depth = 0;
        else if (depth > 1) return;
        const shapeIris = await svc.cache.lookupShapesForNode(svc, N3.DataFactory.namedNode(iri))
        const shapes = [...(extraShapes || []),
        ...(await Promise.all(shapeIris.map((s) => svc.cache.loadShape(svc, s))))]

        const allProps = shapes.flatMap((s) => s.properties())
        const props: { [id: string]: PropertyShape } = {}
        for (const p of allProps) {
            props[p.shape.value] = p
        }

        const uniqueProps = Object.values(props).filter((p) => p.getJsonProperty() !== null);
        const projection = uniqueProps.map((p, i) => `<urn:this> <urn:arg_${i}> ?r_${i}.`).join("\n");
        const conditions = uniqueProps.flatMap((p, i) => {
            if (p.path !== undefined) {
                return [`{ <${iri}> ${pathToSparql(p.path)} ?r_${i} } `]
            } else {
                return []
            }
        }).join(" UNION ");

        console.log("SPARQL", `CONSTRUCT { ${projection} } WHERE { ${conditions} }`)

        const g = await svc.runSparql(`CONSTRUCT { ${projection} } WHERE { ${conditions} }`, true)

        const obj: any = { _id: iri, params: groups }
        let i: number = 0
        for (const p of uniqueProps) {
            if (p.shape === undefined) {
                i += 1
                continue;
            } else {
                const [min, max] = p.getCountLimits()
                if (max === null || (max > 0 || max === null)) {
                    const values: N3.Term[] = common.getProperty(g, N3.DataFactory.namedNode('urn:this'), N3.DataFactory.namedNode(`urn:arg_${i}`), { multiple: true })
                    if (p.getJsonProperty() == 'zones') {
                        console.log("ZONES", values)
                    }
                    obj[p.getJsonProperty() || ""] = await Promise.all(values.map((v) => IriContext.parse(svc, v, groups, (depth || 0) + 1, p)))
                    if (p.getJsonProperty() == 'zones') {
                        console.log(obj['zones'])
                    }
                } else if (max == 1) {
                    const value: N3.Term = common.getProperty(g, N3.DataFactory.namedNode('urn:this'), p.shape)
                    obj[p.getJsonProperty() || ""] = await IriContext.parse(svc, value, groups, (depth || 0) + 1, p)
                }
                i += 1;
            }
        }

        return obj
    }
}

export default class ContentService {
    options: ContentServiceOptions
    app: Express
    content: ContentMeta[]
    cache: Cache
    datasetSpec: common.DatasetSpec
    dataset: string

    constructor(options: ContentServiceOptions) {
        this.options = options
        this.app = express()

        this.content = []

        this.datasetSpec = common.parseVoidDatasets(options.datasets)[0]
        this.cache = new Cache(this.datasetSpec.shapesGraph)
        this.dataset = this.datasetSpec.iri

        this.app.use((req, res, next) => this.serve(req, res, next))
    }

    async runSparql<C extends boolean = false>(s: string, construct?: C): Promise<C extends true ? N3.Store : SparqlResult> {
        return await fetchSparql(s, { endpoint: this.datasetSpec.sparqlEndpoint, graph: "", construct: construct || false })
    }

    async updateSparql(s: string): Promise<void> {
    }

    private async serve(
        req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>,
        res: Response<any, Record<string, any>, number>, next: NextFunction
    ): Promise<void> {
        for (const c of this.content) {
            const results = c.urlpattern.exec(req.path)
            if (results !== null) {
                console.log("results", results)
                console.log("WOULD RUN", c.content)

                let target = c.target
                const groups = results.groups;
                const params: { [id: string]: string } = {}
                if (groups !== undefined) {
                    for (const key of Object.keys(groups)) {
                        target = target.replace(`{${key}}`, groups[key])
                        params[key] = groups[key]
                    }
                }

                const context = await IriContext.create(this, target, groups || {})
                context.params = params;
                if (c.content === undefined)
                    res.status(404).json({ message: 'no template' })
                else {
                    c.content.render(context, (err, t) => {
                        if ( err ) {
                            res.status(500).send(err).end()
                        } else if ( t ) {
                            let html = c.postprocess(t)
                            res.status(200).send(html).end()
                        }
                    })
                }
                return
            }
        }

        res.status(404).json({ message: 'not found' })
    }

    static async fromServiceDescription(graph: N3.Store, description: N3.Term, path?: string): Promise<ContentService> {
        const port: number = common.getProperty(graph, description, MOON_SERVICE_PORT, { literal: true, expectedType: common.XSD_INTEGER }) || undefined
        const host = common.getProperty(graph, description, MOON_SERVICE_HOST, { literal: true, expectedType: common.XSD_STRING })
        const contentDirs = common.getProperty(graph, description, MOON_CONTENT, { relativeTo: path, multiple: true }) || []

        const datasetDescriptions = common.getProperty(graph, description, MOON_DATASET, { relativeTo: path, multiple: true }) || undefined;

        const datasets = new N3.Store();

        await Promise.all((datasetDescriptions || []).map(async (d: N3.NamedNode) => {
            let stream = await openUrl(d.value);
            await readGraphFromStream(datasets, stream)
        }))

        return new ContentService({ port, host, contentDirs, datasets })
    }

    get port() {
        return this.options.port || 3080
    }

    private async _loadFile(file: URL, env?: nunjucks.Environment): Promise<ContentMeta | null> {
        const ext = path.extname(file.pathname)
        const pathname = urlToFileName(file)
        console.log("LOAD", pathname)
        const fileData = await fs.readFile(pathname)
        const { data, content } = frontmatter(fileData)

        // Content should be sent to a renderer. data is used for path discovery
        let meta: ContentMeta = data as any
        let urlpattern = data.urlpattern
        if (typeof urlpattern != 'string' && !(urlpattern instanceof RegExp)) return null;
        if (typeof urlpattern == 'string' && !urlpattern.endsWith('$'))
            urlpattern += "$"
        meta.urlpattern = new RegExp(urlpattern)
        meta.content = new Template(content, env)
        meta.postprocess = (x: string) => x
        if (ext == '.md' || ext == '.markdown') {
            const conv = new showdown.Converter({ tables: true })
            meta.postprocess = (s) => {
                const html = conv.makeHtml(s)
                return `${data.head || ""}${html}`
            }
        }
        return meta
    }

    private _setupEnvironment(env: nunjucks.Environment) {
        env.addExtension("geojson", new GeoJSONExtension())
        env.addExtension("sparql", new SparqlExtension(this.datasetSpec.sparqlEndpoint))
        env.addFilter("wktToGeoJSON", function (txt: string) {
            return JSON.stringify(wellknown.parse(txt))
        })
        env.addFilter("sort", function (xs: any[], keys: string | ((x: any) => any)) {
            let key: (x: any) => any
            if (typeof keys == 'string') {
                key = eval(keys)
            } else {
                key = keys
            }
            const c = [...xs]
            c.sort((a, b) => {
                const akey = key(a)
                const bkey = key(b)
                if (akey == bkey) return 0
                else if (akey < bkey) return -1
                else return 1;
            })
            return c
        })
    }

    private async _loadAllContent() {
        const me = this
        let content: ContentMeta[] = []
        for (const path of this.options.contentDirs) {
            let pathUrl = new URL(path.value)
            let files = await fs.readdir(new URL(path.value))
            const templateLoader = new FileSystemLoader([urlToFileName(pathUrl)])
            const env = new nunjucks.Environment(templateLoader)
            this._setupEnvironment(env)
            const frontmatters = (await Promise.all(files.filter((f) => !f.startsWith('.') && !f.startsWith('_') && !f.endsWith('~'))
                .map((f) => me._loadFile(new URL(f, path.value + '/'), env))))
                .flatMap((m) => m === null ? [] : [m])
            content = [...content, ...frontmatters]
        }
        return content
    }

    async start() {
        this.content = await this._loadAllContent()

        const me = this;
        chokidar.watch(this.options.contentDirs.map((path) => urlToFileName(new URL(path.value))))
            .on('all', () => {
                console.log("Reloading content")
                me._loadAllContent().then((c) => { me.content = c })
            })

        this.app.listen(this.port, () => {
            console.log(`Started ContentService on port ${this.port}`)
        })
    }
}

class SparqlExtension implements nunjucks.Extension {
    tags: string[]
    endpoint: common.EndpointSpec

    constructor(endpoint: common.EndpointSpec) {
        this.tags = ['sparql']
        this.endpoint = endpoint
    }

    parse(parser: any, nodes: any, lexer: any) {
        const tok = parser.nextToken();
        const tag = parser.peekToken();
        if (parser.skipSymbol('as')) {
            const variable = parser.nextToken();
            console.log("GOT VARIABLE", variable)
            if (variable.type != lexer.TOKEN_SYMBOL) {
                parser.fail("Expected variable name in sparql", variable.lineno, variable.colno)
            } else {
                parser.advanceAfterBlockEnd(tok.value);
                // parse the body and possibly the error block, which is optional
                var body = parser.parseUntilBlocks('endsparql');
                console.log("GOT BODY", body)

                parser.advanceAfterBlockEnd();

                console.log("RETURN ASYNC")
                return new nodes.CallExtensionAsync(this, 'run', undefined, [body])
            }
        } else {
            parser.fail("Expecting as after sparql", tag.lineno, tag.colno);
        }
        console.log("FALLTHRU")
    }

    async run(context: any, body: any, callback: any) {
        const varname = "uses";
        const sparql = body();
        const results = await fetchSparql(sparql, { endpoint: this.endpoint, graph: "", construct: false })

        if (isSelectResult(results)) {
            context.ctx[varname] = results.results.bindings.map((b) => {
                const o: {[k: string]: any} = {};
                results.head.vars.map((v) => {
                    if ( b[v] )
                        // @ts-ignore
                        o[v] = b[v].value;
                    else
                        o[v] = null;
                })
                return o;
            })
            callback(null, "")
        } else {
            callback("Invalid SPARQL", null)
        }
    }
}


class GeoJSONExtension implements nunjucks.Extension {
    tags: string[]
    constructor() {
        this.tags = ['map']
    }

    parse(parser: any, nodes: any, lexer: any) {
        const tok = parser.nextToken()
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);

        // parse the body and possibly the error block, which is optional
        var body = parser.parseUntilBlocks('endmap')

        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', args, [body])
    }

    run(context: any, body: any) {
        const json = body()
        const mapid = randomstring.generate()
        return new nunjucks.runtime.SafeString(`<div><div id="${mapid}" style="width: 500px; height: 300px"></div>
      <script type="text/javascript">
      const geojsondata = ${json};
      (() => {
      const myMap = L.map('${mapid}').setView([51.505, -0.09], 13)

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(myMap);

        const geojson = L.geoJSON(geojsondata).addTo(myMap)
        myMap.fitBounds(geojson.getBounds())
      })()

      </script></div>`)
    }
}
