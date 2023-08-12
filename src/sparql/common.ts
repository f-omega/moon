import N3 from 'n3'

export const MOON_BASE = "https://ld.f-omega.com/moon"

export const RDF_TYPE = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
export const RDF_NIL = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#nil")
export const RDF_FIRST = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first")
export const RDF_REST = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#rest")
export const RDF_HTML = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML")
export const XSD_STRING = N3.DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#string")
export const RDF_LANG_STRING = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString")
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
export const SHACL_PATH =  N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#path")
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
export const MOON_APPLICABLE_SHAPE = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/ApplicableShape")
export const MOON_ACTION = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/action")
export const MOON_BUTTON_ACTION = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/ButtonAction")
export const MOON_TRIGGER = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/trigger")
export const MOON_CLICK_TRIGGER = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/onClick")
export const MOON_CHANGE_TRIGGER = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/onChange")
export const MOON_CLIENT_SCRIPT = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/clientScript")
export const MOON_SERVER_SCRIPT = N3.DataFactory.namedNode("https://ld.f-omega.com/moon/serverScript")

export const RDF_TRUE = N3.DataFactory.literal("true", XSD_BOOLEAN)
export const RDF_FALSE = N3.DataFactory.literal("false", XSD_BOOLEAN)


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
  literal: boolean,
  expectedType?: N3.NamedNode
}

export function getProperty(g: N3.Store, s: N3.Term, p: N3.Term, options?: GetPropertyOptions): any {
  const quads = g.getQuads(s, p, null, null)
  if ( quads.length != 1 ) return null;

  if ( options === undefined )
    options = { literal: false }

  if ( options.literal ) {
    if ( quads[0].object.termType == 'Literal' ) {
      return interpretLiteral(quads[0].object.value, quads[0].object.datatype, options.expectedType)
    } else {
      return null
    }
  } else {
    return quads[0].object
  }
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
