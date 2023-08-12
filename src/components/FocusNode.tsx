import { Alert } from 'react-bootstrap'
import N3 from 'n3'
import { useEffect, useState, createContext, useContext, ReactNode, useMemo } from 'react'

import { useSparql } from '../sparql/Provider'
import Loading from './Loading'
import { GraphContext, GraphNavigator, useGraph } from '../graph'

interface Props {
  resource: N3.Term | null,
  children?: ReactNode
}

export const FocusContext = createContext<N3.Term[]>([])

export default function FocusNode({resource, children}: Props) {
  const parents = useContext(FocusContext)
//  const parentGraph = useGraph()
//
//  const graph = useMemo(() => {
//    if ( resource !== null ) {
//      return parentGraph.focus(resource.value)
//    } else {
//      
//    }
//  }, [resource])

  return <FocusContext.Provider value={resource ? [...parents, resource] : parents}>{children}</FocusContext.Provider>
}

export function useFocus(): N3.Term[] {
  return useContext(FocusContext)
}
