/// An in-memory segment of the entire graph

import { createContext, useContext } from 'react'

import N3 from 'n3'
import { SparqlContext } from './sparql/Provider'
import { isSelectResult, SparqlResultContext } from './common/sparql'
import randomstring from 'randomstring';
import { RebasablePatchFragment, emptyPatchFragment, N3Context, SparqlPatch, PatchEditor, usePatchEditor } from './sparql/patch';
import { pathToSparql, ShaclPath, splitShaclPath } from './sparql/shacl';

export type GraphFragment = RebasablePatchFragment<GraphNavigator>
export type GraphPatch = SparqlPatch<GraphNavigator>

interface SelectParentOptions {
  selfVar?: string
  optional?: boolean,
  selfQuery?: string
}

type SelectWithParent = (parentName: string, predVar: string, options?: SelectParentOptions) => string

interface GraphPath {
  varName: string,
  type: any,
  selectStatements: string,
  selectWithParent?: SelectWithParent,
  focus?: string
}

export interface BasicQueryOptions {
  limit?: number
}
export interface SparqlQueryOptions extends BasicQueryOptions {
  includeParent?: boolean,
  distinct?: boolean,
  resultName?: string,
  extra?: string
}

export class GraphNavigator {
  private path: GraphPath[]
  private prefix: string

  constructor() {
    this.prefix = randomstring.generate(10)
    this.path = []
  }

  get patchable(): boolean {
    return this.path[this.path.length - 1].selectWithParent !== undefined
  }

  replacePatch(newObject: N3.Quad_Object | N3.Quad_Object[]): RebasablePatchFragment<GraphNavigator> {
    if ( this.path.length == 0 ) {
      console.error("EMPTY PATCH FRAGMENT WHEN REPLACING WITH", newObject)
      return emptyPatchFragment()
    } else if ( this.path[this.path.length - 1].selectWithParent === undefined ) {
      //      throw new TypeError("Graph is not patchable here (yet!)")
      console.error("GRAPH IS NOT PATCHABLE HERE", this)
      return emptyPatchFragment()
    } else {
      console.log("REPLACE PATCH", this.path)
      // Remove the last element
      const parent = new GraphNavigator()
      parent.prefix = this.prefix
      parent.path = [ ...this.path ]
      parent.path.splice(this.path.length - 1, 1)

      const query = parent.sparqlQuery()
      const parentVar = `${this.prefix}_parent`
      const predVar = `${this.prefix}_pred`

      // @ts-ignore
      const selectParent = this.path[this.path.length - 1].selectWithParent(parentVar, predVar, {
        selfVar: parent._getCurFocus(),
        optional: true,
        selfQuery: `{ ${query} }`
      })
      const o = this.path[this.path.length - 1].varName

      const newObjects = Array.isArray(newObject) ? newObject : [ newObject ];
      const n3 = new N3Context()

      return {
        bases: newObjects,
        async renderSparql() {
          return {
            deletes: [ `?${parentVar} ?${predVar} ?${o}.` ],
            inserts: newObjects.map((iri) => `?${parentVar} ?${predVar} ${n3.renderNode(iri)}.`),
            where: [ selectParent ]
          }
        },
        rebase(nextGraph: GraphNavigator) {
          return nextGraph.replacePatch(newObject)
        }
      }
    }
  }

  get nextVarName(): string {
    return `${this.prefix}_v${this.path.length}`
  }

  private _getCurFocus() {
    if ( this.path.length == 0 ) {
      return `${this.prefix}_v0`
    } else {
      return this.path[this.path.length - 1].varName
    }
  }

  focusNew(n: N3.Term, path?: ShaclPath): GraphNavigator {
    const ret = new GraphNavigator()
    const n3 = new N3Context()

    const predicate = path && path.type == 'property' ? path.property : null
    let selectWithParent : SelectWithParent | undefined = undefined

    if ( predicate !== null ) {
      const parent = new GraphNavigator()
      parent.prefix = this.prefix
      parent.path = [ ...this.path ]
      parent.path.splice(this.path.length - 1, 1)

      selectWithParent = (parentName: string, predVar: string, options: SelectParentOptions={}) => {
        const parentQuery = parent.sparqlQuery()
        return `{ ${parentQuery} }. BIND(?${parent._getCurFocus()} AS ?${parentName}). BIND(${n3.renderNode(predicate)} AS ?${predVar})`
      }
    }

    let focus: string | undefined = undefined
    if ( n instanceof N3.NamedNode )
      focus = n.value;

    ret.path = [ // ...this.path,
      {
        varName: this.nextVarName,
        type: { type: 'shacl', path },
        selectStatements:
        n instanceof N3.NamedNode ?
          `VALUES ?${this.nextVarName} { ${n3.renderNode(n)} } ` :
          `VALUES ?${this.nextVarName} { }`,
        selectWithParent,
        focus
      }
    ]
    return ret
  }

