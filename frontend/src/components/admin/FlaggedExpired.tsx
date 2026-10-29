import { useQuery } from '@tanstack/react-query'
import { Flag, Hourglass } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/common/States'
import { ItemTag } from '@/components/tag/ItemTag'
import { SkeletonList } from '@/components/tag/TagSkeleton'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'

export function FlaggedExpired() {
  const flagged = useQuery({ queryKey: ['admin', 'flagged'], queryFn: api.adminFlagged })
  const expired = useQuery({ queryKey: ['admin', 'expired'], queryFn: api.adminExpired })

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="flagged-title">
        <h3 id="flagged-title" className="mb-1 font-semibold text-ink">
          Flagged students
        </h3>
        <p className="mb-4 text-sm text-ink-soft">Accounts with repeated rejected claims. Check their claims carefully.</p>
        {flagged.isError ? (
          <ErrorState compact title="Flagged students didn't load" error={flagged.error} onRetry={() => void flagged.refetch()} />
        ) : flagged.isPending ? (
          <SkeletonList count={3} kind="row" className="space-y-2" label="Loading flagged students" />
        ) : flagged.data.length === 0 ? (
          <EmptyState icon={Flag} title="No one is flagged">
            Students are flagged automatically after several rejected claims.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-panel border border-line bg-surface shadow-card">
            {flagged.data.map((u) => (
              <li key={u.id} className="flex items-center gap-3 p-4">
                <Flag className="size-4 shrink-0 text-danger" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{u.full_name || u.display_name}</p>
                  <p className="text-sm text-ink-soft">{u.roll_no}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-ink">{plural(u.rejected_claims, 'rejection')}</p>
                  <p className="text-ink-soft">{u.karma} karma</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="expired-title">
        <h3 id="expired-title" className="mb-1 font-semibold text-ink">
          Expired items
        </h3>
        <p className="mb-4 text-sm text-ink-soft">Reports that stayed open past the expiry period.</p>
        {expired.isError ? (
          <ErrorState compact title="Expired items didn't load" error={expired.error} onRetry={() => void expired.refetch()} />
        ) : expired.isPending ? (
          <SkeletonList count={2} className="space-y-3" label="Loading expired items" />
        ) : expired.data.length === 0 ? (
          <EmptyState icon={Hourglass} title="Nothing has expired">
            Items expire when they stay open too long without a match or claim.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {expired.data.map((item) => (
              <li key={item.id}>
                <ItemTag item={item} compact className="h-full" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
