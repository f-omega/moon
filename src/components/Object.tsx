import { Form, Badge, InputGroup } from 'react-bootstrap'
import { useEffect, useMemo, useState, ReactNode, MouseEvent, ChangeEvent, useCallback } from 'react'

import N3 from 'n3'

import NamedResourceLink from './NamedResourceLink'
import GeoViewer from './GeoViewer'

import { useDebouncedCallback } from 'use-debounce'
import { BASE_EDITORS, DASH_AUTO_COMPLETE_EDITOR, DASH_BLANK_NODE_VIEWER, DASH_DETAILS_VIEWER, DASH_HTML_VIEWER, DASH_HYPERLINK_VIEWER, DASH_IMAGE_VIEWER, DASH_LABEL_VIEWER, DASH_LANGSTRING_VIEWER, DASH_LITERAL_VIEWER, DASH_TEXT_FIELD_WITH_LANG_EDITOR, DASH_URI_VIEWER, DASH_VALUE_TABLE_VIEWER, MOON_ANY_VIEWER, MOON_GEO_VIEWER, MOON_GEO_EDITOR, rankWidgets, DASH_TEXT_FIELD_EDITOR, DASH_DETAILS_EDITOR, MOON_CODE_EDITOR, MOON_CODE_VIEWER, DASH_INSTANCES_SELECT_EDITOR, DASH_BOOLEAN_SELECT_EDITOR } from '../sparql/dash'
import ResourceLink from './ResourceLink'
import { PropertyShape } from '../sparql/shacl'
import { useSparql } from '../sparql/Provider'
import { isSelectResult, SparqlResultContext } from '../sparql/types'
import AutoCompleteEditor from './AutoCompleteEditor'
import { CodeViewer, CodeEditor } from './CodeEditor'
import DetailsViewer from './DetailsViewer'
import { PatchFragment, SparqlPatch, renderSparqlUpdateToString } from '../sparql/patch'
import { interpretLiteral, MOON_ACTION, MOON_BUTTON_ACTION, MOON_CHANGE_TRIGGER, MOON_CLICK_TRIGGER, MOON_CLIENT_SCRIPT, MOON_SERVER_SCRIPT, MOON_TRIGGER, RDF_TYPE, XSD_BOOLEAN, XSD_STRING } from '../sparql/common'
import { Action, ActionDef, Actions, useActionContext, useActions } from './Actions'
import { GraphFragment, useGraph } from '../graph'
import ActionDropdown from './ActionDropdown'
import ResourceSelector from './ResourceSelector'
import InstancesSelectEditor from './InstancesSelectEditor'

interface Props {
  term: N3.Quad_Object | null,
  predicate: N3.Quad_Predicate | null,
  onChange?(p: GraphFragment): void,
  editing?: boolean,
  property?: PropertyShape,
}

export interface ViewerProps {
  aggregate: false,
  predicate: N3.Quad_Predicate | null,
  term: N3.Quad_Object | null,
  property?: PropertyShape,
  onChange?: (n: N3.Quad_Object | GraphFragment) => void,

  actions: Actions
}

