import N3 from 'n3'
import { useMemo, useState } from "react"
import { Button, InputGroup } from "react-bootstrap"
import { useAddPopupContext } from './AddPopup'
import { ViewerProps } from "./Object"
import { AggViewerProps } from "./PropertyView"
import ResourceSelector from "./ResourceSelector"

export function objectsInClass(classes: string[]) {
  let classesRestriction = classes.map((cls) => `{ ?cls <http://www.w3.org/2000/01/rdf-schema#subClassOf>* <${cls}> }`).join(" UNION ")
  return `?s a ?cls.
  GRAPH ?g { ${classesRestriction} }`
}

export default function InstancesSelectEditor(p: ViewerProps | AggViewerProps) {
  const [ curValue, setValue ] =
    useState(() => ('term' in p ? (p.term ? [p.term] : []) : p.terms).flatMap((q) => q.termType == 'NamedNode' ? [q] : []))

  function updateValue(ns: N3.NamedNode[] | N3.NamedNode) {
    setValue(Array.isArray(ns) ? ns : [ns])
    if ( p.onChange !== undefined ) {
      console.log("SENDING CHANGE", ns)
      if ( p.aggregate ) {
        p.onChange(Array.isArray(ns) ? ns : [ns])
      } else {
        p.onChange(Array.isArray(ns) ? ns[0] : ns)
      }
    }
  }

  const [_, maxCount] = useMemo(() => {
    if ( p.property ) {
      return p.property.getCountLimits()
    } else {
      return [0, Infinity]
    }
  }, [p.property])
  const creatable = useMemo(() => {
    if ( p.property ) {
      return p.property.getCreatable()
    } else {
      return false
    }
  }, [p.property])

  const { openAddPopup } = useAddPopupContext()
  let addButton = <></>
  if ( creatable ) {
    addButton = <Button variant="primary" onClick={() => { if (p.property) openAddPopup(p.property, updateValue) }}>Add</Button>
  }

  return <InputGroup>
    <ResourceSelector multiple={p?.aggregate || false} className="flex-grow-1"
      canAddMore={maxCount !== null ? curValue.length < maxCount : true}
      restriction={objectsInClass(p.property?.getRestrictedClasses() ||[])}
      value={curValue || []}
      onChange={updateValue}/>

    {addButton}
  </InputGroup>
}
