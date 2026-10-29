import { Link } from 'react-router-dom'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

export function TagMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden="true">
      <rect x="2" y="7" width="28" height="18" rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
      <path d="M2 13a6 6 0 0 1 6-6h0v18h0a6 6 0 0 1-6-6z" fill="var(--found)" />
      <circle cx="12" cy="16" r="2.6" fill="var(--paper)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M18 13h7M18 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center gap-2 rounded-control font-display text-[22px] font-extrabold tracking-tight text-ink',
        className,
      )}
      aria-label={`${env.appName} home`}
    >
      <TagMark />
      <span aria-hidden="true">{env.appName}</span>
    </Link>
  )
}
