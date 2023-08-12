import { createContext, ReactNode, useContext, useMemo } from 'react'
import N3 from 'n3'
import { useSparql } from '../sparql/Provider'
import { NodeShape, PropertyShape } from '../sparql/shacl'
import { getProperty, MOON_ACTION, MOON_BUTTON_ACTION, MOON_CHANGE_TRIGGER, MOON_CLICK_TRIGGER, MOON_CLIENT_SCRIPT, MOON_LABEL, MOON_SERVER_SCRIPT, MOON_TRIGGER, RDF_TYPE, XSD_STRING } from '../common/util'
import sha256 from 'js-sha256'

export type Actions = Partial<ActionDef>
export interface ActionDef {
  change: Action[],
  click: Action[],
  button: Action[]
}
export interface Action {
  label?: string,
  iri?: string,
  clientScript?: string,
  serverScript: boolean
}

export type TriggerActions = (a: Actions, action: keyof ActionDef, values: N3.Term[], options?: ActionOptions) => void

interface ActionOptions {
  focusNode?: N3.Term,
  control?: ControlInterface
}

interface ControlInterface {
  status(html: string): void
}

export interface ActionContext {
  triggerActions: TriggerActions
}

export type ServerResult = ServerFailure | ServerSuccess

export interface ServerFailure {
  success: false,
  error: any
}

export interface ServerSuccess {
  success: true,
  body: any
}

const ActionContext = createContext<ActionContext>({
  triggerActions: () => {}
})

export function useActionContext(): ActionContext {
  return useContext(ActionContext)
}

interface WithActionProps {
  shapes: NodeShape[],
  makeGraph: () => N3.Store,
  children: ReactNode
}

class ServerFailsException {
  statusCode: number
  statusText: string
  body: any

  constructor(status: number, statusText: string, body: any ) {
    this.statusCode = status
    this.statusText = statusText
    this.body = body
  }
}

function genAnonActionUri(script: string) {
  const hash = sha256.sha256.hex(script)
  return `urn:com:f-omega:moon:action:${hash}`
}

async function runServer(dataset: string, a: Action, values: N3.Term[], focusNode?: N3.Term): Promise<void> {
  if ( a.iri === undefined ) {
    throw new TypeError('Cannot invoke action on server without iri')
  }
  const r = await fetch(`/.moon/action`,
    { method: 'POST', headers: { 'Content-type': 'application/json' },
      body: JSON.stringify({dataset, action: a.iri, values, focus: focusNode?.termType == 'NamedNode' ? focusNode.value : null })})
  if ( r.ok ) {
    const data = await r.json()
    console.log("GOT RESPONSE", data)
    return data
  } else {
    const body = await r.json()
    try {
      const message = JSON.parse(body)
      throw new ServerFailsException(r.status, r.statusText, message)
    } catch (e) {
      throw new ServerFailsException(r.status, r.statusText, body)
    }
  }
}

export async function runAction(dataset: string, a: Action, values: N3.Term[], options: ActionOptions={}): Promise<void> {
  let serverResult: ServerResult | undefined = undefined
  if ( a.serverScript ) {
    try {
      const r = await runServer(dataset, a, values, options.focusNode)
      serverResult = { success: true, body: r }
    } catch (e) {
      serverResult = { success: false, error: e }
    }
  }

  if ( a.clientScript ) {
    const fn = new Function("e", "server", "focus", "control", a.clientScript);
    fn({server: serverResult, args: values}, serverResult, options.focusNode, options.control)
  }
}

export function WithActions(p: WithActionProps) {
  const { dataset } = useSparql()
  function triggerActions(a: Actions, action: keyof ActionDef, values: N3.Term[], options?: ActionOptions) {
    const queue = a[action]
    if ( queue === undefined ) return;

    queue.map((a) => runAction(dataset, a, values, options))
  }
  return <ActionContext.Provider value={{triggerActions}}>
    {p.children}
  </ActionContext.Provider>
}

export function parseActions(shape: NodeShape | PropertyShape): Actions {
  const graph = shape.graph
  if ( shape.shape === undefined ) {
    return {}
  }
  const actions = graph.getQuads(shape.shape, MOON_ACTION, null, null)
  let ret: ActionDef = { change: [], click: [], button: [] }
  for ( const a of actions ) {
    if ( a.object.termType != 'BlankNode' &&
      a.object.termType != 'NamedNode') continue;

    let types: (keyof ActionDef)[] = []
    if ( graph.has(N3.DataFactory.triple(a.object, RDF_TYPE, MOON_BUTTON_ACTION)) ) {
      types.push('button')
    }

    if ( graph.has(N3.DataFactory.triple(a.object, MOON_TRIGGER, MOON_CLICK_TRIGGER)) ) {
      types.push('click')
    }
    if ( graph.has(N3.DataFactory.triple(a.object, MOON_TRIGGER, MOON_CHANGE_TRIGGER)) ) {
      types.push('change')
    }

    let action: Action = { serverScript: false }
    if ( a.object.termType == 'NamedNode' ) {
      action.iri = a.object.value
      if ( graph.getQuads(a.object, MOON_SERVER_SCRIPT, null, null).length > 0 ) {
        action.serverScript = true
      }
    } else {
      const script = getProperty(graph, a.object, MOON_SERVER_SCRIPT, {literal: true, expectedType: XSD_STRING})
      if ( script !== null ) {
        action.serverScript = true
        action.iri = genAnonActionUri(script)
      } else {
        action.serverScript = false
      }
    }

    action.label = getProperty(graph, a.object, MOON_LABEL, {literal: true, expectedType: XSD_STRING}) || undefined

    for ( const s of graph.getQuads(a.object, MOON_CLIENT_SCRIPT, null, null) ) {
      if ( s.object.termType != 'Literal' ) continue;
      action.clientScript = s.object.value
      break;
    }

    for ( const t of types ) {
      ret[t].push(action)
    }
  }

  return ret
}

function concatActions(actions: Actions[]): Action {
  let d: ActionDef = {
    change: [],
    click: [],
    button: []
  }

  for ( const a of actions ) {
    d.change = [...d.change, ...(a.change || [])]
    d.click = [...d.click, ...(a.click || [])]
    d.button = [...d.button, ...(a.button || [])]
  }

  for ( const k of Object.keys(d) ) {

    // @ts-ignore
    if ( d[k].length == 0 )
    // @ts-ignore
      delete d[k]
  }

  // @ts-ignore
  return d
}

type SingleOrMultiple<X> = X | X[]

export function useActions(shapes?: SingleOrMultiple<PropertyShape | NodeShape>) {
  // Retrieve all actions from the property object
  return useMemo(() => {
    if ( shapes !== undefined ) {
      const shapeArray = Array.isArray(shapes) ? shapes : [ shapes ]
      return concatActions(shapeArray.map(parseActions))
    } else {
      return {}
    }
  }, [shapes]);
}
