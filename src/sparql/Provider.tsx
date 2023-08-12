import { Alert } from 'react-bootstrap'
import N3 from 'n3'
import rdfparse from 'rdf-parse'

import { GetPassword, isSelectResult, SparqlResult, SparqlResultContext } from './types'
import { fetchSparql } from './types'
import GraphChooser from './Chooser'
import * as util from '../util'
import type { SparqlOptions } from './types'
import type { ISparqlContext } from '../common/sparql'
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream'

import { ReactNode, useEffect, useState, createContext, useContext } from 'react'
import axios, { AxiosError } from 'axios'
import EventEmitter from 'events'
import { DatasetSpec } from '../common/util'

export type SparqlContext = {
  ready: boolean,
  discoveryMode: DiscoveryMode,
  describe(termIri: string): Describer,
} & ISparqlContext

interface IProps {
  spec?: DatasetSpec,

  graph?: string,
  findWellKnown?: boolean,
  children?: ReactNode,
  getPassword?: GetPassword
}

// If 'global', then documents not hosted on this server attempt to be fetched
type DiscoveryMode = 'global' | 'local'

type RunSparql = <C extends boolean = false>(s: string, construct?: C) => Promise<C extends true ? N3.Store : SparqlResult>
type UpdateSparql = (s: string) => Promise<void>
type ExternalCache = {[doc: string]: N3.Store}
type UpdateExternalCache = (cache: ExternalCache) => void

const SparqlContext = createContext<SparqlContext>({
  dataset: location.host,
  async runSparql() {
    throw new NotConnectedError()
  },
  async updateSparql() {
    throw new NotConnectedError()
  },
  describe(termIri: string) {
    throw new NotConnectedError()
  },
  discoveryMode: 'local',
  ready: false
})

let acceptableTypes: string[] | null = null;

interface FetchWaiter {
  resolve: (s: N3.Store) => void,
  reject: (e: any) => void
}
interface FetchInfo {
  waiting: FetchWaiter[]
}
const activeFetches: {[docIri: string]: FetchInfo} = {}
async function fetchRdf(docIri: string) : Promise<N3.Store> {
  if ( acceptableTypes === null ) {
    acceptableTypes = await rdfparse.getContentTypes()
  }

  async function _doFetch(nextIri: string): Promise<N3.Store> {
    let res = await fetch(nextIri, {
      method: 'GET', mode: 'cors',
      headers: { Accept: (acceptableTypes || []).join(",") }
    })
    if ( res.type == 'opaque' || res.type == 'opaqueredirect' ) {
      throw new FailedRdfFetch(res)
    } else if ( res.ok ) {
      const localStore = new N3.Store()
      let contentType = res.headers.get('content-type') || 'application/rdf+xml'
      const ctx = new SparqlResultContext()

      if ( contentType.indexOf(';') >= 0 ) {
        contentType = contentType.substring(0, contentType.indexOf(';'))
      }

      await new Promise<void>((resolve, reject) => {
        rdfparse.parse(new ReadableWebToNodeStream(res.body as any) as any, { contentType })
          .on('data', (quad) => { localStore.add(quad); })
          .on('error', (error) => {
            reject(error)
          })
          .on('end', () => resolve())
      })
      return localStore
    } else if ( res.status >= 400 && res.status < 500 ) {
      throw new RdfNotFound(docIri)
    } else {
      throw new FailedRdfFetch(res)
    }
  }

  if ( docIri in activeFetches ) {
    return await new Promise((resolve, reject) =>
      activeFetches[docIri].waiting.push({resolve, reject})
    )
  } else {
    activeFetches[docIri] = {waiting: []}

    try {
      let store = null
      try {
        store = await _doFetch(docIri)
      } catch (e) {
        if ( e instanceof TypeError ) {
          // Hack.. attempt with https if http. Makes w3c work
          if ( docIri.startsWith('http:') ) {
            console.warn("Rewrite to https")
            store = await _doFetch('https:' + docIri.substring(5))
          } else {
            throw e
          }
        } else {
          throw e
        }
      }
      for ( const w of (activeFetches[docIri]?.waiting || [])) {
        w.resolve(store)
      }
      return store
    } catch (e) {
      for ( const w of (activeFetches[docIri]?.waiting || [])) {
        w.reject(e)
      }
      throw e
    } finally {
      delete activeFetches[docIri]
    }
  }
}

class RdfNotFound {
  iri: string
  constructor(iri: string) {
    this.iri = iri
  }
}

class FailedRdfFetch {
  response: Response
  constructor(res: Response) {
    this.response = res
  }
}

// TODO store in local storage / indexed db

