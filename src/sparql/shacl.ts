// Provides functions that given a term and a graph: aph, can look up the SHACL shapes
import N3 from 'n3'
import { useEffect, useMemo, useState } from 'react'
import { useCache } from '../cache'
import * as util from '../common/util'
import { GraphNavigator } from '../graph'
import { DASH_INSTANCES_SELECT_EDITOR } from './dash'
import { Describer, SparqlContext, useSparql } from './Provider'
import { isSelectResult, SparqlResultContext } from './types'
import { ShaclPath, PropertyShape, NodeShape, pathToSparql } from '../common/shacl'
import { ShaclNodeExpression, shaclNodeExprToSparql } from '../common/shacl_node_expression'
// import type { SparqlContext } from './Provider'

export * from '../common/shacl';

export interface GroupSpecDef<P = PropertyValue> {
    order: number,

    name?: string,
    description?: string,
    properties: P[]
}

export interface PropertyDef {
    order: number,

    name?: string,
    description?: string,

    property: N3.Term,
    graph: N3.Store,

    path: ShaclPath,

    group?: N3.Term,
}

export type IdentifiedObject = {
  iri?: string
  node: N3.NamedNode | N3.Literal | N3.BlankNode
}

export type SimplePropertyValue = { property: PropertyShape, targets: GraphNavigator, value: IdentifiedObject[] }
export type PropertyValue = SimplePropertyValue & { order: number, name: string | null }

interface NonShapeProperty {
  property: N3.NamedNode,
  values: IdentifiedObject[],
  targets: GraphNavigator
}

interface UseShaclResult {
  nonShapeProperties: NonShapeProperty[],
  //nonPrimitiveValues: { [i: number]: NonPrimitiveValue };
  groupDefs: GroupSpecDef<PropertyValue>[];
  nodeShape: NodeShape;
  propertyDefs: PropertyShape[];
  loading: boolean,
  error: any,
  jsonProps: {[prop: string]: string[]}
}

async function fetchProperties(sparql: SparqlContext, graph: GraphNavigator, propertyDefs: PropertyShape[]): Promise<SimplePropertyValue[]> {
  const subQueries = propertyDefs.flatMap((p, i) => {
    if ( p.path ) {
      const path = pathToSparql(p.path)
      return [ `{ ?s ${path} ?v. BIND(${i} AS ?ix). }\n` ]
    } else if ( p.inferredValue ) {
      const sparql = shaclNodeExprToSparql("?s", "?v", p.inferredValue)
      if ( sparql !== null ) {
        return [ `{ ${sparql}. BIND(${i} AS ?ix). }\n` ]
      }
    }
    return []
  }).join(" UNION\n")

  const baseQuery = graph.sparqlQuery({resultName: "s", distinct: true})
  const q = `SELECT ?ix ?v ?value {
    { { ${baseQuery} } FILTER(BOUND(?s)). }
  ${subQueries}
  BIND(IF(ISBLANK(?v), IRI(?v), ?v) AS ?value).
} ORDER BY ?ix`

  console.log("RUN", q, propertyDefs)
  const r = await sparql.runSparql(q)
  if ( isSelectResult(r) ) {
    const ret: SimplePropertyValue[] = []
    let curProp: SimplePropertyValue | null = null
    const ctxt = new SparqlResultContext()
    for ( const row of r.results.bindings ) {
      const ixStr = ctxt.toN3(row.ix)
      if ( ixStr.termType != 'Literal' ) continue
      const ix = parseInt(ixStr.value)
      if ( isNaN(ix) ) continue

      const val = ctxt.toN3(row.value)
      const raw = ctxt.toN3(row.v)
      let finalVal: IdentifiedObject
      if ( val.termType == 'NamedNode' ) {
        if ( raw.termType == 'BlankNode' ) {
          finalVal = { iri: val.value, node: raw }
        } else {
          finalVal = { iri: val.value, node: val}
        }
      } else if ( val.termType == 'Literal' ) {
        finalVal = { node: val }
      } else { continue }

      if ( curProp === null || !curProp.property.shape.equals(propertyDefs[ix].shape) ) {
        if ( curProp !== null )
          ret.push(curProp)
        let targets: GraphNavigator
        const path = propertyDefs[ix].path
        if ( path !== undefined ) {
          targets = graph.explorePredicates(path)
        } else {
          targets = graph;
        }
        curProp = { property: propertyDefs[ix], value: [ finalVal ], targets}
      } else {
        curProp.value.push(finalVal)
      }
    }

    if ( curProp !== null )
      ret.push(curProp);

    return ret
  } else {
    return []
  }
}

