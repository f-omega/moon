import N3 from 'n3'
import { useMemo } from 'react'
import Select from 'react-select/async-creatable'
import { components, OptionProps, SingleValueProps, MultiValueProps} from 'react-select'

import { isSelectResult, SparqlResultContext } from '../sparql/types'
import { asyncDebounce } from '../sparql/common'
import { useSparql } from '../sparql/Provider'
import { escapeSparqlString } from '../sparql/patch'

type MaybeList<T, Multiple extends boolean> = Multiple extends true ? T[] : T

interface TermOption {
  id: string,
  value: string,
  label: string,
  term: N3.NamedNode
}

interface Props<Multiple extends boolean> {
  multiple: Multiple,
  restriction?: string,
  className?: string,
  canAddMore?: boolean, // TODO
  value: MaybeList<N3.NamedNode, Multiple>,
  onChange: (ns: MaybeList<N3.NamedNode, Multiple>) => void,

  onCreate?: (iri?: string) => void,
  showCreateButton?: boolean,
  searchShapes?: boolean
}

//type Props = BaseProps<Multipletrue> | BaseProps<false>

export default function ResourceSelector<Multiple extends boolean>({multiple, restriction, className, value, onChange, onCreate, showCreateButton, searchShapes}: Props<Multiple>) {
  const sparql = useSparql()
  function mkTermOption(n: N3.NamedNode): TermOption {
    return { id: n.id, label: n.id, term: n, value: n.id }
  }

  // @ts-ignore
  let termOptions = multiple ? value.map(mkTermOption) : mkTermOption(value)
  const loadOptions = useMemo(() => {
    async function loadOptions(t: string): Promise<TermOption[]> {
      // @ts-ignore
      let values = (multiple ? value : [value]).map(mkTermOption)
      if (t == "" ) {
        return values
      } else {
        let source = "GRAPH ?g { SELECT DISTINCT ?s WHERE { { ?s ?p ?o } UNION { ?o ?p ?s } } }"
//        if ( searchShapes && sparql.dataset ) {
//          source = `${source} UNION { GRAPH <${sparql.dataset}> { {?s ?p ?o} UNION {?o ?p ?s} }`
//        }
        if ( restriction )
          source = restriction;
        let options = await sparql.runSparql(`SELECT ?s WHERE {
             ${source}
          FILTER(isIRI(?s)).
          FILTER(CONTAINS(STR(?s), ${escapeSparqlString(t)}))
          }`)
        if ( isSelectResult(options) ) {
          let res = new SparqlResultContext()
          let ret = options.results.bindings.flatMap(({s}) => {
            let iri = res.toN3(s)
            if ( iri instanceof N3.NamedNode ) {
              return [ mkTermOption(iri) ]
            } else {
              return []
            }
          })
          return ret
        } else return values
      }
    }
    return asyncDebounce(loadOptions, 500)
  }, [restriction])

  function doSelect(vs: TermOption[]) {
    if ( multiple )
    // @ts-ignore
      onChange(vs.map((v: TermOption) => v.term))
    else {
      // @ts-ignore
      onChange(vs[0].term)
    }
  }

  return <Select
    className={className}
    isMulti={multiple}
    value={termOptions}
    loadOptions={loadOptions}
    components={{Option: ResourceOption, MultiValue: ResourceMultiValue, SingleValue: ResourceValue}}
    onChange={doSelect as any}/>
}

function ResourceOption(p: OptionProps<TermOption>) {
  const pNew = {...p}
  if ( p.data.term ) {
    pNew.children = p.data.term.value
  }
  return <components.Option {...pNew}/>
}

function ResourceValue(p: SingleValueProps<TermOption>) {
  const pNew = {...p}
  if ( p.data.term ) {
    pNew.children = p.data.term.value
  }
  return <components.SingleValue {...pNew}/>
}

function ResourceMultiValue(p: MultiValueProps<TermOption>) {
  const pNew = {...p}
  if ( p.data.term ) {
    pNew.children = p.data.term.value
  }
  return <components.MultiValue {...pNew}/>
}
