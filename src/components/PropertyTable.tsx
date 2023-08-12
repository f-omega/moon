import { Alert, Button, Table } from 'react-bootstrap'
import { useGraph } from '../graph'
import N3 from 'n3'
import { PropertyShape, GroupSpec, pathToSparql } from '../sparql/shacl'
import { useEffect, useMemo, useState } from 'react'
import { compareOrderName } from '../sparql/common'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useSparql } from '../sparql/Provider'
import { isSelectResult, SparqlResultContext } from '../sparql/types'
import Loading from './Loading'
import ObjectViewer from './Object'
import ResourceLink from './ResourceLink'

export interface Props {
  values: N3.Quad_Object[],
  property: PropertyShape,
  editing?: boolean
}

interface ColumnGroupInfo { id: string, order: number, name: string }
interface ColumnGroupSpec {
  group: ColumnGroupInfo
  properties: PropertyShape[]
}

const columnHelper = createColumnHelper<any>()

export default function PropertyTable({property, values}: Props) {
  const graph = useGraph()
  const sparql = useSparql()

  const [properties, columns] = useMemo(() => {
    let nodeShape = property.getNode()
    if ( nodeShape !== null ) {
      const groups: {[iri: string]: ColumnGroupSpec} = {}

      const props = nodeShape.properties()
      for ( const prop of props ) {
          if ( prop.getHidden() ) continue;
        const groupUri = prop.group === null ? "" : prop.group.iri.value
        if ( !(groupUri in groups) ) {
          let group: ColumnGroupInfo
          if ( prop.group ) {
            group = { id: prop.group.iri.id, name: prop.group.name, order: prop.group.order }
          } else {
            group = { id: "", name: "", order: -1 }
          }
          groups[groupUri] = { group, properties: [] }
        }
        groups[groupUri].properties.push(prop)
      }

      const headers = Object.values(groups)
        .sort((a, b) => compareOrderName(a.group, b.group))
        .flatMap((g) => {
          const columns = g.properties.sort(compareOrderName)
            .map((p) => columnHelper.accessor(p.shape.id, {
              cell: info => <Cell values={info.getValue()} property={p}/>,
              header: () => <>{p.name}</>
          }))
          if ( g.group.order == -1 ) {
            return columns
          } else {
            return [ columnHelper.group({
              id: g.group.id,
              header: () => <span className="column-group">{g.group.name}</span>,
              columns
            }) ]
          }
        })
      return [props, headers]
    } else {
      return [[], []]
    }
  }, [property])

  const [ loading, setLoading ] = useState<boolean>(true)
  const [ error, setError ] = useState<any>(null)
  const [ data, setData ] = useState<any[]>([])

  useEffect(() => {
    let fields = properties.flatMap((p, i) => { // TODO support shacl node expressions
      if ( p.path !== undefined ) {
        return [ { key: `f${i}`, path: pathToSparql(p.path), property: p } ]
      } else {
        return []
      }
    })

    let uris = values.flatMap((v) => v.termType == 'NamedNode' ? [v.value] : [])
      .map((u) => `<${u}>`).join(' ')
    const selectQuery = `SELECT ?s ?field ?value WHERE {
      VALUES ?s { ${uris} }.
      OPTIONAL {
        ${fields.map((f, i) => `{ ?s ${f.path} ?value. BIND ( ${i} AS ?field ).}`).join(' UNION ')}.
      }
    }
`;

//
//
//         setData(result.results.bindings.map((r) => {
//           const row : { [id: string]: N3.Term | null } = { iri: ctxt.toN3(r.s) };
//           for ( const f of fields ) {
//             row[f.property.shape.id] = r[f.key] ? ctxt.toN3(r[f.key]) : null;
//           }
//           return row;
//         }))
    setLoading(true);
    (async () => {
      try {
        let result = await sparql.runSparql(selectQuery);
        const ctxt = new SparqlResultContext()
        if ( isSelectResult(result) ) {
          const data: {[iri: string]: {[id: string]: N3.Term[]}} = {}
          const rows: {[id: string]: N3.Term[]}[] = []
          for ( const r of result.results.bindings ) {
            let iri = ctxt.toN3(r.s);
            if ( iri.termType != 'NamedNode' ) continue;
            let row: {[id: string]: N3.Term[]}
            if ( iri.value in data ) {
              row = data[iri.value]
            } else {
              // @ts-ignore
              row = { iri }
              for ( const f of fields ) {
                row[f.property.shape.id] = []
              }
              rows.push(row)
              data[iri.value] = row
            }

            if ( r.value !== undefined && r.field !== undefined ) {
              const fieldIx = ctxt.toN3(r.field)
              if ( fieldIx.termType != 'Literal' ) continue;
              const fieldIndex = parseInt(fieldIx.value)
              row[fields[fieldIndex].property.shape.id].push(ctxt.toN3(r.value))
            }

            console.log("GOT DATA", rows)
            setData(rows)
          }
        } else {
          setError({toString: () => "Bad result returned"})
        }
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [properties])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  if ( loading ) {
    return <Loading/>
  }

  let alert = <></>
  if ( error ) {
    alert = <Alert variant="warning">{`${error}`}</Alert>
  }

  return <>{alert}
  <Table striped bordered hover>
    <thead>
      {table.getHeaderGroups().map(headerGroup => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map(header => (
            <th key={header.id} colSpan={header.colSpan}>
              {header.isPlaceholder
                ? null
                : flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
            </th>
          ))}
        </tr>
      ))}
    </thead>
    <tbody>
      {table.getRowModel().rows.map(row => (
        <tr key={row.id}>
          {row.getVisibleCells().map((cell, i) => {
            let content = flexRender(cell.column.columnDef.cell, cell.getContext())
            if ( i == 0 ) {
              content = <ResourceLink to={cell.row.original.iri.value}>{content}</ResourceLink>
            }
            return <td key={cell.id}>
              {content}
            </td>
          })}
        </tr>
      ))}
    </tbody>
  </Table>
  </>
}

interface CellProps {
  values: N3.Quad_Object[],
  property: PropertyShape,
  editing?: boolean
}

function Cell({values, editing, property}: CellProps) {
  if ( values.length == 0 ) {
    return <>(none)</>
  } else if ( values.length == 1 ) {
    return <ObjectViewer term={values[0]} editing={editing || false}
      predicate={null} property={property}/>
  } else {
    return <ul className="multiple-values">
      {values.map((value) => <ObjectViewer term={value} editing={editing||false}
        predicate={null} property={property}/>)}
    </ul>
  }
}
