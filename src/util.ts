import N3 from 'n3'

export function copyQuad(quad: N3.Quad): N3.Quad {
  return N3.DataFactory.quad(quad.subject, quad.predicate, quad.object, quad.graph)
}

