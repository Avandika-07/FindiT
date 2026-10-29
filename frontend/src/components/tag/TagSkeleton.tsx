import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function TagSkeleton({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative flex overflow-hidden rounded-tag border border-line bg-surface', className)}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-line" />
      <span className="absolute top-1/2 left-[17px] size-[15px] -translate-y-1/2 rounded-full bg-paper shadow-[0_0_0_2px_var(--line)]" />
      <div className={cn('flex flex-1 flex-col gap-3 pr-4 pl-11', compact ? 'py-3.5' : 'py-4')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24 rounded-full" />
            <Skeleton className="h-5 w-4/5 rounded-full" />
          </div>
          <Skeleton className="h-6 w-16 -rotate-4 rounded-[8px]" />
        </div>
        <div className="flex gap-5">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function RowSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex items-center gap-4 rounded-panel border border-line bg-surface shadow-card p-4', className)}>
      <Skeleton className="size-11 rounded-control" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5 rounded-full" />
        <Skeleton className="h-3 w-3/5 rounded-full" />
      </div>
      <Skeleton className="h-6 w-20 -rotate-4 rounded-[8px]" />
    </div>
  )
}

export function SkeletonList({
  count = 3,
  kind = 'tag',
  className,
  label = 'Loading',
}: {
  count?: number
  kind?: 'tag' | 'row'
  className?: string
  label?: string
}) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (kind === 'tag' ? <TagSkeleton key={i} /> : <RowSkeleton key={i} />))}
    </div>
  )
}
