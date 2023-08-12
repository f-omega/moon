import { MouseEvent, ReactNode, useMemo } from 'react'

import { useNav } from '../nav'

interface Props {
  to: string,
  children: ReactNode
}

export default function ResourceLink({to, children}: Props) {
  const { followLink, mode, linkMode } = useNav()
  const href = useMemo(() => {
    let toUri
  try {
    toUri = new URL(to)
    } catch (e) {
      return to
    }
    let originMatches = toUri.origin == location.origin

    const browseLink = `?loc=${encodeURIComponent(to)}`

    if ( linkMode == 'internal' ) {
      if ( originMatches ) {
        return to
      } else {
        return browseLink
      }
    } else if ( linkMode == 'external' ) {
      return to
    } else if ( linkMode == 'auto' ) {
      if ( originMatches ) {
        return to
      } else {
        // Attempt to check if the URL is resolvable. If it is, return a link.
        // Otherwise switch to browse. TODO
        return browseLink
      }
    }

    return to
  }, [to, mode])

  function follow(e: MouseEvent) {
    followLink(to)
    e.preventDefault()
    return false
  }

  return <a href={href} onClick={follow}>{children}</a>
}
