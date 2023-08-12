import { ReadableWebToNodeStream } from 'readable-web-to-node-stream'
import rdfparse from 'rdf-parse'
import N3 from 'n3'

import { SparqlEndpointError, SparqlOptions } from '../common/sparql'
import { EndpointSpec } from '../common/util'

export * from '../common/sparql'

async function getPassword(options: SparqlOptions, endpoint: string, username: string) {
  if ( options.getPassword !== undefined ) {
    return await options.getPassword(endpoint, username)
  } else {
    return ""
  }
}

export async function fetchSparql(q: string, options: SparqlOptions) {
  let qry = ""
  if ( options.graph != "" ) {
    qry = `?default-graph-uri=${encodeURIComponent(options.graph)}`
  }

  const endpoint: EndpointSpec = typeof options.endpoint == 'string' ? { endpoint: options.endpoint, needsProxy: false } : options.endpoint;

  const authHeaders: {[hdr: string]: string} = {};
  if ( endpoint.auth?.type == 'basic' ) {
    const password = endpoint.auth.password === undefined ? await getPassword(options, endpoint.endpoint, endpoint.auth.username) : endpoint.auth.password;
    const credential = `${endpoint.auth.username}:${password}`
    authHeaders['Authorization'] = `Basic ${btoa(credential)}`
  }

  let httpEndpoint = endpoint.endpoint
  if ( endpoint.needsProxy ) {
    httpEndpoint = '/sparql-proxy?endpoint=' + encodeURIComponent(httpEndpoint)
  }

    console.log("GOT ENDPOINT", endpoint)

  const r = await fetch(`${httpEndpoint}${qry}`, {
    method: 'POST', mode: 'cors',
    headers: {
      ...authHeaders,
      'Content-type': options.update ? 'application/sparql-update' : 'application/sparql-query',
      'Accept': options.update ? 'application/json' : (options.construct ? 'text/turtle' : 'application/sparql-results+json') },
    body: q
  })
  if ( r.status != 200 && r.status != 204 ) {
    throw new SparqlEndpointError(options.endpoint, options.graph, q, r)
  } else if ( options.update && r.status == 204 ) {
    return true
  } else {
    if ( options.construct ) {
      let contentType = r.headers.get('Content-type') || 'text/turtle'
      if ( contentType.indexOf(';') >= 0 ) {
        contentType = contentType.substring(0, contentType.indexOf(';'))
      }

      const localStore = new N3.Store()
      await new Promise((resolve, reject) => {
        try {
          rdfparse.parse(new ReadableWebToNodeStream(r.body as any) as any, { contentType })
            .on('data', (quad) => {
              localStore.add(quad)
            })
            .on('error', reject)
            .on('end', resolve)
        } catch (e) {
          reject(e)
        }
      })

      return localStore
    } else {
      return await r.json()
    }
  }
}

