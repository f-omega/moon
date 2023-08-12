import { SparqlEndpointError, SparqlOptions } from '../src/common/sparql';
import axios from 'axios'
import rdfparse from 'rdf-parse'
import N3 from 'n3'

export * from '../src/common/sparql'

export async function fetchSparql(q: string, options: SparqlOptions) {
  let qry = ""
  if ( options.graph != "" ) {
    qry = `?default-graph-uri=${encodeURIComponent(options.graph)}`
  }
  const endpoint = typeof options.endpoint == 'string' ? options.endpoint : options.endpoint.endpoint;
  console.log("FETCH", `${endpoint}${qry}`, options.construct, q);

  const r = await axios({
    method: 'post',
    url: `${endpoint}${qry}`,
    responseType: 'stream',
    headers: {
      'Accept': options.construct ? 'text/turtle' : 'application/sparql-results+json',
      'Content-type': options.update ? 'application/sparql-update' : 'application/sparql-query'
    },
    data: q
  })
  if ( r.status != 200 ) {
    throw new SparqlEndpointError(options.endpoint, options.graph, q, r)
  } else {
    if ( options.construct ) {
      let contentType = r.headers['Content-type'] || 'text/turtle'
      if ( contentType.indexOf(';') >= 0 ) {
        contentType = contentType.substring(0, contentType.indexOf(';'))
      }

      const localStore = new N3.Store()
      await new Promise((resolve, reject) => {
        try {
          rdfparse.parse(r.data, { contentType })
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
      const chunks = []
      for await (const q of r.data) {
        chunks.push(Buffer.from(q))
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
    }
  }
}

