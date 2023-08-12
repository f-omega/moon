import { createContext, useContext } from 'react'

interface NavContext {
  followLink(termUri: string): void,
  goBack(): void,
  mode: 'local' | 'browse',
  linkMode: 'internal' | 'external' | 'auto'
}

export const NavContext = createContext<NavContext>({
  mode: 'local',
  linkMode: 'auto',
  goBack: () => { history.back(); },
  followLink: (termUri) =>
    location.href = termUri
})

export function useNav() {
  return useContext(NavContext)
}
