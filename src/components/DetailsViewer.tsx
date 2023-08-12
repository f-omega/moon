import { graphUnionInPlace, RDF_TYPE } from '../sparql/common'
import N3 from 'n3'
import { useState, useEffect, ReactNode, useMemo, useRef } from 'react'
import Select from 'react-select/async-creatable'
import { Card, Form } from 'react-bootstrap'

import { useCache } from '../cache'
import { GraphContext, GraphFragment, GraphNavigator, GraphPatch, useGraph, useGraphPatchEditor } from '../graph'
import { useSparql } from '../sparql/Provider'
import FocusNode, { useFocus } from './FocusNode'
import ResourceSelector from './ResourceSelector'
import NamedResourceLink from './NamedResourceLink'

import type { ViewerProps } from './Object'
import AutoCompleteEditor from './AutoCompleteEditor'
import { IdentifiedObject, PropertyValue, useShacl, useShapeDef } from '../sparql/shacl'
import PropertyView, { type PropertyValueProps, usePropertyView } from './PropertyView'
import { concatPatchFragments, concatPatchFragmentsRebasable, PatchFragment, SparqlPatch } from '../sparql/patch'
import { useDebouncedCallback } from 'use-debounce'
import { isSelectResult, SparqlResultContext } from '../common/sparql'
import { SingleValue } from 'react-select'
import ResourceLink from './ResourceLink'
import Loading from './Loading'
import { useActions } from './Actions'
import ActionDropdown from './ActionDropdown'
import { restrictionForClasses } from '../sparql/dash'

type Props = ViewerProps & { editing?: boolean }
const BASE_PATCH_KEY = "##$#$BASE"
const CLASSES_KEY = "#$##$CLASSES"

