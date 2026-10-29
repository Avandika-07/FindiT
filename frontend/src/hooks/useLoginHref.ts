import { useLocation } from 'react-router-dom'

/** /login?next=<current page>, so logging in brings people back. */
export function useLoginHref() {
  const location = useLocation()
  const next = location.pathname === '/login' ? '/' : `${location.pathname}${location.search}`
  return `/login?next=${encodeURIComponent(next)}`
}
