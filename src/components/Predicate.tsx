import N3 from 'n3'
import { useState, useEffect } from 'react'

import { useCache } from '../cache'
import { useSparql } from '../sparql/Provider'

import NamedResourceLink from './NamedResourceLink'

interface Props {
  predicate: N3.NamedNode<string>
}

export default function Predicate({predicate}:Props) {
  return <NamedResourceLink iri={predicate.value}/>
}
