import type { ViewerProps } from './Object'
import WKT from 'terraformer-wkt-parser';

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, FeatureGroup } from 'react-leaflet'
import N3 from 'n3'
import { useGraph } from '../graph'
import type { GeoJSON as GeoJSONType } from 'leaflet'

import 'leaflet/dist/leaflet.css'
import { useSparql } from '../sparql/Provider';
import Loading from "./Loading";

const GEO_AS_WKT = N3.DataFactory.namedNode('http://www.opengis.net/ont/geosparql#asWKT')
const GEO_WKT_LITERAL = N3.DataFactory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral')

interface GeoProps {
  editing?: boolean
}

export default function GeoViewer(p: GeoProps) {
  const graph = useGraph()
  const sparql = useSparql()

  const [geo, setGeo] = useState<GeoJSON.GeometryObject[] | null>(null)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    setError(null)
    setGeo(null)

    graph.explorePredicates(GEO_AS_WKT).getAllDistinct(sparql)
    .then((geos) => {
        const wkts = geos.flatMap((g) => g.termType == 'Literal' ? [g] : []);
        const features = wkts.flatMap((t) => {
          try {
            return [ WKT.parse(t.value)]
          } catch (e) {
            return []
          }
        })

        setGeo(features)
      })
      .catch((e) => setError(e))
  }, [graph])

  if ( geo === null ) {
    return <Loading/>
  } else if ( geo.length == 0 ) {
    return <>No geometry found</>
  } else {
    return <MapContainer zoom={13} center={[51.505, -0.09]} style={{height: '400px', width: '100%', minHeight: '400px'}}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <CenterAndShow data={geo}/>
    </MapContainer>
  }
}

interface ShowProps {
  data: any
}

function CenterAndShow({data}: ShowProps) {
  const layer = useRef<GeoJSONType | null>(null)
  const map = useMap()

  useEffect(() => {
    if ( map && layer.current )
      map.fitBounds(layer.current.getBounds())
  }, [map, layer.current])

  return <FeatureGroup ref={layer}>{data.map((g: any, i: number) => <GeoJSON key={i} data={g}/>)}</FeatureGroup>
}
