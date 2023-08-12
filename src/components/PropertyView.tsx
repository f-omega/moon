import N3 from 'n3'
import { Row, Col, Button } from 'react-bootstrap'
import { BsNodePlus, BsDashCircle } from 'react-icons/bs'
import randomstring from 'randomstring'

import ObjectViewer from './Object'
import PropertyTable from './PropertyTable'
import Predicate from './Predicate'
import Loading from './Loading'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { MOON_EDITABLE, RDF_FALSE } from '../sparql/common'
import { IdentifiedObject, PropertyShape } from '../sparql/shacl'
import { DASH_INSTANCES_SELECT_EDITOR, DASH_VALUE_TABLE_VIEWER, MOON_GEO_EDITOR, MOON_GEO_VIEWER } from '../sparql/dash'
import { editorHandlesMultiples } from '../sparql/dash'
import { concatPatchFragmentsRebasable, RebasablePatchFragment, SparqlPatch } from '../sparql/patch'

import styles from './PropertyView.module.css'
import GeoViewer from './GeoViewer'
import { GraphNavigator, GraphFragment, GraphPatch, useGraph, useGraphPatchEditor } from '../graph'
import InstancesSelectEditor from './InstancesSelectEditor'

export interface PropertyValueProps {
  predicate: N3.NamedNode | string,
  predicateTerm: N3.Quad_Predicate | null,

  values?: IdentifiedObject[] | null,
  editing: boolean,
  property?: PropertyShape,
  onChange?(p: N3.Quad_Object | GraphFragment): void
}

export interface PropertyView {
  content: ReactNode,
  addButton: ReactNode,
  predicate: ReactNode
}

export interface AggViewerProps {
  aggregate: true,
  predicate: N3.Quad_Predicate | null,
  terms: N3.Quad_Object[],
  property?: PropertyShape,
  onChange?: (n: N3.Quad_Object[] | GraphFragment) => void,
  editing: boolean
}

const AGGREGATE_VIEWERS: { [nm: string]: (p: AggViewerProps) => ReactNode } = {
  [MOON_GEO_VIEWER.value]: (p: AggViewerProps) => <GeoViewer />,
  [MOON_GEO_EDITOR.value]: (p: AggViewerProps) => <GeoViewer editing/>,
  [DASH_INSTANCES_SELECT_EDITOR.value]: (p: AggViewerProps) => <InstancesSelectEditor {...p}/>
}