const VIEWERS: { [nm:string]: (p: ViewerProps) => ReactNode } = {
  [DASH_BLANK_NODE_VIEWER.value]: (p: ViewerProps) => <TodoViewer name="BlankNode" {...p}/>,
  [DASH_DETAILS_VIEWER.value]: (p: ViewerProps) => <DetailsViewer {...p}/>,
  [DASH_DETAILS_EDITOR.value]: (p: ViewerProps) => <DetailsViewer editing {...p}/>,
  [DASH_HTML_VIEWER.value]: (p: ViewerProps) => <TodoViewer name="HTML" {...p}/>,
  [DASH_HYPERLINK_VIEWER.value]: (p: ViewerProps) => p.term !== null ? <ResourceLink to={p.term.value}>{p.term.value}</ResourceLink> : <></>,
  [DASH_IMAGE_VIEWER.value]: (p: ViewerProps) => <TodoViewer name="Image" {...p}/>,
  [DASH_LABEL_VIEWER.value]: (p: ViewerProps) => p.term === null ? <></> : <NamedResourceLink iri={p.term.value} reveal/>,
  [DASH_LANGSTRING_VIEWER.value]: (p: ViewerProps) => p.term === null ? <></> : <Literal value={p.term.value} language={p.term.termType == "Literal" ? p.term.language : undefined}/>,
  [DASH_LITERAL_VIEWER.value]: (p: ViewerProps) => p.term === null ? <></> : <Literal value={p.term.value}/>,
  [DASH_URI_VIEWER.value]: (p: ViewerProps) => p.term === null ? <></> : <ResourceLink to={p.term.value}>{p.term.value}</ResourceLink>,
//  [DASH_VALUE_TABLE_VIEWER.value]: (p: ViewerProps) => <TodoViewer name="ValueTable" {...p}/>,
  [MOON_ANY_VIEWER.value]: (p: ViewerProps) => <AnyViewer {...p}/>,
  [DASH_INSTANCES_SELECT_EDITOR.value]: (p: ViewerProps) => <InstancesSelectEditor {...p}/>,

  [DASH_AUTO_COMPLETE_EDITOR.value]: (p: ViewerProps) => <AutoCompleteEditor {...p}/>,
  [DASH_TEXT_FIELD_WITH_LANG_EDITOR.value]: (p: ViewerProps) => <TextFieldEditor includeLanguage {...p}/>,
  [DASH_TEXT_FIELD_EDITOR.value]: (p: ViewerProps) => <TextFieldEditor {...p}/>,
  [DASH_BOOLEAN_SELECT_EDITOR.value]: (p: ViewerProps) => <CheckBoxEditor {...p}/>,

  [MOON_CODE_EDITOR.value]: (p: ViewerProps) => <CodeEditor {...p}/>,
  [MOON_CODE_VIEWER.value]: (p: ViewerProps) => <CodeViewer {...p}/>,

  [MOON_GEO_VIEWER.value]: (p: ViewerProps) => <GeoViewer />,
  [MOON_GEO_EDITOR.value]: (p: ViewerProps) => <GeoViewer editing />,
}

export default function ObjectViewer({term, editing, property,  predicate, onChange}: Props) {
  const graph = useGraph()
  const viewer = useMemo(() => {
    if ( property !== undefined ) {
      const w = rankWidgets(property, term, BASE_EDITORS, editing)
      return w
    } else return []
  }, [property?.shape, editing])

  const actions = useActions(property)

  function getCurrentViewer() {
    if ( viewer.length > 0 ) return viewer[0]
    else {
      return MOON_ANY_VIEWER.value
    }
  }

  const [ currentViewer, setCurrentViewer ] = useState<string>(getCurrentViewer)

  useEffect(() => {
    setCurrentViewer(getCurrentViewer())
  }, [viewer])

  const onTermChange = useCallback((n: N3.Quad_Object | GraphFragment) => {
    if ( onChange === undefined ) return
    if (
      n instanceof N3.NamedNode ||
        n instanceof N3.BlankNode ||
        n instanceof N3.Literal ||
        n instanceof N3.Variable
    ) {
      onChange(graph.replacePatch(n))
    } else {
      onChange(n)
    }
  }, [graph, onChange])

  const viewerComp = VIEWERS[currentViewer] || ((p: ViewerProps) => <>Missing({currentViewer})<br/><AnyViewer {...p}/></>)
  const props: ViewerProps = { term, property, predicate, actions, aggregate: false }

  if ( onChange && editing ) {
    props.onChange = onTermChange
  }

  return <>{viewerComp(props)}</>
}

