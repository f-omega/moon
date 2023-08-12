import { Card, Row, Col, Nav, Button, Container, Modal, Collapse } from 'react-bootstrap'
import { useMemo, ReactNode, useEffect, useState } from 'react'
import N3 from 'n3'
import Drawer from 'react-modern-drawer'
import 'react-modern-drawer/dist/index.css'
import saveBarStyles from './SaveBar.module.css'
import styles from './ResourceViewer.module.css'
import { toast } from 'react-toastify'

import * as util from '../sparql/common'
import * as shacl from '../sparql/shacl'
import Predicate from './Predicate'
import ObjectViewer from './Object'
import { GraphContext, GraphFragment, GraphNavigator, useGraph, useGraphPatchEditor } from '../graph'
import { useSparql } from '../sparql/Provider'
import { useCache } from '../cache'
import NamedResourceLink from './NamedResourceLink'
import PropertyView from './PropertyView'
import { isSelectResult, SparqlResult, SparqlResultContext, TypedSparqlResult, VarBinding, VarBindingResult } from '../sparql/types'
import Loading from './Loading'
import { PropertyShape } from '../sparql/shacl'
import { useActions, WithActions } from './Actions'
import { SparqlPatch, renderSparqlUpdateToString, PatchEditor } from '../sparql/patch'
import ActionDropdown from './ActionDropdown'
import ResourceSelector from './ResourceSelector'
import { RDFS_CLASS, RDF_TYPE } from '../common/util'

interface Props {
  resource: string,
  creating?: boolean,
  editing?: boolean,
  onSaved?: () => void,
  updateTermUri?: (newIri: string) => void,
  graphEditor: PatchEditor<GraphNavigator>
}

interface SaveBarProps {
  show?: boolean,
  children: ReactNode
}

const DetailView = 'https://ld.f-omega.com/moon/view/detail'
const MetaView = 'https://ld.f-omega.com/moon/view/meta'

function SaveBar({show, children}: SaveBarProps){
  if ( show ) {
    return <div className={saveBarStyles.savebar}>
      {children}
    </div>
  } else {
    return <></>
  }
}

const CLASSES_KEY = "#$##$CLASSES"

export default function ResourceViewer({resource, creating, editing, onSaved, updateTermUri, graphEditor}: Props) {
  const graph = useGraph()
  const cache = useCache()
  const sparql = useSparql()

  const [types, setTypes] = useState<N3.NamedNode[]>([]) // For creation only
  const [detailView, setDetailView] = useState<string>(DetailView)

  function updateTypes(ts: N3.NamedNode[]) {
    setTypes(ts)
    graphEditor.setPatch(CLASSES_KEY)(graph.explorePredicates(RDF_TYPE).replacePatch(ts))
  }

  const extraGraph = useMemo(() => {
    const graph = new N3.Store()
    const me = N3.DataFactory.namedNode(resource)
    types.map((t) => {
      graph.addQuad(me, RDF_TYPE, t)
    })
    return graph
  }, [resource, types])

  const [shapeDef, shapeError] = shacl.useShapeDef(resource, extraGraph)
  console.log("RESOURCE SHAPES", shapeDef)

  let mainView = <DetailViewer graphEditor={graphEditor} resource={resource} shapes={shapeDef} editing={editing} onSaved={onSaved} creating={creating}
    types={types} setTypes={updateTypes} updateTermUri={updateTermUri}/>
  if ( detailView == MetaView ) {
    mainView = <MetaViewer resource={resource} shapes={shapeDef}/>
  }

  return (<Card className={editing || creating ? styles.editing : ''}>
    <Nav variant="tabs" activeKey={detailView} onSelect={(s) => { if (s !== null) setDetailView(s) }}>
        <Nav.Item><Nav.Link eventKey={DetailView}>Detail</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey={MetaView}>Meta</Nav.Link></Nav.Item>
      </Nav>
    <Card.Body>
      <main>
        {mainView}
      </main>
    </Card.Body>
  </Card>)
}

type DetailProps = Props & {
  shapes: shacl.NodeShape[], types: N3.NamedNode[], setTypes: (n: N3.NamedNode[]) => void,
  graphEditor: PatchEditor<GraphNavigator> }
interface GroupSpecDef<P = PropertyValue> {
  order: number,

  name?: string,
  description?: string,
  properties: P[]
}

interface PropertyDef {
  order: number,

  name?: string,
  description?: string,

  property: N3.Term,
  graph: N3.Store,

  path: shacl.ShaclPath,

  group?: N3.Term,
}

type PropertyValue = { property: PropertyShape, order: number, name: string | null, value: N3.Quad_Object[] }
type PropertyValueOrFuture =  { property: PropertyShape, order: number, name: string | null, value: N3.Quad_Object[] | number }

interface EditingProps {
  editing: boolean,
  onChange: (p: GraphFragment) => void
}

