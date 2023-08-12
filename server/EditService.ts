import express, { type Express } from 'express';
import httpProxy from 'http-proxy';
import vm from 'node:vm';
import N3 from 'n3';
import fs from 'node:fs';
import randomstring from 'randomstring';
import { VM } from 'vm2';
import {
  choosePort,
  createCompiler,
  prepareUrls
} from 'react-dev-utils/WebpackDevServerUtils.js';

import * as common from '../src/common/util';
import { fetchSparql, isSelectResult, VarBindingResult } from './sparql'

import { MOON_DATASET, MOON_SERVICE_PORT, MOON_SERVICE_HOST, MOON_JAVASCRIPT_LIBRARY, MOON_APPLICABLE_TO, MOON_SERVER } from './service';
// import { getProperty } from './util';
import { openUrl, readGraphFromStream } from './util'

export interface ServerScriptContext {
  sparql: {
    update(updateQuery: string): Promise<void>,
    select(selectQuery: string): Promise<VarBindingResult<string>>,
    construct(constructQuery: string): Promise<N3.Store>,
    endpoint: string,
    updateEndpoint?: string
  }
}

interface ActionReq {
  dataset: string,
  action: string,
  focus: string,
  values: any[]
}

interface EditServiceOptions {
  port?: number,
  host?: string,
  development?: boolean,
  datasetDescriptions?: string[],
  publicPath?: string
}

interface ActionEvent {
  target: ActionTarget
}

interface ActionTarget {
  values: any[]
}

interface GraphAdapter {
  addTriple(t: N3.Triple): void
  removeTriple(t: N3.Triple): void
  getStore(): N3.Store
}

process.on('uncaughtException', (err) => {
    console.error('Asynchronous error caught.', err);
});

export default class EditService {
  app: Express
  options: EditServiceOptions
  datasets: N3.Store
  parsedDatasets: { [iri: string]: common.DatasetSpec }
  proxiedEndpoints: { [uri: string]: true }
  serverActions: {[iriAndDataset: string]: string}

  loadedLibraries: {[dataset: string]: VM}

  constructor(options: EditServiceOptions, datasets?: N3.Store) {
    this.app = express()
    this.options = options
    this.datasets = datasets || new N3.Store();

    this.loadedLibraries = {}
    this.serverActions = {}
    this.parsedDatasets = {}
    this.proxiedEndpoints = {}
    const me = this
    common.parseVoidDatasets(this.datasets).map((d) => { me.parsedDatasets[d.iri] = d })

      if (process.env.NODE_ENV == 'production') {
        this.app.use(express.static(process.env.MOON_STATIC_ROOT || "/moon/www"))
     } else {
         const configFactory = require('../config/webpack.config.js')
         const paths = require('../config/paths.js');

      const config = configFactory('development')
      const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
      const appName = require(paths.appPackageJson).name;
      const useYarn = fs.existsSync(paths.yarnLockFile);

      const useTypeScript = fs.existsSync(paths.appTsConfig);
      const urls = prepareUrls(
        protocol,
        this.options.host || "0.0.0.0",
        this.options.port || 3000,

        // @ts-ignore
        paths.publicUrlOrPath.slice(0, -1)
      );

         const webpack = require('webpack')
      // Create a webpack compilerr that is configured with custom messages.
      // @ts-ignore
      const compiler = createCompiler({
        appName,
        config,
        urls,
        useYarn,
        useTypeScript,

        // @ts-ignore
        webpack,
      });

      // Enable this only in development. In production, serve static files
        //Enable "webpack-dev-middleware"
         const webpackDevMiddleware = require('webpack-dev-middleware')
         this.app.use(webpackDevMiddleware(compiler, {
             publicPath: paths.publicUrlOrPath
         }));

         const webpackHotMiddleware = require('webpack-hot-middleware')
         //Enable "webpack-hot-middleware"
         // @ts-ignore
         this.app.use(webpackHotMiddleware(compiler));
     }
      // If any services have the proxy enabled, start it now
      for ( const d of Object.values(this.parsedDatasets) ) {
        if ( d.sparqlEndpoint.needsProxy ) {
          this.proxiedEndpoints[d.sparqlEndpoint.endpoint] = true
        }
        if ( d.updateEndpoint && d.updateEndpoint.needsProxy ) {
          this.proxiedEndpoints[d.updateEndpoint.endpoint] = true
        }
      }
      if ( Object.keys(this.proxiedEndpoints).length > 0 ) {
        const proxy = httpProxy.createProxyServer({prependPath: true, ignorePath: true})
        proxy.on("proxyReq", (e) => {
          console.log("ON REQ", e.path)
        })
        this.app.post('/sparql-proxy', (req, res) => {
          const endpoint = req.query.endpoint

          console.log("GOT ENDPOINT", endpoint)
          if ( typeof endpoint !== 'string' ) {
            return res.status(400).json({message: 'Must provide only one endpoint'})
          }

          console.log("QUERY ENDPOINT", endpoint, this.proxiedEndpoints, endpoint in this.proxiedEndpoints)

          // Lookup the endpoint
          if ( endpoint in this.proxiedEndpoints ) {
            console.log("PROXYING")
            const query = {...req.query}
            delete query.endpoint
            proxy.web(req, res, { target: endpoint, buffer: req.body })
          } else {
            res.status(404).json({message: `${endpoint} is not a proxied endpoint`})
          }
        })
      }

    this.app.use(express.static(this.options.publicPath || './public'));
    this.app.post('/.moon/action', express.json(), (req, rsp, next) => {
      try {
        next()
      } catch (e) {
        rsp.status(500).json({message: `${e}`})
      }
    }, (req, rsp) => {
      return this.handleAction(req, rsp)
    })
    this.app.get('/.well-known/void', (req, rsp) => {
      let accept = req.headers['Accept']
      if ( Array.isArray(accept) )
        accept = accept[0]
      if ( accept === undefined )
        accept = 'text/turtle'

      rsp.set('Content-type', accept)
      const writer = new N3.Writer(rsp, {format: accept});
      for ( const q of this.datasets ) {
        writer.addQuad(q)
      }
      writer.end()
    })
  }

