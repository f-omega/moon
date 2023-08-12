import { createContext, useContext } from 'react'
import Cache from './common/cache'

export { Cache }

export const CacheContext = createContext<Cache>(new Cache())

export function useCache(): Cache {
  return useContext(CacheContext)
}
