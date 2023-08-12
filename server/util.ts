import fs from 'node:fs'
import N3 from 'n3'
import rdfparse from 'rdf-parse'
import { URL } from 'url'

export async function readGraphFromFile(graph: N3.Store, file: string): Promise<void> {
  const textStream = fs.createReadStream(file)
  await readGraphFromStream(graph, textStream)
}

export function readGraphFromStream(graph: N3.Store, stream: fs.ReadStream): Promise<void> {
  return new Promise((resolve, reject) => {
    rdfparse.parse(stream, { contentType: 'text/turtle' })
      .on('data', (quad: any) => {
        graph.add(quad)
      })
      .on('error', (e: any) => {
        reject(e)
      })
      .on('end', () => {
        resolve()
      })
  })
}

export async function openUrl(url: string): Promise<fs.ReadStream> {
  const u = new URL(url)
  switch ( u.protocol ) {
    case 'file:':
      return fs.createReadStream(u.pathname);
    default:
      throw new TypeError(`openURL: unsupported scheme: ${u.protocol}`)
  }
}