  async handleAction(req: express.Request, rsp: express.Response) {
    console.log(req.body)
    const body: ActionReq = req.body

    // Find the sparql endpoint associated with this dataset
    console.log("LOOKUP", body.dataset, this.parsedDatasets)
    if ( !(body.dataset in this.parsedDatasets) ) {
      return rsp.status(400)
    }

    const dataset = this.parsedDatasets[body.dataset]
    const functionKey = `${dataset.iri} ${body.action}`
    if ( !(functionKey in this.serverActions)  ) {
      console.log("QUERY for action", dataset.sparqlEndpoint)
      try {
        let serverScript: string | null = null
        const ACTION_PREFIX = "urn:com:f-omega:moon:action:"
        if ( body.action.startsWith(ACTION_PREFIX) ) {
          const hash = body.action.substring(ACTION_PREFIX.length)
          const r = await fetchSparql(`PREFIX moon: <https://ld.f-omega.com/moon/>
PREFIX fn: <http://www.dotnetrdf.org/leviathan#>
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?script WHERE {
        GRAPH ?g {
            { ?shape a sh:NodeShape } UNION { ?shape a sh:PropertyShape }
            ?shape moon:action ?action.
            FILTER(ISBLANK(?action)).
            ?action moon:serverScript ?script.
            FILTER(fn:sha256hash(?script) = "${hash}").
        }
} LIMIT 1`, { endpoint: dataset.sparqlEndpoint, graph: "" })
          if ( isSelectResult(r) && r.results.bindings.length > 0 && r.results.bindings[0].script?.type == 'literal' ) {
            serverScript = r.results.bindings[0].script.value
          }
        } else {
          const action = await fetchSparql(`DESCRIBE <${body.action}>`, { construct: true, endpoint: dataset.sparqlEndpoint, graph: "" })
          serverScript = common.getProperty(action, N3.DataFactory.namedNode(body.action), common.MOON_SERVER_SCRIPT, {literal: true, expectedType: common.XSD_STRING})
        }

        console.log("SCRIPT IS", serverScript)
        if ( serverScript === null ) {
          return rsp.status(400).json({message: `Script ${body.action} not found`})
        }

        let ctx = this._getScriptContext(body.dataset)
        let fnName = `fn_${randomstring.generate()}`
        // @ts-ignore
        this.serverActions[functionKey] = fnName
        ctx.run(`const ${fnName} = async (e, focus) => {
          const fn = async () => { ${serverScript} }
          try {
            return { success: true, result: await fn() }
          } catch (e) {
            console.error("CAUGHT", e)
            return { success: false, error: e }
          }
          }`)
      } catch (e) {
        console.error(e)
        return rsp.status(500)
      }
    }

    try {
      console.log("RUN FUNCTION", this.serverActions[functionKey])
      const fnName = this.serverActions[functionKey] // Pass .({target: {values: body.values}}, graphAdapter)
      const ctx = this._getScriptContext(body.dataset)
      const fn = ctx.run(fnName)
      const resultp = fn({ args: body.values }, body.focus)
      console.log("GOT RESULT", resultp)
      const result = await resultp
      if ( result.success ) {
        if ( result.result === undefined ) {
          rsp.status(200).json({})
        } else {
          rsp.status(200).json(result.result)
        }
      } else {
        console.error(result.error)
        rsp.status(500).json(result.error)
      }
    } catch (e) {
      rsp.status(500).json({message: `${e}`})
    }
  }