export class Describer extends EventEmitter {
  store: N3.Store
  termIri: string
  runSparql: RunSparql
  mode: DiscoveryMode
  cache: ExternalCache
  setCache: UpdateExternalCache

  termUrl?: URL
  isLocal: boolean

  constructor(
    termIri: string, runSparql: RunSparql, mode: DiscoveryMode,
    cache: ExternalCache, setCache: UpdateExternalCache
  ) {
    super()
    this.termIri = termIri
    this.runSparql = runSparql
    this.mode = mode
    this.cache = cache
    this.setCache = setCache

    try {
      this.termUrl = new URL(termIri)
      this.isLocal = this.termUrl.origin == location.origin
    } catch(e) {
      this.isLocal = true
    }

    this.store = new N3.Store()
  }

  start() {
    this._asyncStart()
  }

  private async _asyncStart() {
    try {
      const fetchers = [ this._fetchLocal() ]
      if ( this.mode == 'global' && !this.isLocal ) {
        fetchers.push((async () => {
          try {
            await this._fetchGlobal(this.termIri)
          } catch (e) {
            const iri = Describer._noHash(this.termIri)
            if ( !(iri in this.cache) ) {
              this.cache[iri] = new N3.Store() // Stop duplicate requests
            }
            throw e
          }
        })())
      }

      await Promise.all(fetchers)

      this.emit('finished', {})
    } catch (e) {
      // @ts-ignore
      this.emit('error', { message: `Exception occurred while describing resource: ${e.toString()}`})

    }
  }

  private async _fetchLocal() {
    this.store = await this.runSparql(`DESCRIBE <${this.termIri}>`, true)

    this.emit('data', {graph: this.store})
  }

  private _getBestFollowUp(res: Response): string | null {
    return null
  }

  static _noHash(iri: string): string {
    const hashIx = iri.indexOf('#')
    if ( hashIx >= 0 ) {
      iri = iri.substring(0, hashIx)
    }
    return iri
  }

  private async _fetchGlobal(docIri: string): Promise<void> {
    docIri = Describer._noHash(docIri)

    if ( docIri in this.cache ) {
      const termNode = N3.DataFactory.namedNode(this.termIri)
      this.store.addQuads(this.cache[docIri].getQuads(termNode, null, null, null))
    } else {
      // Otherwise, fetch
      try {
        let store = await fetchRdf(docIri)
        this.store.addQuads(store.getQuads(null, null, null, null))
        this.cache[docIri] = store
        this.emit('data', {graph: this.store})
      } catch ( e ) {
        if ( e instanceof RdfNotFound ) {
        } else if ( e instanceof FailedRdfFetch ) {
          this._badRequest(e.response)
        } else {
          if ( !this.isLocal ) {
            this.emit('error', { message: `Could not fetch iri: ${docIri}`, type: 'bad-request' })
          }
        }
      }
    }
  }

  private _badRequest(res: Response) {
    if ( !this.isLocal ) {
        this.emit('error', { message: `Could not fetch ${this.termIri}: ${res.status}`, type: 'bad-request' })
      return
    }
  }
}

function describe(termIri: string, runSparql: RunSparql, mode: DiscoveryMode,
  cache: ExternalCache, setCache: UpdateExternalCache)
{
  return new Describer(termIri, runSparql, mode, cache, setCache)
}

export default function Provider({spec, graph, children, findWellKnown, getPassword}: IProps) {
  const [ cache, setCache ] = useState<ExternalCache>({})

  const curGraph = null
  const finalEndpoint = spec?.sparqlEndpoint

  const finalUpdateEndpoint = spec?.updateEndpoint || spec?.sparqlEndpoint

  async function runSparql(q: string, construct?: boolean) {
    if ( finalEndpoint ) {
      return await fetchSparql(q, {endpoint: finalEndpoint, graph: curGraph || "",
        construct: construct || false,
        getPassword
      })
    } else {
      throw new NotConnectedError()
    }
  }

  async function updateSparql(q: string) {
    if ( finalUpdateEndpoint ) {
      await fetchSparql(q, {endpoint: finalUpdateEndpoint, graph: curGraph || "", update: true, getPassword})
    } else {
      throw new NotConnectedError() 
    }
  }

  const discoveryMode = 'global'
  return <SparqlContext.Provider value={{dataset: spec?.iri || "", runSparql, updateSparql, describe: (t) => describe(t, runSparql, discoveryMode, cache, setCache), ready: true, discoveryMode}}>{children}</SparqlContext.Provider>
}

export class NotConnectedError {
  toString() {
    return "No sparql endpoint connected"
  }
}

export function useSparql() {
  return useContext(SparqlContext)
}