  focus(ns: (N3.NamedNode|string|(N3.NamedNode | string)[])): GraphNavigator {
    const values: string[] = []
    for ( const n of (Array.isArray(ns) ? ns : [ns])) {
      let iri: string
      if ( typeof n == 'string' ) {
        iri = n
      } else {
        iri = n.value
      }
      values.push(`<${iri}>`)
    }

    const ret = new GraphNavigator()
    let focus:  string | undefined = undefined

    if ( !Array.isArray(ns) ) {
      if ( ns instanceof N3.NamedNode ) {
        focus = ns.value;
      } else {
        focus = ns
      }
    }

    ret.path = [ ...this.path,
      {
        varName: this.nextVarName,
        type: {type: 'focus', values: ns},
        selectStatements:
          `VALUES ?${this.nextVarName} { ${values.join(' ')} }`,
        focus
      }
    ]
    return ret
  }

  getParentFocus(): string | null {
    if ( this.path.length > 1 ) {
      return this.path[this.path.length - 2].focus || null
    } else {
      return null
    }
  }

  explorePredicates(ps: (N3.NamedNode|ShaclPath|(N3.NamedNode|ShaclPath)[])): GraphNavigator {
    const curFocus = this._getCurFocus()

    const paths: ShaclPath[] = (Array.isArray(ps) ? ps : [ps]).map((p) => {
      if ( p instanceof N3.NamedNode ) {
        return { type: 'property', property: p }
      } else {
        return p
      }
    })

    const propertyPath = paths.map((p) => {
      return `(${pathToSparql(p)})`
    }).join("|")

    const ret = new GraphNavigator();
    const varName = this.nextVarName
    ret.path = [ ...this.path,
      {
        varName,
        type: {type: 'focus', values: ps},
        selectStatements: `?${curFocus} ${propertyPath} ?${this.nextVarName}.`,
        selectWithParent(parentName: string, predVar: string, options: SelectParentOptions = {}) {
          const parentPaths = paths.flatMap((p) => splitShaclPath(p, predVar))
          const query = parentPaths.map(([canIncludeSelf, parentPath, predConds, exampleLastHop]) => {
            const parentHops: string[] = []
            if ( canIncludeSelf && options.selfVar ) {
              parentHops.push(`{ ${options.selfQuery || ""} }. FILTER(BOUND(?${options.selfVar})). BIND(?${options.selfVar} AS ?${parentName})`)
            }
            if ( parentPath !== null && options.selfVar) {
              parentHops.push(`${options.selfQuery || ""}  FILTER(BOUND(?${options.selfVar})). ?${options.selfVar} ${pathToSparql(parentPath)} ?${parentName}`)
            }
            const exampleLastHopValueList = exampleLastHop.map((u) => `<${u}>`).join(" ")
            const exampleLastHopValues = `VALUES ?${predVar} { ${exampleLastHopValueList} }`
            const parentQuery = parentHops.map((q) => `{ ${q} }`).join(" UNION ")
            const childBaseQuery: string = `?${parentName} ?${predVar} ?${varName}. ${predConds}.`
            const childQuery: string = options.optional ? `{ ${childBaseQuery} } UNION { ${exampleLastHopValues} }` : childBaseQuery
            return `${parentQuery}\n${childQuery}`
          }).map((q) => `{ ${q} }`).join(" UNION ")
          return query
        }
      }
    ]
    return ret
  }

  sparqlQuery(options: SparqlQueryOptions = {}) {
    const distinct = options.distinct ? "DISTINCT" : ""
    let vars: string[] = []
    if ( options.resultName !== undefined ) {
      vars.push("(?" + this._getCurFocus() + " AS ?" + options.resultName + ")")
    } else {
      vars.push("?" + this._getCurFocus())
    }
    if ( options.includeParent && this.path.length > 1 ) {
      vars.push("?" + this.path[this.path.length - 2].varName)
    }

    const cond = this.path.map((p) => p.selectStatements).join('\n')

    let extra = ''
    if ( options.extra !== undefined )
      extra = options.extra

    let limit = ''
    if ( options.limit !== undefined ) {
      limit = ` LIMIT ${options.limit}`
    }
    console.log("SPARKL QUERY", vars)
    const q = `SELECT ${distinct} ${vars.join(' ')} WHERE { ${cond} ${extra} } ${limit}`

    return q
  }

  async listDirectProperties(sparql: SparqlContext): Promise<N3.NamedNode[]> {
    const focus = this._getCurFocus()
    const base = this.sparqlQuery({resultName: 's'})
    const r = await sparql.runSparql(`SELECT DISTINCT ?predicate {
      { ${base} }.
      ?s ?predicate ?o.
      }`)

    if ( isSelectResult(r) ) {
      const ctxt = new SparqlResultContext()
      return r.results.bindings.map((b) => ctxt.toN3(b.predicate))
        .flatMap((n) => n.termType == 'NamedNode' ? [n] : [])
    } else {
      return []
    }
  }

  async getAllDistinct(sparql: SparqlContext, fetchOptions: BasicQueryOptions = {}): Promise<N3.Term[]> {
    const r = await sparql.runSparql(this.sparqlQuery({distinct: true, ...fetchOptions}))
    const focus = this._getCurFocus()
    if ( isSelectResult(r) ) {
      const ctxt = new SparqlResultContext()
      return r.results.bindings.map((o) => ctxt.toN3(o[focus]))
    } else {
      return []
    }
  }
}

export const GraphContext = createContext<GraphNavigator>(new GraphNavigator())

export function useGraph() {
  return useContext(GraphContext)
}

export function useGraphPatchEditor(patchCb?: (p: GraphFragment) => void): PatchEditor<GraphNavigator> {
  return usePatchEditor<GraphNavigator>(patchCb)
}