async function fetchPredicates(sparql: SparqlContext, graph: GraphNavigator, predicates: N3.NamedNode[]): Promise<[N3.NamedNode, IdentifiedObject][]> {
  const baseQuery = graph.sparqlQuery({resultName: "s", distinct: true})
  const values = predicates.map((p) => `<${p.value}>`).join(' ')

  const q = `SELECT ?p ?o ?identified { { { ${baseQuery} } FILTER(BOUND(?s)). } VALUES ?p { ${values} }. ?s ?p ?o. BIND(IF(ISBLANK(?o), IRI(?o), ?o) AS ?identified) } ORDER BY ?p`

  const r = await sparql.runSparql(q)
  if ( isSelectResult(r) ) {
    const ret: [N3.NamedNode, IdentifiedObject][] = []
    const ctxt = new SparqlResultContext()
    for ( const row of r.results.bindings ) {
      const p = ctxt.toN3(row.p)
      if ( p.termType != 'NamedNode' ) continue;

      const o = ctxt.toN3(row.o)
      let final: IdentifiedObject

      if ( o.termType == 'BlankNode' ) {
        final = { node: o, iri: ctxt.toN3(row.identified).value }
      } else if ( o.termType == 'Literal' ) {
        final = { node: o }
      } else if ( o.termType == 'NamedNode' ) {
        final = { node: o, iri: o.value }
      } else {
        continue
      }

      ret.push([p, final])
    }
    return ret
  } else {
    return []
  }
}