export function DetailViewer({resource, shapes, editing, creating, types, setTypes, onSaved, graphEditor}: DetailProps) {
  const graph = useGraph()
  const sparql = useSparql()
  const actions = useActions(shapes)

  const { patch, setPatch, clearPatch, nonEmpty: edited, rebasePatch } = graphEditor

  //  const [ patch, setPatch ] = useState<SparqlPatch<GraphNavigator> | null>(null)
  const [ saving, setSaving ] = useState<boolean>(false)
  const [ showSparql, setShowSparql ] = useState<boolean>(false)
  const [ latestSparql, setLatestSparql ] = useState<string | null>(null)

//  const edited = patch !== null && Object.keys(patch).length > 0

  function saveChanges() {
    if ( edited && patch !== null ) {
      setSaving(true)
      renderSparqlUpdateToString(Object.values(patch)).then(async (s) => {
        console.log("UPDATE", s)
        try {
          if ( s !== null) {
            await sparql.updateSparql(s)
          }
          toast.success("Saved changes")
          if ( onSaved ) onSaved();
        } catch (e) {
          toast.error(`Could not save changes: ${e}`)
        }
      }).finally(() => {
        setSaving(false)
      })
    }
  }

  const { groupDefs, nonShapeProperties, loading: shaclLoading, error: shaclError } = shacl.useShacl(shapes, graph)
//  console.log("SHACL", groupDefs, nonShapeProperties)

  useEffect(() => {
    clearPatch()
  }, [editing])

  let props = <></>
  if ( shaclLoading ) {
    props = <Loading/>
  } else {
    const shaclProps: ReactNode = groupDefs.map((g) => {
      const groupName = g.name === undefined ? [] : <h3 className="property-group">{g.name}</h3>;
      const properties = g.properties.map((p) => {
        let values : shacl.IdentifiedObject[] = p.value

        const key = p.property.path?.type == 'property' ? p.property.path.property.value : (p.property.path ? shacl.pathToSparql(p.property.path) : p.property.shape.value);

        const editingProps: EditingProps = {
          editing: editing || creating || false,
          onChange: setPatch(key)
        }

        let predicateTerm : N3.Quad_Predicate | null = null
        if ( p.property.path?.type == 'property' ) {
          // @ts-ignore
          predicateTerm = p.property.path.property
        }

        let propView: ReactNode
        if ( p.name === undefined || p.name === null ) {
          if ( p.property.path?.type == 'property' ) {
            // @ts-ignore
            propView = <PropertyView key={key} predicate={p.property.path.property.value} predicateTerm={predicateTerm} values={values}
              property={p.property} {...editingProps}/>
          } else {
            propView = <PropertyView key={key} predicate={key} values={values} predicateTerm={predicateTerm}
              property={p.property} {...editingProps}/>
          }
        } else {
          propView = <PropertyView key={key} predicate={p.name} values={values} predicateTerm={predicateTerm}
            property={p.property} {...editingProps}/>
        }

        return <GraphContext.Provider value={p.targets}>{propView}</GraphContext.Provider>
      })

      return <section className="property-group-section">
        {groupName}
        <Container>
          {properties}
        </Container>
      </section>
    })

  const nonShaclProps = <section className="non-shacl property-group-section">
      <h3 className="property-group">Non-SHACL properties</h3>
      <Container>
        {nonShapeProperties.map((p) => {
          return <GraphContext.Provider value={p.targets}>
            <PropertyView key={`nonshacl ${p.property.value}`} predicate={p.property} values={p.values}
              predicateTerm={p.property}
              editing={editing || creating || false}/>
          </GraphContext.Provider>
        })}
    </Container>
    </section>

    props = <>{shaclProps}{nonShaclProps}</>
  }

  let creatingProps = <></>
  if ( creating ) {
    creatingProps = <>
    <Row>
        <Col lg={5} className="property">Class</Col>
        <Col lg={7}>
          <ResourceSelector multiple restriction={`?s a <${RDFS_CLASS.value}>`} canAddMore value={types} onChange={(tys) => setTypes(tys)} searchShapes/>
        </Col>
    </Row>
    </>
  }

  let sparqlTxt = <Loading/>
  useEffect(() => {
    if ( showSparql ) {
      renderSparqlUpdateToString(Object.values(patch)).then((s) => setLatestSparql(s))
    }
  }, [showSparql, patch])

  if ( showSparql && latestSparql ) {
    sparqlTxt = <pre style={{maxWidth: '100em', overflow: 'auto'}}>{latestSparql}</pre>
  }

  return <WithActions shapes={shapes} makeGraph={() => { throw new TypeError("Not implemented") }}>
    <ActionDropdown actions={actions} focusNode={N3.DataFactory.namedNode(resource)}/>
    <section className="property-viewer">
      {creatingProps}
      {props}
    </section>

    <SaveBar show={editing || creating}>
      <Collapse in={showSparql}>
        {sparqlTxt}
      </Collapse>
      {saving?<><Loading/>Saving...</>:<></>}
      <Button disabled={saving || !edited} onClick={() => { setShowSparql(true); setLatestSparql(null) }} variant="secondar">View SPARQL</Button>
      <Button disabled={saving || !edited} onClick={saveChanges} variant="success">Save Changes</Button>
    </SaveBar>
  </WithActions>
}

interface MetaProps {
  resource: string
  shapes: shacl.NodeShape[]
}

export function MetaViewer({resource, shapes}: MetaProps) {
  let shapeUris = shapes.map((s) => s.shape?.value).flatMap((a) => a !== undefined ? [a] : [])

  let shapeEls = (
    <ul>
      {shapeUris.map((s) => <li><NamedResourceLink iri={s}/></li>)}
    </ul>)
  if ( shapeUris.length == 0 ) {
    shapeEls = <div><em>No shapes found</em></div>
  }

    return <section className="meta-view">
      <Row className="property mt-2" key="shapes">
        <Col lg={5} className="property">Shapes</Col>
        <Col lg={7}>
          {shapeEls}
          <Button variant="secondary" size="sm">Add new shape</Button>
        </Col>
      </Row>
    </section>
}
