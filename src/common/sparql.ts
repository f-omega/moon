import N3 from 'n3'
import { EndpointSpec } from './util'

export type SparqlResult = BoolResult | VarBindingResult<string>
export type TypedSparqlResult<X extends string> = BoolResult | VarBindingResult<X>

export type RunSparql = <C extends boolean = false>(s: string, construct?: C) => Promise<C extends true ? N3.Store : SparqlResult>
export type UpdateSparql = (s: string) => Promise<void>
export interface ISparqlContext {
  dataset: string,
  runSparql: RunSparql,
  updateSparql: UpdateSparql,
}

export interface Header {
  link: string[]
}

export interface VarHeader<Key> extends Header {
  vars: Key[]
}

export interface BoolResult {
  head: Header,
  boolean: boolean
}

export interface VarBindingResult<Key extends string> {
  head: VarHeader<Key>
  results: VarBindings<Key>
}

export interface VarBindings<Key extends string> {
  bindings: VarBinding<Key>[]
}

export type VarBinding<Key extends string> = Record<Key, Term>

export type Term = IRITerm | LiteralTerm | BlankNodeTerm | QuotedTriple
export type SubjectTerm = IRITerm | BlankNodeTerm | QuotedTriple

interface IRITerm {
  type: "uri",
  value: string
}

interface LiteralTerm {
  type: "literal",
  value: string,
  "xml:lang"?: string,
  "datatype"?: string
}

interface BlankNodeTerm {
  type: "bnode",
  value: string
}

interface QuotedTriple {
  type: "triple",
  subject: SubjectTerm,
  predicate: SubjectTerm,
  object: Term
}

export type GetPassword = (endpoint: string, username: string) => Promise<string>
export interface SparqlOptions {
  endpoint: EndpointSpec | string,
  graph: string,
  construct?: boolean,
  update?: boolean,
  getPassword?: GetPassword
}
export class SparqlEndpointError {
  endpoint: EndpointSpec | string
  graph: string
  query: string
  response: Response

  constructor(endpoint: EndpointSpec | string, graph: string, q: string, r: any) {
    this.endpoint = endpoint
    this.graph = graph
    this.query = q
    this.response = r
  }

  toString() {
    return `Could not fetch SPARQL result from ${this.endpoint}: Server returned ${this.response.status}\nQuery: ${this.query}`
  }
}

export function isSelectResult(r: SparqlResult): r is VarBindingResult<string> {
  return 'vars' in r.head
}

export class SparqlResultContext {
  blankNodes: { [nm: string]: N3.BlankNode }

  constructor() {
    this.blankNodes = {}
  }

  toN3(t: Term): N3.Term {
    if ( t.type == "uri" ) {
      return N3.DataFactory.namedNode(t.value)
    } else if ( t.type == "literal" ) {
      return N3.DataFactory.literal(t.value, t["xml:lang"] || t.type)
    } else if ( t.type == "bnode" ) {
      if ( !(t.value in this.blankNodes) ) {
        this.blankNodes[t.value] = N3.DataFactory.blankNode()
      }
      return this.blankNodes[t.value]
    } else if ( t.type == "triple" ) {
      throw new TypeError("N3.JS doesn't support RDF*")
    } else {
      // @ts-ignore
      throw new TypeError(`Unknown term type ${t.type}`)
    }
  }
}