function DetailsViewerInner(p: Props) {
  const editing = p.editing
  const graph = useGraph()

  const sparql = useSparql()
  const parents = useFocus()

  const [ extraClasses, setExtraClasses ] = useState<N3.NamedNode[]>([])

  const { patch, setPatch, rebasePatch, clearPatch } = useGraphPatchEditor(p.onChange)
  const [baseManuallySet, setBaseManuallySet] = useState<boolean>(false)
  const [base, setBase] = useState<N3.Quad_Object>(() => {
    if ( p.term === null ) {
      let term: N3.Term
      if ( p.property ) {
        term  = p.property.suggestSubject(parents)
      } else {
        term = N3.DataFactory.blankNode()
      }
      setPatch(BASE_PATCH_KEY)(graph.replacePatch(term))
      return term
    } else {
      return p.term
    }
  })

  const extraGraph = useMemo(() => {
    const g = new N3.Store()
    for ( const c of extraClasses ) {
      g.addQuad(base as any, RDF_TYPE, c)
    }
    return g
  }, [base, extraClasses])
  const [ baseShapeDef, shapeError ] = useShapeDef(base, extraGraph) // Add extra triples
  const shapeDef = useMemo(() => [ ...baseShapeDef, ...(p.property?.nodeShape || [])],
    [baseShapeDef, p.property, p.property?.nodeShape])

  const subjectSuggesters = useMemo(() => {
    return shapeDef.flatMap((s) => s.getSubjectSuggesters())
  }, [shapeDef])

//  console.log("GOT SHAPES DETAILS", shapeDef)
  const actions = useActions(shapeDef)

  const subGraph = useMemo(() => {
    const subGraph = graph.focusNew(base, p.property?.path)
    rebasePatch(subGraph)
    return subGraph
  }, [graph, base])

  function updateBase(base: N3.Quad_Object, manual: boolean = false) {
    if ( manual )
      setBaseManuallySet(true);

    if ( p.onChange ) {
      console.log("UPDATE BASE", base)
      setBase(base)
      setPatch(BASE_PATCH_KEY)(graph.replacePatch(base))
    }
  }

  useEffect(() => {
    if ( p.term !== null ) {
      subGraph.explorePredicates(RDF_TYPE).getAllDistinct(sparql)
        .then((clss) => setExtraClasses(clss.flatMap((c) => c.termType == 'NamedNode' ? [c] : [])))

    } else {
      setExtraClasses([])
    }
}, [])

  function updateClasses(clss: N3.NamedNode[]) {
    setPatch(CLASSES_KEY)(subGraph.explorePredicates(RDF_TYPE).replacePatch(clss))
    setExtraClasses(clss)
  }

  const showType = useMemo(() => shapeDef.some((s) => s.showType), [shapeDef])

  let classSelector = <></>
  if ( p.editing && showType ) {
    // Instance selector for any class. If there's a class restriction, then only subclasses are chosen
    classSelector = <Form.Group>
      <Form.Label>Type</Form.Label>
      <ResourceSelector multiple
        restriction={restrictionForClasses(p.property?.getRestrictedClasses() || [])}
        value={extraClasses}
        onChange={updateClasses}/>
    </Form.Group>
  }

  const { groupDefs, nonShapeProperties, loading: shaclLoading, error: shaclError, jsonProps: baseJsonProps } =
    useShacl(shapeDef, subGraph)

  const [jsonAdds, setJsonAdds] = useState<{[k:string]: string[]}>({})
  const jsonProps = useMemo(() => {
    const newProps = {...baseJsonProps}
    Object.keys(jsonAdds).map((k) => {
      newProps[k] = [ ...(newProps[k]||[]), ...jsonAdds[k] ]
    })
    return newProps
  }, [baseJsonProps, jsonAdds])

  useEffect(() => {
    console.log("RY SET BASE", editing, baseManuallySet, subjectSuggesters)
    if ( editing && !baseManuallySet && subjectSuggesters.length > 0 ) {
      let newSubject : string
      try {
        const parent = graph.getParentFocus()
        console.log("GOT GRAPH", graph, parent)
        if ( parent !== null ) {
          newSubject = subjectSuggesters[0](parent, jsonProps)
        } else {
          return
        }
      } catch ( e ) {
        console.warn("Ignored subject suggestion because of error", e)
        return
      }
      if ( newSubject != base.value ) {
        console.log("SET BASE", newSubject)
        updateBase(N3.DataFactory.namedNode(newSubject), false)
      }
    }
  }, [editing, baseManuallySet, jsonProps, subjectSuggesters])


  function setOrCreatePatch(p: PropertyValue, key: string): (g: GraphFragment | N3.Quad_Object) => void {
    return (g) => {
      let patch: GraphFragment
      if ( g instanceof N3.NamedNode ||
        g instanceof N3.BlankNode ||
        g instanceof N3.Literal ||
        g instanceof N3.Variable ) {
          patch = p.targets.replacePatch(g)
        } else {
          patch = g
        }
      setPatch(key)(patch)

      const json = p.property.getJsonProperty()

      if ( json !== null && patch.bases !== undefined ) {
        const bases = patch.bases
        setJsonAdds((adds) => {
          return { ...adds, [json]: bases.map((b) => b.value) }
        })
      }
    }
  }

  let props = <></>
  if ( shaclLoading ) {
    props = <Loading/>
  } else {
    let groups = groupDefs.map((g) => {
      let header = <></>
      if ( g.name !== undefined ) {
        header = <h3>{g.name}</h3>
      }
      function makeProp(p: PropertyValue): ReactNode {
        let term : N3.NamedNode | null = null
        if (p.property.path?.type == 'property' &&
          p.property.path?.property instanceof N3.NamedNode )
          term = p.property.path.property
      let values: IdentifiedObject[] = p.value
        const key = p.property.shape.id
        console.log("DETAIL VIEW", graph, p.targets)
    return <GraphContext.Provider key={key} value={p.targets}>
          <DetailPropertyView predicate={p.property.getName()}
      predicateTerm={term} values={values} property={p.property} editing={editing || false} onChange={setOrCreatePatch(p, key)}/>
        </GraphContext.Provider>
      }
      return <section>
        {header}
        {g.properties.map(makeProp)}
      </section>
    })
    props = <>{groups}</>
  }

  let resourceLink: ReactNode
  if ( p.editing ) {
    resourceLink = <LabelChooser classes={extraClasses} onChange={updateBase} value={base as any}/>
  } else {
    resourceLink = <div><ResourceLink to={p.term?.value || ""}>{p.term?.value}</ResourceLink></div>
  }

  return (<Card>
    <Card.Body>
      <ActionDropdown actions={actions} focusNode={base}/>
      <Form.Group>
        <Form.Label>Resource</Form.Label>
        {resourceLink}
      </Form.Group>
      {classSelector}
      <GraphContext.Provider value={subGraph}>
        {props}
      </GraphContext.Provider>
    </Card.Body>
  </Card>)
}

