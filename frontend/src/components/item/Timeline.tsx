import { ErrorState } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelative, statusLabel } from '@/lib/format'
import type { TimelineEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Courier-style tracking list: newest step highlighted at the top. */
export function Timeline({
  entries,
  isPending,
  error,
  onRetry,
}: {
  entries: TimelineEntry[] | undefined
  isPending: boolean
  error: unknown
  onRetry: () => void
}) {
  if (error) return <ErrorState compact title="The history didn't load" error={error} onRetry={onRetry} />
  if (isPending) {
    return (
      <div className="space-y-5" role="status">
        <span className="sr-only">Loading history</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="size-4 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-3 w-48 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (!entries?.length) return <p className="text-sm text-ink-soft">No history yet.</p>

  const ordered = [...entries].reverse()

  return (
    <ol className="relative">
      {ordered.map((entry, i) => {
        const latest = i === 0
        const last = i === ordered.length - 1
        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-5 bottom-0 left-[7px] w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_4px,transparent_4px_8px)]"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 mt-1 size-4 shrink-0 rounded-full border-2',
                latest ? 'border-cobalt bg-cobalt ring-4 ring-[color-mix(in_srgb,var(--cobalt)_18%,transparent)]' : 'border-line-strong bg-surface',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm', latest ? 'font-bold text-ink' : 'font-semibold text-ink')}>
                {entry.from_status === null ? 'Reported' : statusLabel(entry.to_status)}
              </p>
              {entry.note && <p className="mt-0.5 text-sm text-ink-soft">{entry.note}</p>}
              <p className="mt-1 text-xs text-ink-soft">
                <time dateTime={entry.at} title={formatDateTime(entry.at)}>
                  {formatRelative(entry.at)}
                </time>
                {entry.actor && <span>, by {entry.actor.display_name}</span>}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
