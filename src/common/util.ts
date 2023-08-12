import N3 from 'n3'
// @ts-ignore
//if ( !globalThis?.window ) {
//  const { URL } = require('url')
//}

export const MOON_BASE = "https://ld.f-omega.com/moon"

export const RDF_TYPE = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
export const RDF_NIL = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#nil")
export const RDF_FIRST = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first")
export const RDF_REST = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#rest")
export const RDF_HTML = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML")
export const XSD_STRING = N3.DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#string")
export const MOON_JAVASCRIPT_EXPR = N3.DataFactory.namedNode(`${MOON_BASE}/JavascriptExpr`)
export const RDF_LANG_STRING = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString")
export const RDFS_LABEL = N3.DataFactory.namedNode("http://www.w3.org/2000/01/rdf-schema#label")
export const RDFS_CLASS = N3.DataFactory.namedNode("http://www.w3.org/2000/01/rdf-schema#Class")
export const DCTERMS_TITLE = N3.DataFactory.namedNode("http://purl.org/dc/terms/title")
export const DCTERMS_DESCRIPTION = N3.DataFactory.namedNode("http://purl.org/dc/terms/description")
export const XSD_INTEGER = N3.DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#integer")
export const XSD_BOOLEAN = N3.DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#boolean")
export const XSD_DATE = N3.DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#date")
export const XSD_DATE_TIME = N3.DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime")
export const XSD_ANYURI = N3.DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#anyURI")

export const SHACL_NODE_SHAPE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#NodeShape")
export const SHACL_PROPERTY_SHAPE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#PropertyShape")
export const SHACL_NODE_KIND = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#nodeKind")
export const SHACL_LITERAL = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#Literal")
export const SHACL_IRI = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#IRI")
export const SHACL_PROPERTY =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#property")
export const SHACL_NODE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#node")
export const SHACL_NODES = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#nodes")
export const SHACL_PATH = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#path")
export const SHACL_ASK = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#ask")
export const SHACL_SELECT = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#select")
export const SHACL_PREFIXES = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#prefixes")
export const SHACL_DECLARE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#declare")
export const SHACL_PREFIX = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#prefix")
export const SHACL_NAMESPACE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#namespace")
export const SHACL_THIS = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#this")
export const SHACL_IF = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#if")
export const SHACL_THEN = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#then")
export const SHACL_ELSE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#else")
export const SHACL_EXISTS = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#exists")
export const SHACL_FILTER_SHAPE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#filterShape")
export const SHACL_UNION = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#union")
export const SHACL_INTERSECTION = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#intersection")
export const SHACL_DISTINCT = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#distinct")
export const SHACL_COUNT = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#count")
export const SHACL_VALUES = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#values")
export const SHACL_ALTERNATIVE_PATH =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#alternativePath")
export const SHACL_INVERSE_PATH =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#inversePath")
export const SHACL_ZERO_OR_MORE_PATH =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#zeroOrMorePath")
export const SHACL_ONE_OR_MORE_PATH =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#oneOrMorePath")
export const SHACL_ZERO_OR_ONE_PATH =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#zeroOrOnePath")
export const SHACL_GROUP =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#group")
export const SHACL_ORDER =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#order")
export const SHACL_NAME =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#name")
export const SHACL_DESCRIPTION =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#description")
export const SHACL_IN =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#in")
export const SHACL_DATATYPE =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#datatype")
export const SHACL_OR = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#and")
export const SHACL_AND = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#or")
export const SHACL_XONE = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#xone")
export const SHACL_NOT = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#not")
export const SHACL_CLASS = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#class")
export const SHACL_IGNORED_PROPERTIES = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#ignoredProperties")
export const SHACL_CLOSED = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#closed")
export const SHACL_MIN_COUNT = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#minCount")
export const SHACL_MAX_COUNT = N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#maxCount")

export const DASH_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#editor")
export const DASH_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#viewer")
export const DASH_ROOT_CLASS = N3.DataFactory.namedNode("http://datashapes.org/dash#rootClass")
export const DASH_SINGLE_LINE = N3.DataFactory.namedNode("http://datashapes.org/dash#singleLine")