export function usePropertyView({predicate, predicateTerm, values, property, editing, onChange}: PropertyValueProps): PropertyView {
  // Check the cardinality

  const graph = useGraph()
  const gatedEditing = (property ? property.editable : true) && editing
  const globalViewer = property?.getViewer(gatedEditing)
  const [ editingValues, setEditingValues ] = useState<N3.Quad_Object[]|null>(null)
  const [ adding, setAdding ] = useState<string[]>([])
  const { patch, setPatch, clearPatch } = useGraphPatchEditor(onChange)
  const [ show, setShow ] = useState<boolean>(false)

  const [minCount, maxCount] = useMemo(() => {
    if ( property ) {
      return property.getCountLimits()
    } else {
      return [null, null]
    }
  }, [property])

  useEffect(() => {
    setEditingValues(editing ? (values?.map((v) => v.node) || null) : null)
    setAdding([])
    clearPatch()
  }, [editing])

  function renderRemoveButton(doRemove: () => void) {
    return <Button className="float-right" size="sm" variant="link" onClick={doRemove}><BsDashCircle/></Button>
  }

  function removeButton(n: N3.Quad_Object) {
    function removeItem(savedPatch: GraphPatch, savedTerm: N3.Quad_Predicate) {
      const fragment = graph.replacePatch([])
      setEditingValues((vs) => (vs?.filter((e) => e != n)) || null)
      setPatch(n.id)(fragment)
    }

    if ( gatedEditing && patch && predicateTerm ) {
      const savedPatch = patch
      const savedTerm = predicateTerm
      return renderRemoveButton(() => removeItem(savedPatch, savedTerm))
    } else {
      return <></>
    }
  }

  function removeAdding(a: string, patchKey: string) {
    function removeItem(savedPatch: GraphPatch, savedTerm: N3.Quad_Predicate) {
      const fragment = graph.replacePatch([])
      setAdding((as) => as.filter((x) => x != a))
      setPatch(patchKey)(fragment)
    }

    if ( gatedEditing && patch && predicateTerm ) {
      const savedPatch = patch
      const savedTerm = predicateTerm
      return renderRemoveButton(() => removeItem(savedPatch, savedTerm))
    } else {
      return <></>
    }
  }

  const activeValues = editing ? editingValues : values?.map((v) => v.node);

  function addOne() {
    // Add one more object to this subject-property pair

    // Collect the node shape from the property, if any.
    let id = randomstring.generate()
    setAdding([...adding, id])
  }

  let addButton = <></>, addingObjects: ReactNode[] = []
  let remaining = Infinity;
  let showAddButton = true
  if ( globalViewer && globalViewer.equals(DASH_INSTANCES_SELECT_EDITOR) )
    showAddButton = false;
  if ( maxCount !== null )
    remaining = Math.max(0, maxCount - (editingValues || values || []).length)

  if ( remaining > 0 && showAddButton ) {
    addButton = <Button size="sm" variant="link" onClick={addOne}><BsNodePlus/> Add</Button>
  }

  if ( gatedEditing ) {

    addingObjects = adding.map((a) => {
      const key = `add-${a}`
      return <>{removeAdding(a, key)}<ObjectViewer key={key} predicate={predicateTerm} editing property={property} term={null} onChange={setPatch(key)}/></>
    })
  }

  let content = <></>
  if ( activeValues === null || activeValues === undefined ) {
    content = <Loading/>
  } else if ( property !== undefined && property.isLazy() && !show ) {
    content = <div className="object object-lazy"><Button variant="secondary" onClick={() => setShow(true)}>Show</Button></div>
  } else if (
      property !== undefined && globalViewer &&
        (property.isAggregateView() || editorHandlesMultiples(globalViewer)) &&
        AGGREGATE_VIEWERS[globalViewer.value]
    ) {
    const Viewer = AGGREGATE_VIEWERS[globalViewer.value]
    const props: AggViewerProps = {
      editing: gatedEditing,
      predicate: predicateTerm,
      property,
      terms: activeValues,
      aggregate: true,
      onChange: onChange === undefined ? undefined : (q) => {
        let patch: GraphFragment
        if ( Array.isArray(q) ) {
          patch = graph.replacePatch(q)
        } else {
          patch = q
        }
        onChange(patch)
      }
    }
    content = <div className="object object-aggregated">
      {Viewer(props)}
    </div>
  } else if ( (activeValues.length + adding.length) == 0 ) {
    content = <div className="object object-empty">{addButton}</div>
    addButton = <></>
  } else if ( (activeValues.length + adding.length) == 1 ) {
    if ( activeValues.length > 0 ) {
      const key = `${predicateTerm?.id} ${activeValues[0].id}`
      content = <div className={`object ${styles.objectSingle}`}>
        {removeButton(activeValues[0])}
        <ObjectViewer key={key} predicate={predicateTerm} property={property} term={activeValues[0]} onChange={setPatch(key)} editing={gatedEditing}/>
      </div>
    } else {
      content = <div className="object object-single">
        {addingObjects}
      </div>
    }
  } else {
    content = <div className={`object ${styles.objectMultiple}`}>
      <ul>
        {activeValues.map((v) => {
          const key = `${predicateTerm?.id} ${v.id}`
          return <li>{removeButton(v)}<ObjectViewer key={key} predicate={predicateTerm} property={property} term={v} editing={gatedEditing} onChange={setPatch(key)}/></li>
        })}
        {addingObjects.map((v) => <li>{v}</li>)}
      </ul>
    </div>
  }

  if ( globalViewer && property !== undefined ) {
    if ( globalViewer.equals(DASH_VALUE_TABLE_VIEWER) ) {
      content = <div className="object object-table">
        <PropertyTable values={activeValues || []} property={property} editing={gatedEditing}/>
      </div>
    }
  }

  const predicateView = typeof predicate == 'string' ? predicate : <Predicate predicate={predicate}/>
  return { content, addButton, predicate: predicateView }
}

export default function PropertyView(props: PropertyValueProps) {
  const { content, addButton, predicate } = usePropertyView(props)
  return <Row>
    <Col lg={5} className="property">{predicate}</Col>
    <Col lg={7}>
      {content}
      {addButton}
    </Col>
  </Row>
}

