import N3 from 'n3';

const iri = N3.DataFactory.namedNode

export const MOON_SERVICE_PORT = iri("https://ld.f-omega.com/moon/servicePort")
export const MOON_SERVICE_HOST = iri("https://ld.f-omega.com/moon/serviceHost")
export const MOON_DATASET = iri("https://ld.f-omega.com/moon/dataset")
export const MOON_SHAPES = iri("https://ld.f-omega.com/moon/shapes")
export const MOON_JAVASCRIPT_LIBRARY = iri("https://ld.f-omega.com/moon/JavascriptLibrary")
export const MOON_APPLICABLE_TO = iri("https://ld.f-omega.com/moon/applicableTo")
export const MOON_SERVER = iri("https://ld.f-omega.com/moon/Server")
export const MOON_CONTENT = iri("https://ld.f-omega.com/moon/content")

export const MOON_EDIT_SERVICE = iri("https://ld.f-omega.com/moon/EditService")
export const MOON_CONTENT_SERVICE = iri("https://ld.f-omega.com/moon/ContentService")

export const RDF_TYPE = iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
