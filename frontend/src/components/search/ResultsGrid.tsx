import type { ReactNode } from 'react'
import { TagSkeleton } from '@/components/tag/TagSkeleton'
import { cn } from '@/lib/utils'

export function ResultsGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3', className)}>{children}</ul>
}

export function ResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading results</span>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: count }, (_, i) => (
          <TagSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