  static async fromServiceDescription(graph: N3.Store, description: N3.Term, path?: string): Promise<EditService> {
    const port: number = common.getProperty(graph, description, MOON_SERVICE_PORT, {literal: true, expectedType: common.XSD_INTEGER}) || undefined
    const host = common.getProperty(graph, description, MOON_SERVICE_HOST, {literal: true, expectedType: common.XSD_STRING}) || undefined
    const datasetDescriptions = common.getProperty(graph, description, MOON_DATASET, {relativeTo: path, multiple: true}) || undefined;

    const datasets = new N3.Store();

    await Promise.all((datasetDescriptions || []).map(async (d: N3.NamedNode) => {
      let stream = await openUrl(d.value);
      await readGraphFromStream(datasets, stream)
    }))

    return new EditService({ development: true, port, host, datasetDescriptions}, datasets)
  }

  get port() {
    return this.options.port || 3000
  }

  private async _loadLibrary(dataset: string) {
    // Load or reload the libraries from the sparql code base
    const datasetSpec = this.parsedDatasets[dataset]
    if ( datasetSpec === undefined ) throw new TypeError(`Could not find dataset ${dataset}`)

    const library = await fetchSparql(`PREFIX moon: <https://ld.f-omega.com/moon/>
      DESCRIBE ?library WHERE { GRAPH ?g { ?library a moon:JavascriptLibrary; moon:applicableTo moon:Server. } }`,
      { endpoint: datasetSpec.sparqlEndpoint, graph: "", construct: true})
    for ( const l of library.getQuads(null, common.RDF_TYPE, MOON_JAVASCRIPT_LIBRARY) ) {
      if ( library.getQuads(l.subject, MOON_APPLICABLE_TO, MOON_SERVER).length == 0 ) continue;

      const script = common.getProperty(library, l.subject, common.MOON_SERVER_SCRIPT,
        {literal: true, expectedType: common.XSD_STRING})
      if ( script !== null ) {
        this._loadScript(library.subject, dataset, script)
      }

      const scriptHref = common.getProperty(library, l.subject, common.MOON_SERVER_SCRIPT)
      if ( scriptHref !== null && scriptHref.termType == 'NamedNode' ) {
        throw new TypeError("TODO: Handle script references")
      }
    }
  }

  private _makeContext(spec: common.DatasetSpec): ServerScriptContext {
    return {
      sparql: {
        endpoint: spec.sparqlEndpoint.endpoint,
        updateEndpoint: spec.updateEndpoint?.endpoint,
        async update(q) {
          if ( spec.updateEndpoint === undefined ) {
            throw new TypeError("This endopint cannot be updated")
          }
          await fetchSparql(q, {endpoint: spec.updateEndpoint, graph: "", update: true})
        },

        async construct(q) {
          return await fetchSparql(q, {endpoint: spec.sparqlEndpoint, graph: "", construct: true})
        },

        async select(q) {
          return await fetchSparql(q, {endpoint: spec.sparqlEndpoint, graph: "" })
        }
      }
    }
  }

  private _getScriptContext(dataset: string) {
    const spec = this.parsedDatasets[dataset]
    if ( spec === undefined ) {
      throw new TypeError(`Invalid dataset ${dataset}`)
    }
    let ctx = this.loadedLibraries[dataset]
    if ( ctx === undefined ) {
      const me = this
      ctx = this.loadedLibraries[dataset] = new VM({sandbox: this._makeContext(spec)}) // TODO
      ctx.setGlobal('fetch', fetch)
      ctx.setGlobal('AbortSignal', AbortSignal)
      ctx.setGlobal('console', console)
      ctx.setGlobal('require', (t: string) => me._require(t))
    }
    return ctx
  }

  private _require(m: string): any {
      if ( m == 'node:process' ) { return process; }
      else return null;
  }

  private _loadScript(library: N3.Term, dataset: string, script: string) {
    let ctx = this._getScriptContext(dataset)

    ctx.run(script)
  }

  async start() {
    for ( const d of Object.keys(this.parsedDatasets) ) {
      await this._loadLibrary(d)
    }
    this.app.listen(this.port, () => {
      console.log(`Started EditService on port ${this.port}`)
    })
  }
}