export default function DetailsViewer(p: Props) {
  return <FocusNode resource={p.term || null}>
    <DetailsViewerInner {...p}/>
  </FocusNode>
}

export function DetailPropertyView(p: PropertyValueProps) {
  const { content, addButton,predicate } = usePropertyView(p)
  return <Form.Group>
    <Form.Label>{predicate}</Form.Label>
    {content}
    {addButton}
  </Form.Group>
}

interface LabelChooserProps {
  value: N3.Quad_Subject,
  classes: N3.NamedNode[],
  onChange?(t: N3.Term): void
}
interface LabelOption {
  id: string,
  label: string,
  value: string,
  iri?: string
}

const BLANK_MARKER = "urn:com:f-omega:ld:_blank"

export function LabelChooser({classes, value, onChange}: LabelChooserProps) {
  const { runSparql } = useSparql()
  const graph = useGraph()
  const pending = useRef<((ts: LabelOption[]) => void)[]>([])
  const chosen = { id: value.id, label: value.value, value: value.value, iri: value.value }

  async function lookupExisting(t: string) {
    const result = await runSparql(`PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT DISTINCT ?s ?label WHERE {
      { ?s ?p ?o } UNION { ?o ?p ?s }.
      ?s dcterms:title|rdfs:label ?label.
      FILTER(isIRI(?s) && (CONTAINS(LCASE(STR(?s)), '${t.toLowerCase()}') || CONTAINS(LCASE(?label), '${t.toLowerCase()}')))
      } LIMIT 10`)
    const ret = [
      { id: "_blank", label: "New Blank Node", value: BLANK_MARKER },
      { id: t, iri: t, label: t, value: t }
    ]
    if ( isSelectResult(result) ) {
      const ctxt = new SparqlResultContext()
      for ( const r of result.results.bindings ) {
        const subject = ctxt.toN3(r.s)
        const label = r.label ? ctxt.toN3(r.label).value : subject.value
        if ( subject.termType != 'NamedNode' ) continue
        ret.push({id: subject.id, label, value: subject.value})
      }
    }
    return ret
  }
  const debouncedLookup = useDebouncedCallback((t: string) => {
    const resolving = pending.current
    pending.current = []
    lookupExisting(t).then((ts) => {
      for ( const p of resolving ) {
        p(ts)
      }
    }).catch((e) => {
      console.error("Could not fetch", e)
      for ( const p of resolving ) {
        p([])
      }
    })
  }, 500)

  function queueLookup(t: string): Promise<LabelOption[]> {
    return new Promise((resolve, reject) => {
      pending.current.push(resolve)
      debouncedLookup(t)
    })
  }

  function changeBase(v: SingleValue<LabelOption>) {
    if ( v ) {
      let nextTerm: N3.Term
      if ( v.value == BLANK_MARKER ) {
        nextTerm = N3.DataFactory.blankNode()
      } else {
        nextTerm = N3.DataFactory.namedNode(v.value)
      }

      if ( onChange )
        onChange(nextTerm)

//      setChosen(v)
    }
  }

  function mkNewOption(s: string) {
    return {id: s, label: s, value: s}
  }

  return <Select value={chosen}
    loadOptions={queueLookup}
    onChange={changeBase}
    allowCreateWhileLoading
    createOptionPosition="first"
    getNewOptionData={mkNewOption}
  />
}