function AnyViewer({term}: ViewerProps) {
  if ( term === undefined ) {
    return <div>TERM</div>
  }
  if ( term === null ) {
    return <></>
  } else if ( term.termType == "BlankNode" ) {
    return <div>BLANK NODE TODO</div>
  } else if ( term.termType == "Literal" ) {
    const badges = []
    if ( term.language != '' ) {
      badges.push(<Badge bg="secondary">{term.language}</Badge>)
    }
    return <div className="literal">{badges}<div>{term.value}</div></div>
  } else if ( term.termType == "NamedNode" ) {
    return <NamedResourceLink iri={term} reveal/>
  } else if ( term.termType == "Variable" ) {
    return <>Variable</>
  }

  return <>Object</>
}

type TodoViewerProps = ViewerProps & { name: string }

function TodoViewer({name}:TodoViewerProps) {
  return <div>TODO {name}</div>
}

interface LiteralProps {
  value: string,
  language?: string
}

function Literal({value, language}: LiteralProps) {
  let badges = <></>
  if ( language !== undefined ) {
    badges = <span className="badge">{language}</span>
  }
  return <div className="literal">{value}{badges}</div>
}

interface TextFieldEditorProps extends ViewerProps {
  includeLanguage?: boolean
}

function TextFieldEditor(p: TextFieldEditorProps) {
  const { triggerActions } = useActionContext()
  const [ status, setStatus ] = useState<string|null>(null)
  const debouncedTrigger = useDebouncedCallback((actions,what,vs) => {
    triggerActions(actions, what, vs, {
      control: {
        status(html: string) {
          setStatus(html)
        }
      }
    })
  }, 500)

  function handleChange(e: ChangeEvent) {
    if ( p.onChange === undefined ) return;
    // @ts-ignore
    const value = e.target.value
    let datatype: N3.NamedNode = XSD_STRING
    if ( p.term && p.term.termType == 'Literal' && p.term.datatype )
      datatype = p.term.datatype
    const v = interpretLiteral(value, datatype)
    let nextValue: N3.Literal
    if ( v === null ) {
      nextValue = N3.DataFactory.literal(value, XSD_STRING)
    } else {
      nextValue = N3.DataFactory.literal(value, datatype)
    }
    p.onChange(nextValue)

    // Now trigger any actions
    debouncedTrigger(p.actions, "change", [nextValue])
  }

  return <div className="flex-grow-1">
    <InputGroup>
      <Form.Control defaultValue={p.term?.value || ""} onChange={handleChange}/>
      {p.includeLanguage?
      <Form.Select>
        <option value="en">en</option>
      </Form.Select>: <></>}
      {p.term !== null ? <ActionDropdown actions={p.actions} focusNode={p.term}/> : <></>}
    </InputGroup>
    {status !== null ?
    <div dangerouslySetInnerHTML={{ __html: status }} /> : <></>}
  </div>
}

interface CheckBoxEditorProps extends ViewerProps {
}

function CheckBoxEditor(p: CheckBoxEditorProps) {
  const { triggerActions } = useActionContext()
  const [ status, setStatus ] = useState<string|null>(null)
  const debouncedTrigger = useDebouncedCallback((actions,what,vs) => {
    triggerActions(actions, what, vs, {
      control: {
        status(html: string) {
          setStatus(html)
        }
      }
    })
  }, 500)

  const label = useMemo(() => {
    if ( p.property ) {
      return p.property.description || p.property.name
    } else {
      return ""
    }
  }, [p.property])

  function handleChange(e: ChangeEvent) {
    if ( p.onChange === undefined ) return;
    // @ts-ignore
    const value = e.target.checked
    let nextValue : N3.Literal
    if ( value ) {
      nextValue = N3.DataFactory.literal("true", XSD_BOOLEAN)
    } else {
      nextValue = N3.DataFactory.literal("false", XSD_BOOLEAN)
    }
    p.onChange(nextValue)

    debouncedTrigger(p.actions, "change", [nextValue])
  }

  return <div className="flex-grow-1">
    <Form.Check label={label} defaultChecked={p.term?.value == 'true'}
      onChange={handleChange}/>
    {status !== null ?
    <div dangerouslySetInnerHTML={{ __html: status }} /> : <></>}
  </div>
}