export const MOON_EDITABLE = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/editable")
export const MOON_JSON_PROPERTY = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/jsonProperty")
export const MOON_HIDE_TYPE = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/hideType")
export const MOON_HIDDEN = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/hidden")
export const MOON_LABEL = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/label")
export const MOON_AGGREGATE_VIEW = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/aggregateView")
export const MOON_LAZY = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/lazy")
export const MOON_CODE_LANGUAGE = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/codeLanguage")
export const MOON_PROXY =  N3.DataFactory.namedNode("https://ld.f-omega.com/moon/proxy")
export const MOON_SHAPES_GRAPH = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/shapesGraph")
export const MOON_APPLICABLE_SHAPE = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/ApplicableShape")
export const MOON_ACTION = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/action")
export const MOON_BUTTON_ACTION = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/ButtonAction")
export const MOON_TRIGGER = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/trigger")
export const MOON_SUGGESTED_SUBJECT =  N3.DataFactory.namedNode("https://ld.f-omega.com/moon/suggestedSubject")
export const MOON_ALLOW_CREATE =  N3.DataFactory.namedNode("https://ld.f-omega.com/moon/allowCreate")
export const MOON_CLICK_TRIGGER = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/onClick")
export const MOON_CHANGE_TRIGGER = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/onChange")
export const MOON_CLIENT_SCRIPT = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/clientScript")
export const MOON_SERVER_SCRIPT = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/serverScript")
export const MOON_CREDENTIALS = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/credentials")
export const MOON_BASIC_CREDENTIALS = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/BasicCredentials")
export const MOON_USERNAME = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/username")
export const MOON_PASSWORD = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/password")

export const RDF_TRUE = N3.DataFactory.literal("true", XSD_BOOLEAN)
export const RDF_FALSE = N3.DataFactory.literal("false", XSD_BOOLEAN)

export const VOID_DATASET = N3.DataFactory.namedNode("http://rdfs.org/ns/void#Dataset")
export const VOID_SPARQL_ENDPOINT = N3.DataFactory.namedNode("http://rdfs.org/ns/void#sparqlEndpoint");

export const SPARQL_DESCRIPTION_NAME = N3.DataFactory.namedNode("http://www.w3.org/ns/sparql-service-description#name")
export const SPARQL_DESCRIPTION_ENDPOINT = N3.DataFactory.namedNode("http://www.w3.org/ns/sparql-service-description#endpoint")
export const SPARQL_DESCRIPTION_SUPPORTED_LANGUAGE = N3.DataFactory.namedNode("http://www.w3.org/ns/sparql-service-description#supportedLanguage")
export const SPARQL_DESCRIPTION_SPARQL_10_QUERY = N3.DataFactory.namedNode("http://www.w3.org/ns/sparql-service-description#SPARQL10Query")
export const SPARQL_DESCRIPTION_SPARQL_11_QUERY = N3.DataFactory.namedNode("http://www.w3.org/ns/sparql-service-description#SPARQL11Query")
export const SPARQL_DESCRIPTION_SPARQL_11_UPDATE = N3.DataFactory.namedNode("http://www.w3.org/ns/sparql-service-description#SPARQL11Update")

export function listFromRdf(g: N3.Store, path: N3.Term): N3.Term[] | null {
  let r: N3.Term[] = []

  while ( !path.equals(RDF_NIL) ) {
    if ( path.termType == 'BlankNode' ) {
      let els = g.getQuads(path, RDF_FIRST, null, null);
      if ( els.length != 1 ) return null;

      let rest = g.getQuads(path, RDF_REST, null, null);
      if ( rest.length != 1 ) return null;

      r.push(els[0].object)
      path = rest[0].object
    } else {
      return null;
    }
  }

  return r;
}

export function interpretLiteral(v: string, dt: N3.NamedNode, expectedType?: N3.NamedNode): any {
  if ( dt.equals(XSD_STRING) && expectedType !== undefined ) {
    const x = interpretLiteral(v, expectedType)
    if ( x !== undefined ) return x;
  }

  if ( dt.equals(XSD_INTEGER) ) {
    return parseInt(v)
  } else if ( dt.equals(XSD_BOOLEAN) ) {
    if ( v == 'false' ) return false
    else if ( v == 'true' ) return true
    else return null
  } else {
    return v
  }
}

interface GetPropertyOptions {
  literal?: boolean,
  expectedType?: N3.NamedNode,
  relativeTo?: string,
  multiple?: boolean
}

