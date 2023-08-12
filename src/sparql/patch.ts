import { SpreadElement } from '@babel/types'
import EventEmitter from 'events'
import N3 from 'n3'
import { useState } from 'react'
import * as util from './common'

interface SparqlUpdate {
  inserts: string[],
  deletes: string[],
  where: string[]
}

export function escapeSparqlString(t: string) {
    function doEscape(quote: string) {
        // @ts-ignore
        return t.replaceAll(quote, `\\${quote}`).replaceAll('\n', '\\n')
    }
    if ( t.indexOf("\"") == -1 ) {
        return `"${doEscape('"')}"`
    } else if ( t.indexOf("'") == -1 ) {
        return `'${doEscape("'")}'`
    } else {
        return `"${doEscape('"')}"`
    }
}

export class N3Context {
  _blanks: {[id: string]: string}
  constructor() {
    this._blanks = {}
  }

  private _getBlankName(i: string): string {
    if ( i in this._blanks ) {
      return this._blanks[i]
    } else {
      this._blanks[i] = `blank${Object.keys(this._blanks).length}`
      return this._blanks[i]
    }
  }

  renderNode(t: N3.Term) {
    if ( t.termType == 'BlankNode' ) {
      return `_:${this._getBlankName(t.id)}`
    } else if ( t.termType == 'DefaultGraph' ) {
      throw new TypeError("Can't deal with DefaultGraph")
    } else if ( t.termType == 'Literal' ) {
      if ( t.language ) {
        return escapeSparqlString(t.value) + "@" + t.language
      } else if ( t.datatype ) {
        return escapeSparqlString(t.value) + "^^<" + t.datatype.value + ">"
      } else {
        return escapeSparqlString(t.value)
      }
    } else if ( t.termType == 'NamedNode' ) {
      return `<${t.value}>`
    } else {
      return `?${t.value}`
    }
  }
}

export interface PatchFragment {
  bases?: N3.Term[],
  renderSparql(): Promise<SparqlUpdate>,
}

export interface RebasablePatchFragment<Gr> extends PatchFragment {
  rebase(g: Gr): RebasablePatchFragment<Gr>
}

export function emptyPatchFragment<Gr>(): RebasablePatchFragment<Gr> {
  const self = {
    async renderSparql() {
      return { inserts: [], deletes: [], where: [] }
    },
    rebase(g: Gr) { return self; }
  }
  return self
}

export function simplePatchFragment<Gr>(added: N3.Quad[], deleted: N3.Quad[] = []): RebasablePatchFragment<Gr> {
  const self = {
    async renderSparql() {
      return {
        inserts: added.length > 0 ? [ await util.formatQuads(added) ] : [],
        deletes: deleted.length > 0 ? [ await util.formatQuads(deleted) ] : [],
        where: []
      }
    },
    rebase(g: Gr) { return self; }
  }
  return self
}

export function concatPatchFragments(patches: PatchFragment[]) {
  const ret: PatchFragment =  {
    async renderSparql() {
      return renderSparqlUpdate(patches)
    }
  }
  if ( patches.some((p) => p.bases !== undefined) ) {
    ret.bases = patches.flatMap((p) => {
      if ( p.bases === undefined ) return [];
      else return p.bases;
    })
  }
  return ret
}

export function concatPatchFragmentsRebasable<Gr>(patches: RebasablePatchFragment<Gr>[]): RebasablePatchFragment<Gr> {
  const base = concatPatchFragments(patches)
  return {
    ...base,
    rebase(g: Gr) {
      return concatPatchFragmentsRebasable(patches.map((p) => p.rebase(g)))
    }
  }
}

export type SparqlPatch<Gr> = { [key: string]: RebasablePatchFragment<Gr> }

export async function renderSparqlUpdate(fragments: PatchFragment[]) {
  const updates = await Promise.all(fragments.map((p) => p.renderSparql()))

  const inserts = updates.flatMap(({inserts}) => inserts)
  const deletes = updates.flatMap(({deletes}) => deletes)
  const wheres = updates.flatMap(({where}) => where)
  return { inserts, deletes, where: wheres }
}

export async function renderSparqlUpdateToString(fragments: PatchFragment[]): Promise<string | null> {
  const { inserts, deletes, where: wheres } = await renderSparqlUpdate(fragments)

  let insertClause: string | null = null
  let deleteClause: string | null = null
  if ( inserts.length > 0 ) {
      insertClause = `INSERT { ${inserts.join('\n')} }`
    }
    if ( deletes.length > 0 ) {
      deleteClause = `DELETE { ${deletes.join('\n')} }`
    }
    const whereClause = `WHERE { ${wheres.map((q) => "{" + q + "}").join(' UNION \n')} }`

    if ( insertClause === null &&
      deleteClause === null
    ) { return null }

    let query = ""
    if ( deleteClause !== null )
      query = deleteClause;
    if ( insertClause !== null )
      query = `${query}\n${insertClause}`
    query = `${query}\n${whereClause}`
    return query
}

export interface PatchEditor<Gr> {
  patch: SparqlPatch<Gr>,
  setPatch: (nm: string) => (patch?: RebasablePatchFragment<Gr>) => void,
  getPatch: () => RebasablePatchFragment<Gr>,
  clearPatch: () => void,
  rebasePatch: (base: Gr) => void,
  nonEmpty: boolean
}

type ValOrCallback<X> = X | ((x: X) => X)

export function usePatchEditor<Gr>(patchCb?: (p: RebasablePatchFragment<Gr>) => void): PatchEditor<Gr> {
  const [ patch, _setPatch ] = useState<SparqlPatch<Gr>>({})
  function getPatch(p: SparqlPatch<Gr>) {
    return concatPatchFragmentsRebasable(Object.values(p))
  }
  function updatePatch(p: ValOrCallback<SparqlPatch<Gr>>) {
    _setPatch((oldPatch) => {
      let newPatch: SparqlPatch<Gr>
      if ( typeof p == 'function' ) {
        newPatch = p(oldPatch)
      } else {
        newPatch = p
      }

      if ( patchCb ) {
        patchCb(getPatch(newPatch))
      }

      return newPatch
    })
  }

  function setPatch(nm: string) {
    return (patch?: RebasablePatchFragment<Gr>) => {
      if ( patch === undefined ) {
        updatePatch((p) => {
          const newp = {...p}
          delete newp[nm]
          return newp
        })
      } else {
        updatePatch((p) => ({...p, [nm]: patch}))
      }
    }
  }

  function clearPatch() {
    updatePatch({})
  }

  function rebasePatch(subGraph: Gr) {
    updatePatch((patch) => {
      const newPatch: SparqlPatch<Gr> = {}
      for ( const key of Object.keys(patch) ) {
        newPatch[key] = patch[key].rebase(subGraph)
      }
      return newPatch
    })
  }

  return {
    patch, setPatch, rebasePatch,
    clearPatch, getPatch: () => getPatch(patch), nonEmpty: Object.keys(patch).length > 0 }
}
