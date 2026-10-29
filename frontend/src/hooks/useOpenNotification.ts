import { useNavigate } from 'react-router-dom'
import type { AppNotification } from '@/lib/types'
import { useMarkRead } from './useNotifications'

/** Mark a notification read and follow its link. */
export function useOpenNotification() {
  const navigate = useNavigate()
  const markRead = useMarkRead()
  return (n: AppNotification, after?: () => void) => {
    if (!n.is_read) markRead.mutate(n.id)
    after?.()
    if (n.link) {
      if (n.link.startsWith('/')) navigate(n.link)
      else window.location.assign(n.link)
    }
  }
}