export function getProperty(g: N3.Store, s: N3.Term, p: N3.Term | N3.Term[], options?: GetPropertyOptions): any {
  const quads = (Array.isArray(p) ? p : [p]).flatMap((p) => g.getQuads(s, p, null, null))
  const multiple = options?.multiple || false
  if ( !multiple && quads.length != 1 ) return null;
  if ( multiple && quads.length == 0 ) return []

  const values = quads.map((q) => q.object)

  if ( options === undefined )
    options = { literal: false }

  const finalValues = values.map((v) => {
    if ( options?.literal ) {
      if ( v.termType == 'Literal' ) {
        return interpretLiteral(v.value, v.datatype, options.expectedType)
      } else {
        return null
      }
    } else {
      if ( v.termType == 'NamedNode' && options?.relativeTo) {
        const url = new URL(v.value, options.relativeTo)
        return N3.DataFactory.namedNode(url.href)
      } else {
        return v
      }
    }
  })

  if (multiple) return finalValues
  else return finalValues[0]
}

export function graphUnion(a: N3.Store, b: N3.Store): N3.Store {
  const ret = new N3.Store()

  graphUnionInPlace(ret, a)
  graphUnionInPlace(ret, b)
  return ret
}

export function graphUnionInPlace(a: N3.Store, b: N3.Store) {
  const blankNodes: {[id: string]: N3.BlankNode} = {}

  function getBlankNode(id: string) {
    if ( id in blankNodes ) return blankNodes[id]
    else {
      blankNodes[id] = a.createBlankNode()
      return blankNodes[id]
    }
  }

  for ( const q of b ) {
    let subject = q.subject
    if ( subject instanceof N3.BlankNode ) {
      subject = getBlankNode(subject.id)
    }
    let object = q.object
    if ( object instanceof N3.BlankNode ) {
      object = getBlankNode(object.id)
    }
    a.addQuad(subject, q.predicate, object, q.graph)
  }
}

interface OrderAndName {
  order: number,
  name?: string | null
}

export function compareOrderName(a: OrderAndName, b: OrderAndName): number {
  let aName = a.name || ""
  let bName = b.name || ""
  if ( a.order < b.order ) return -1;
  else if ( a.order > b.order ) return 1;
  else if ( aName < bName ) return -1;
  else if ( aName > bName ) return 1;
  else return 0;
}

interface RunningCallInfo<X> {
  timer: NodeJS.Timeout | null,
  reset: () => void,
  reject: ((e: any) => void)[],
  resolve: ((r: X) => void)[]
}

interface PendingCallInfo<Args, X> {
  args: Args,
  reject: ((e: any) => void)[],
  resolve: ((r: X) => void)[]
}

export function asyncDebounce<Args extends any[], X>(fn: (...args: Args) => Promise<X>, timeout: number): (...args: Args) => Promise<X> {
  let timer: RunningCallInfo<X> | null =  null
  let lastArgs: PendingCallInfo<Args, X> | null = null
  function launchTimer({reject, resolve, args}: PendingCallInfo<Args, X>): RunningCallInfo<X> {
    function launch () {
        nextTimer.timer = null
        fn(...args).then((result) => {
          for ( const o of resolve ) {
            o(result)
          }
        }).catch((e) => {
          for ( const o  of reject ) {
            o(e)
          }
        }).finally(() => {
          // If, during our execution, other calls came in, run them now
          if ( lastArgs !== null ) {
            timer = launchTimer(lastArgs)
            lastArgs = null
          } else {
            // Otherwise, end execution. Return to steady state
            timer = null
          }
        })
      }
    const nextTimer: RunningCallInfo<X> = {
      reject, resolve,
      reset: () => {
        if ( nextTimer.timer !== null ) {
          clearTimeout(nextTimer.timer)
          nextTimer.timer = setTimeout(launch, timeout)
        }
      },
      timer: setTimeout(launch, timeout)
    }
    return nextTimer
  }
  return (...args) => {
    return new Promise ((resolve, reject) => {
      if ( lastArgs === null ) {
        lastArgs = { args, resolve: [ resolve ], reject: [ reject ]}
      } else {
        lastArgs.args = args
        lastArgs.resolve.push(resolve)
        lastArgs.reject.push(reject)
      }

      // If the current timer is null, launch the debounced function
      if ( timer === null ) {
        timer = launchTimer(lastArgs)
        lastArgs = null
      } else {
        timer.reset()
      }
    })
  }
}


export function formatQuads(qs: N3.Quad[]): Promise<string> {
  const writer = new N3.Writer({format: 'text/turtle'})
  writer.addQuads(qs)
  return new Promise((resolve, reject) => {
    writer.end((error, result) => {
      if ( error ) reject(error)
      else resolve(result)
  })})
}

export type EndpointAuth = BasicEndpointAuth

