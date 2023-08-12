import N3 from 'n3'
import { type ISparqlContext, isSelectResult } from './sparql'
import { RDF_TYPE } from './util'
import { NodeShape } from './shacl'

export default class Cache {
  shapeCache: { [classIri: string]: NodeShape }
  shapesGraphs: string[]
  private graph: string

  constructor(graph?: string) {
    this.shapeCache = {}
    this.shapesGraphs = []
    this.graph = graph === undefined ? "?g" : `<${graph}>`
  }

  async lookupShapesForNode(sparql: ISparqlContext, termIri: N3.Term, extraGraph?: N3.Store): Promise<N3.NamedNode[]> {
    function getExtraIris(os: N3.Term[]): Set<string> {
      return new Set(os.filter((o) => o.termType == 'NamedNode').map((o) => o.value))
    }
    function makeValues(varName: string, ps: Set<string>): string {
      const iris = Array.from(ps).map((p) => `<${p}>`).join(' ')
      return `VALUES ${varName} { ${iris} }`
    }
    function makeUnion(query: string[]) {
      return query.map((q) => `{ ${q} }`).join(" UNION ")
    }

    const nodeTargetQuery: string[] = [], classTargetQuery: string[] = [],
      subjectTargetQuery: string[] = [],
      objectTargetQuery: string[] = []

    if ( termIri instanceof N3.NamedNode ) {
      nodeTargetQuery.push(`GRAPH ${this.graph} { ?shape sh:targetsNode <${termIri.value}> }`)
      classTargetQuery.push(`<${termIri.value}> a ?cls.`)
      subjectTargetQuery.push(`<${termIri.value}> ?p ?o.`)
      objectTargetQuery.push(`?s ?p <${termIri.value}>.`)
    }

    if ( extraGraph ) {
      const classes = getExtraIris(extraGraph.getQuads(termIri, RDF_TYPE, null, null).map((q) => q.object))
      const asSubject = getExtraIris(extraGraph.getQuads(termIri, null, null, null).map((q) => q.predicate))
      const asObject  = getExtraIris(extraGraph.getQuads(null, null, termIri, null).map((q) => q.predicate))

      if( classes.size > 0 ) {
        classTargetQuery.push(makeValues("?cls", classes))
      }
      if ( asSubject.size > 0 ) {
        subjectTargetQuery.push(makeValues("?p", asSubject))
      }
      if ( asObject.size > 0 ) {
        objectTargetQuery.push(makeValues("?p", asObject))
      }
    }

    const reqs = []
    if ( nodeTargetQuery.length > 0 ) reqs.push(makeUnion(nodeTargetQuery))
    if ( classTargetQuery.length > 0 ) {
      const classQuery = makeUnion(classTargetQuery)
      reqs.push(`GRAPH ${this.graph} { { ?shape sh:targetsClass ?parent. } UNION { ?parent a sh:NodeShape; BIND(?parent AS ?shape) }. ?cls rdfs:subClassOf* ?parent. } ${classQuery}`)
    }
    if ( subjectTargetQuery.length > 0 ) {
      const subjectQuery = makeUnion(subjectTargetQuery)
      reqs.push(`GRAPH ${this.graph} { ?shape sh:targetsSubjectsOf ?p. }  ${subjectQuery}`)
    }
    if ( objectTargetQuery.length > 0 ) {
      const objectQuery = makeUnion(objectTargetQuery)
      reqs.push(`GRAPH ${this.graph} { ?shape sh:targetsObjectsOf ?p. } ${objectQuery}`)
    }

    if ( reqs.length == 0 ) return []
    const conds = makeUnion(reqs)

    const q = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT DISTINCT ?shape
WHERE {
      GRAPH ${this.graph} { ?shape a sh:NodeShape. }
      ${conds}
}`
    const r = await sparql.runSparql(q)
    if ( isSelectResult(r) ) {
      const result = []
      for ( const row of r.results.bindings ) {
        // Blank nodes can technically be shapes, but this is very difficult to handle
        if ( row.shape === undefined ) continue;
        if ( row.shape.type != 'uri' ) continue;

        result.push(N3.DataFactory.namedNode(row.shape.value))
      }
      return result
    } else {
      return []
    }
  }

  /// Retrieves the SHACL closure for any shape bound to ?shape
  _shaclQuery(whereClause: string) {
    let fromClauses = this.shapesGraphs.map((c) => `FROM <${c}>`).join('\n')
    const q = `PREFIX sh: <http://www.w3.org/ns/shacl#>
      PREFIX moon: <https://ld.f-omega.com/moon/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      CONSTRUCT {
            ?shape ?p ?o.
            ?x ?pp ?po.
      } WHERE {
    ${whereClause}
      GRAPH ${this.graph} {
            ?shape a sh:NodeShape; ?p ?o.

            OPTIONAL {
              ?shape sh:property ?property.
      { ?property (sh:node/sh:property)*/sh:node ?x. }
      UNION
      { ?property (sh:node/sh:property)* ?subproperty.
      ?subproperty (<> *|sh:group|sh:node|moon:action|(sh:path/((sh:inversePath|rdf:nil|rdf:first|rdf:rest|sh:alternativePath|sh:zeroOrMorePath|sh:oneOrMorePath|sh:zeroOrOnePath)*))) ?x. }
      UNION {
        ?shape moon:action ?x.
      }
      }
              ?x ?pp ?po.
      } }
          ${fromClauses}
    `
    return q
  }

  async loadShape(sparql: ISparqlContext, shapeIri: N3.NamedNode<string>): Promise<NodeShape> {
    if ( shapeIri.value in this.shapeCache ) {
      return this.shapeCache[shapeIri.value]
    } else {
      // SPARQL query to get graph shapes for class
      let graph = await sparql.runSparql(this._shaclQuery(`
        VALUES ?shape { <${shapeIri.value}> }.
      `), true)
      const shape =  new NodeShape(graph, shapeIri)
      this.shapeCache[shapeIri.value] = shape
      return shape
    }
  }

  async lookupShacl(sparql: ISparqlContext, term: N3.Term, extraGraph?: N3.Store): Promise<NodeShape[]> {
    const shapes = await this.lookupShapesForNode(sparql, term, extraGraph)
    return Promise.all(shapes.map((s) => this.loadShape(sparql, s)))
//    let classes: N3.Term[] = []
//    if ( includeClasses ) {
//      classes = graph.getQuads(N3.DataFactory.namedNode(termIri), common.RDF_TYPE, null, null)
//        .filter((p) => p.object instanceof N3.NamedNode).map((p) => p.object)
//    }
//
//    // @ts-ignore
//    let classShapes = await Promise.all(classes.map((c) => this.lookupShapeForClass(sparql, c)))
//
//    // Find things that target this node explicitly (sh:targetSubjectsOf, sh:targetObjectsOf)
//    let ourGraph = await sparql.runSparql(this._shaclQuery(`
//      { <${termIri}> ?termp ?termo. GRAPH ${this.graph} { ?shape sh:targetsSubjectsOf ?termp } } UNION
//      { ?terms ?termp <${termIri}>. GRAPH ${this.graph} { ?shape sh:targetsObjectsOf ?termp } } UNION
//      { GRAPH ${this.graph} { ?shape sh:targetsNode <${termIri}> } }
//    `), true)
//
//
//    return [ ourGraph, ... classShapes ]
  }
}
