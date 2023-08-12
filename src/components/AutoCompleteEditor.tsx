import { useState, useMemo } from 'react'
import Select from 'react-select/async-creatable'
import N3 from 'n3'

import { useSparql } from '../sparql/Provider'
import type { ViewerProps } from './Object'
import { SparqlResultContext, isSelectResult } from '../sparql/types'
import { asyncDebounce } from '../sparql/common'

interface TermOption {
  id: string,
  term: N3.Term,
  label: string
}

export default function AutoCompleteEditor(p: ViewerProps) {
  const sparql = useSparql()

  const [ selected, setSelected ] = useState<TermOption | null>(() => p.term === null ? null : {
    id: p.term.id,
    term: p.term,
    label: p.term.value
  })

  const restriction = useMemo(() => {
    let restriction: string[] = []
    if ( p.property !== undefined ) {
      const classes = p.property.getRestrictedClasses()
      if ( classes !== null )
        restriction = [ ...restriction, ...(classes.map((c) => `{ ?s a <${c}> }`)) ]
    }
    if ( restriction.length == 0 ) {
      restriction.push("{ SELECT DISTINCT ?s WHERE { { ?s ?p ?o } UNION {?o ?p ?s}. FILTER(!isBLANK(?s)) } }")
    }
    return restriction.join(" UNION ")
  }, [p.property])

  const retrieveOptions = useMemo(() => {
    async function retrieveOptions(inputValue: string): Promise<TermOption[]> {
      const search = encodeURIComponent(inputValue.toLowerCase())
      let results = await sparql.runSparql(`PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT DISTINCT ?s ?label
WHERE {
      ${restriction}
      OPTIONAL {?s rdfs:label|dcterms:name ?label}
      FILTER(CONTAINS(LCASE(?s), '${search.toLowerCase()}') ||
             (BOUND(?label) && CONTAINS(LCASE(?label), '${search.toLowerCase()}'))).
      FILTER(!isBLANK(?s)).
}
LIMIT 100`)
      let options = []
      try {
        if ( isSelectResult(results) ) {
          console.log("GOT QUERY RESULTS", results)
          const reader = new SparqlResultContext()
          for ( const b of results.results.bindings ) {
            const n = reader.toN3(b.s)
            const label = b.label === undefined ? null : reader.toN3(b.label)
            const entry = { id: n.id, term: n, label: n.value }
            if ( label instanceof N3.Literal ) {
              entry.label = label.value
            }
            if ( n instanceof N3.NamedNode ) {
              options.push(entry)
            }
          }
        }
        let existing = selected === null ? [] : [selected]
        return [ ...existing, ... options ]
      } catch (e) {
        return selected === null ? [] : [selected]
      }
    }

    return asyncDebounce(retrieveOptions, 200)
  }, [restriction])

  return <Select cacheOptions defaultOptions loadOptions={retrieveOptions}
    value={selected}/>
}