export interface BasicEndpointAuth {
  type: 'basic',
  username: string,
  password?: string
}

export interface EndpointSpec {
  endpoint: string,
  auth?: EndpointAuth,
  needsProxy: boolean
}

export interface DatasetSpec {
  iri: string,
  value: string,
  label: string,
  name: string,
  description?: string,
  sparqlEndpoint: EndpointSpec,
  updateEndpoint?: EndpointSpec,
  shapesGraph?: string
}

interface EndpointCaps {
  endpoint: N3.NamedNode,
  supportsQuery: boolean,
  supportsUpdate: boolean,
}

export function parseVoidEndpoint(graph: N3.Store, endpoint: N3.NamedNode): EndpointSpec {
  const services = graph.getQuads(null, SPARQL_DESCRIPTION_ENDPOINT, endpoint, null)
  const e: EndpointSpec = { endpoint: endpoint.value, needsProxy: false }
  for ( const service of services ) {
    // Check for authentication
    const auth = getProperty(graph, service.subject, MOON_CREDENTIALS);
      if ( auth !== null ) {
          if ( graph.getQuads(auth, RDF_TYPE, MOON_BASIC_CREDENTIALS, null).length > 0 ) {
              const username = getProperty(graph, auth, MOON_USERNAME, { literal: true, expectedType: XSD_STRING })
              if ( username === null ) continue;

              e.auth = { type: 'basic', username }

              const password = getProperty(graph, auth, MOON_PASSWORD, {literal: true, expectedType: XSD_STRING})
              if ( password !== null ) {
                  e.auth.password = password
              }
          }
      }

      const needsProxy = getProperty(graph, service.subject, MOON_PROXY, {literal: true, expectedType: XSD_BOOLEAN})
      if ( needsProxy !== null ) {
          e.needsProxy = needsProxy
      }
  }
  console.log("PARSED VOID ENDPOINT", endpoint.value, e)
  return e
}

export function parseVoidDatasets(graph: N3.Store): DatasetSpec[] {
  const datasets = graph.getQuads(null, null, VOID_DATASET, null).map((q) => q.subject)
  const parsedDatasets: DatasetSpec[] = datasets.flatMap((d) => {
    const name = getProperty(graph, d, [DCTERMS_TITLE, RDFS_LABEL, SPARQL_DESCRIPTION_NAME], {literal: true, expectedType: XSD_STRING}) || d.value
    const description = getProperty(graph, d, DCTERMS_DESCRIPTION, {literal: true, expectedType: XSD_STRING}) || undefined

    const shapesGraph = getProperty(graph, d, MOON_SHAPES_GRAPH)?.value || undefined

    const endpoints: EndpointCaps[] = getProperty(graph, d, VOID_SPARQL_ENDPOINT, {multiple: true}).flatMap((e: N3.Term) => {
      if ( e.termType != 'NamedNode' ) return []
      const supportedDialects = graph.getQuads(null, SPARQL_DESCRIPTION_ENDPOINT, e, null)
        .flatMap((q) => {
          return graph.getQuads(q.subject, SPARQL_DESCRIPTION_SUPPORTED_LANGUAGE, null, null).map((q) => q.object)
        })
        .filter((o) => o.termType == 'NamedNode');
      let supportsQuery = false, supportsUpdate = false
      if ( supportedDialects.length ==  0) {
        supportsQuery = true;
        supportsUpdate = true;
      } else {
        if ( supportedDialects.findIndex((d) => d.equals(SPARQL_DESCRIPTION_SPARQL_10_QUERY) || d.equals(SPARQL_DESCRIPTION_SPARQL_11_QUERY)) != -1 ) {
          supportsQuery = true;
        }

        if ( supportedDialects.findIndex((d) => d.equals(SPARQL_DESCRIPTION_SPARQL_11_UPDATE))  != -1 ) {
          supportsUpdate = true;
        }

      }
      return [{ endpoint: e, supportsQuery, supportsUpdate }]
    })


    const queryEndpoint = endpoints.find((e) => e.supportsQuery)
    if ( queryEndpoint === undefined ) return []

    const updateEndpoint = endpoints.find((e) => e.supportsUpdate)

    return [ {
      iri: d.value, value: d.value, label: name,
      name, description,
      shapesGraph,
      sparqlEndpoint: parseVoidEndpoint(graph, queryEndpoint.endpoint),
      updateEndpoint: updateEndpoint ? parseVoidEndpoint(graph, updateEndpoint.endpoint) : undefined } ]
  })
  return parsedDatasets
}
