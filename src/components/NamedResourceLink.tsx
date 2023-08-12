import { useState, useEffect } from 'react';
import N3 from 'n3';
import { BsPatchQuestion } from 'react-icons/bs';

import ResourceLink from './ResourceLink'
import { useSparql } from '../sparql/Provider'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';

interface Props {
  iri: string | N3.NamedNode<string>,
  reveal?: boolean
}

export default function NamedResourceLink({iri}: Props) {
  const [ name, setName ] = useState<string>(iri instanceof N3.NamedNode ? iri.value : iri)
  const [ nameResolved, setNameResolved ] = useState<boolean>(false)
  const sparql = useSparql()

  useEffect(() => {
    let seen = false
    setNameResolved(false)
    setName(iri instanceof N3.NamedNode ? iri.value : iri)

    sparql.describe(iri instanceof N3.NamedNode ? iri.value : iri)
      .on('data', ({graph}) => {
        const quads = graph.getQuads(iri instanceof N3.NamedNode ? iri : N3.DataFactory.namedNode(iri),
          N3.DataFactory.namedNode("http://www.w3.org/2000/01/rdf-schema#label"),
          null, null
        ).filter((q: N3.Quad) => q.object instanceof N3.Literal)
        if ( !seen && quads.length > 0 ) {
          seen = true
          setNameResolved(true)
          setName(quads[0].object.value)
        }
      })
      .on('error', (e) => {
        if ( e.type == 'bad-request' ) {
          // TODO set error
        }
      })
      .on('finish', () => {
      })
      .start()
  }, [iri])

  if ( nameResolved ) {
    return <ResourceLink to={iri instanceof N3.NamedNode ? iri.value : iri}>{name}</ResourceLink>
  }
  return <><ResourceLink to={iri instanceof N3.NamedNode ? iri.value : iri}>{name}</ResourceLink>
    {' '}&nbsp;
    <OverlayTrigger placement="top" trigger="click"
      overlay={(props) => {
        return <Tooltip {...props}>
          <p>Could not find any name for this IRI.</p>
          <Button size="sm" variant="secondary">Name this node</Button>
        </Tooltip>
      }}>
      <span>
        <BsPatchQuestion  className="text-muted"/>
      </span>
    </OverlayTrigger>
  </>
}