export function useShacl(shapes: NodeShape[], graph: GraphNavigator): UseShaclResult {
  const sparql = useSparql()
  const nodeShape = useMemo(() => NodeShape.conjunction(shapes), [shapes])

  const [ allProperties, setAllProperties ] = useState<N3.NamedNode[] | null>(null)
  const [ error, setError ] = useState<any>(null)
  const [ propertyValues, setPropertyValues ] = useState<SimplePropertyValue[] | null>(null)
  const [ nonShapePropertyValues, setNonShapePropertyValues ] = useState<NonShapeProperty[] | null>(null)

  // List all properties so that we know which ones are shacl v not
  useEffect(() => {
    setError(null)
//    setAllProperties(null) // Don't do this... causes reloads
    graph.listDirectProperties(sparql)
      .then((ps) => {
        console.log("ALL PROPERTIES", ps)
        setAllProperties(ps)
      })
      .catch((e) => {
        setError(e)
      })
  }, [graph])

//  console.log("NODE SHAPES", nodeShape,  shapes)

  // Get the unique set of properties we're going to handle
  const propertyDefs: PropertyShape[] = useMemo(() => {
    let properties: PropertyShape[] = []
    let seen: { [id: string]: true } = {}
    for (const p of nodeShape.properties()) {
      if ( p.getHidden() ) continue;
      if (p.shape.id in seen) continue
      seen[p.shape.id] = true
      properties.push(p)
    }
    return properties
  }, [nodeShape])

  useEffect(() => {
    //setPropertyValues(null) // Causes reload
    setError(null)
    fetchProperties(sparql, graph, propertyDefs)
      .then(setPropertyValues)
      .catch(setError)
  }, [graph, propertyDefs])

  const nonShapeProperties = useMemo(() => {
    if ( allProperties !== null && propertyValues !== null ) {
      const uniqueProperties = new Set(allProperties.map((p) => p.value))
      for ( const p of Object.values(propertyValues) ) {
        if ( p.property.path?.type == 'property' ) {
          // simple property
          uniqueProperties.delete(p.property.path.property.value)
        }
      }

//      console.log("NON SHACL PROPS", uniqueProperties)

      return Array.from(uniqueProperties).map((n) => N3.DataFactory.namedNode(n))
    } else {
      return null
    }
  }, [propertyValues, allProperties])

  useEffect(() => {
    if ( nonShapeProperties === null ) return

//    setNonShapePropertyValues(null)
    setError(null)

    fetchPredicates(sparql, graph, nonShapeProperties).then((r) => {
      const nonShapeProps: NonShapeProperty[] = []
      let curValue: NonShapeProperty | null = null
      for ( const e of r ) {
        const [prop, value] = e
        if ( curValue === null || !curValue.property.equals(prop) ) {
          if ( curValue !== null )
            nonShapeProps.push(curValue)
          curValue = { property: prop, values: [ value ], targets: graph.explorePredicates(prop) }
        } else {
          curValue.values.push(value)
        }
      }

      if ( curValue !== null )
        nonShapeProps.push(curValue)

      setNonShapePropertyValues(nonShapeProps)
    }).catch((e) => setError(e))
  }, [nonShapeProperties])

  const allPropertyValues = useMemo(() => {
    if ( propertyValues === null ) return []

    const remainingPropertyDefs: {[iri: string]: PropertyShape} = {}
    for ( const p of propertyDefs ) {
      remainingPropertyDefs[p.shape.id] = p
    }

    for ( const p of propertyValues ) {
      delete remainingPropertyDefs[p.property.shape.id]
    }

    const emptyValues = Object.values(remainingPropertyDefs).map((p) => ({property: p, value: []}))

    return [ ...propertyValues, ...emptyValues ]
  }, [propertyValues])

//  console.log("PROPS", allPropertyValues)
  const groupDefs: GroupSpecDef<PropertyValue>[] = useMemo(() => {
    const groups: {[groupIri: string]: GroupSpecDef<PropertyValue>} = {}
    for ( const p of allPropertyValues ) {
      let groupIri : string | null = null
      if ( p.property.group !== null ) {
        groupIri = p.property.group.iri.value
      }

      let targets: GraphNavigator
      if ( p.property.path !== undefined ) {
        targets = graph.explorePredicates(p.property.path)
      } else {
        targets = graph // TODO
      }

      const elaborated: PropertyValue = {
        ...p,
        name: p.property.getName(),
        order: p.property.order,
        targets
      }

      if ( (groupIri || "") in groups ) {
        groups[groupIri || ""].properties.push(elaborated)
      } else if ( groupIri === null ) {
        groups[""] = { order: -1000, properties: [elaborated] }
      } else {
        const newGroup: GroupSpecDef<PropertyValue> = {
          // @ts-ignore
          order: p.property.group.order || 10000,

          // @ts-ignore
          name: p.property.group.name || p.property.group.iri.value,

          description: p.property.group?.description,
          properties: [elaborated]
        }
        groups[groupIri] = newGroup
      }
    }

    const groupList = Object.values(groups).sort(util.compareOrderName)
    for ( const g of groupList ) {
      g.properties.sort(util.compareOrderName)
    }
    return groupList
  }, [allPropertyValues])

  const jsonProps = useMemo(() => {
    if ( propertyValues !== null ) {
      const obj: {[k: string]: string[]} = {}
      propertyValues.map((v) => {
        const key = v.property.getJsonProperty()
        if ( key !== null ) {
          const values = v.value.map((x) => x.node.value)
          obj[key] = [...(obj[key] || []), ...values]
        }
      })
      return obj
    } else {
      return {}
    }
  }, [propertyValues])


  return {
    loading: (allProperties === null || propertyValues === null || nonShapePropertyValues === null) && error === null,
    error,

    nonShapeProperties: nonShapePropertyValues !== null ? nonShapePropertyValues : [],
    groupDefs,
    nodeShape,
    propertyDefs,
    jsonProps
  }
}

export function useShapeDef(resource: string | N3.Term, extraGraph?: N3.Store): [NodeShape[], any] {
  const cache = useCache()
  const sparql = useSparql()

  const [shapeDef, setShapeDef] = useState<NodeShape[]>([])
  const [shapeError, setShapeError] = useState<any>(null)

  const resourceTerm: N3.Term = typeof resource == 'string' ? N3.DataFactory.namedNode(resource) : resource;

  useEffect(() => {
    setShapeDef([])
    setShapeError(null)
    cache.lookupShacl(sparql, resourceTerm, extraGraph)
      .then((shs) => {
//        console.log("GOT SHAPES", shs)
        setShapeDef(shs)
      })
      .catch((e) => setShapeError(e))
  }, [resource, cache, extraGraph])

//  console.log("SHAPE ERROR", shapeError)
  return [shapeDef, shapeError]
}

//@ts-ignore
window.urljoin = (a: string, b: string) => {
  if ( a.endsWith("/") ) {
    return a + b
  } else { return a + "/" + b }
}
