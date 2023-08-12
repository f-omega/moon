import N3 from 'n3'
import { useState, useMemo, useEffect, ReactNode } from 'react'
import { Form } from 'react-bootstrap'
import { DCTERMS_DESCRIPTION, DCTERMS_TITLE, RDFS_LABEL, SHACL_DESCRIPTION } from '../common/util'

import { useGraph } from '../graph'
import { useSparql } from '../sparql/Provider'

interface Props {
  creating: boolean,
  resource?: string,
  menu?: ReactNode,
  onResourceChanged?: (s: string) => void
}

const NAME_PREDICATES = [ DCTERMS_TITLE, RDFS_LABEL ]
const ABSTRACT_PREDICATES = [ DCTERMS_DESCRIPTION, SHACL_DESCRIPTION ]

export default function ResourceHeader({resource, menu, onResourceChanged, creating}: Props) {
  const graph = useGraph()
  const sparql = useSparql()

  const [ title, setTitle ] = useState<string>(resource || "")
  const [ alternates, setAlternates ] = useState<string[]>([])
  const [ abstract, setAbstract ] = useState<string|null>(null)

  useEffect(() => {
    Promise.all([
      graph.explorePredicates(NAME_PREDICATES).getAllDistinct(sparql),
      graph.explorePredicates(ABSTRACT_PREDICATES).getAllDistinct(sparql, {limit: 1})])
      .then(([nm, abstract]) => {
        const nms = nm.flatMap((n) => n.termType == 'Literal' ? [n] : [])
        if ( nms.length == 0 ) {
          setTitle(resource || "")
          setAlternates([])
        } else {
          setTitle(nms[0].value)
          setAlternates(nms.slice(1).map((q) => q.value))
        }

        if ( abstract.length == 0 ) {
          setAbstract(null)
        } else {
          setAbstract(abstract[0].value)
        }
      })
  }, [resource, graph])

  let summary = null
  if ( abstract ) {
    summary = <p>{abstract}</p>
  }

  let titleEl = <h1>{title}</h1>
  if ( creating ) {
    titleEl = <Form.Control placeholder="URI" className="fs-1" onChange={(e) => {
      if ( onResourceChanged ) onResourceChanged(e.target.value)
    }} value={resource}/>
  }

  return <header>
    <div className="d-flex flex-row">
      <div className="d-flex flex-column flex-grow-1">
        {titleEl}
        <div className="resource-id text-small text-muted">
          id: <a href={resource}>{resource}</a>
        </div>
        {summary}
      </div>
      <div>
        {menu}
      </div>
    </div>
  </header>
}
