import { CloudOff, RefreshCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
  className,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-panel border border-dashed border-line-strong px-6 py-10 text-center',
        className,
      )}
    >
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-wash text-ink-soft">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-ink-soft">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  )
}

function hintFor(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if (error.status === 0) return 'When the server is back, retry and this will load.'
  if (error.status >= 500) return 'This is a problem on the server, not with what you did.'
  return null
}

export function ErrorState({
  title = "This didn't load",
  error,
  onRetry,
  className,
  compact,
}: {
  title?: string
  error: unknown
  onRetry?: () => void
  className?: string
  compact?: boolean
}) {
  const hint = hintFor(error)
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-panel border border-line bg-surface shadow-card sm:flex-row sm:items-center',
        compact ? 'p-4' : 'p-5 sm:p-6',
        className,
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger">
        <CloudOff className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-soft">{errorMessage(error)}</p>
        {hint && <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="shrink-0">
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}
