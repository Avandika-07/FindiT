import { useEffect } from 'react'
import { env } from '@/lib/env'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} – ${env.appName}` : `${env.appName}, campus lost and found`
  }, [title])
}
