import { useQuery } from '@tanstack/react-query'
import { ErrorState } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function StatsCards() {
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats })
  if (isError) return <ErrorState title="Stats didn't load" error={error} onRetry={() => void refetch()} />

  // Each card has its own tint; one dark ink card carries a sunflower number.
  const primary = [
    {
      label: 'Open lost reports',
      value: data?.open_lost,
      card: 'border-[color-mix(in_srgb,var(--lost)_26%,var(--line))] bg-lost-tint',
      labelClass: 'text-lost-text',
      valueClass: 'text-ink',
    },
    {
      label: 'Open found reports',
      value: data?.open_found,
      card: 'border-[color-mix(in_srgb,var(--found)_26%,var(--line))] bg-found-tint',
      labelClass: 'text-found-text',
      valueClass: 'text-ink',
    },
    {
      label: 'Claims waiting for review',
      value: data?.pending_claims,
      card: 'border-[color-mix(in_srgb,var(--cobalt)_22%,var(--line))] bg-cobalt-tint',
      labelClass: 'text-cobalt-text',
      valueClass: 'text-ink',
    },
    {
      label: 'Returned this week',
      value: data?.returned_this_week,
      card: 'border-transparent bg-night',
      labelClass: 'text-night-soft',
      valueClass: 'text-signal',
    },
  ]
  const avg = data?.avg_days_to_return
  const secondary = [
    { label: 'Approved, waiting for handover', value: data?.verified_claims },
    { label: 'Returned this month', value: data?.returned_this_month },
    { label: 'Average days to return', value: avg === null ? 'None yet' : avg?.toFixed(1) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primary.map((s) => (
          <div key={s.label} className={cn('rounded-panel border p-4 shadow-card sm:p-5', s.card)}>
            <dt className={cn('text-sm font-medium', s.labelClass)}>{s.label}</dt>
            <dd className={cn('mt-2 font-display text-4xl leading-none font-extrabold tabular-nums', s.valueClass)}>
              {isPending ? <Skeleton className="h-10 w-14 bg-[color-mix(in_srgb,currentColor_18%,transparent)]" /> : s.value}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="grid gap-3 rounded-panel border border-line bg-surface p-4 shadow-card sm:grid-cols-3 sm:p-5">
        {secondary.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-ink-soft">{s.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-ink tabular-nums">
              {isPending ? <Skeleton className="h-7 w-12" /> : s.value}
            </dd>
          </div>
        ))}
      </dl>
      {data && data.by_category.length > 0 && (
        <div className="rounded-panel border border-line bg-surface p-4 shadow-card sm:p-5">
          <h3 className="mb-3 font-semibold text-ink">Reports by category</h3>
          <table className="w-full text-sm">
            <caption className="sr-only">Lost and found reports per category</caption>
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th scope="col" className="py-2 font-medium">Category</th>
                <th scope="col" className="py-2 text-right font-medium">Lost</th>
                <th scope="col" className="py-2 text-right font-medium">Found</th>
              </tr>
            </thead>
            <tbody>
              {[...data.by_category]
                .sort((a, b) => b.lost + b.found - (a.lost + a.found))
                .slice(0, 8)
                .map((row) => (
                  <tr key={row.category} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 text-left font-medium text-ink">{row.category}</th>
                    <td className="py-2 text-right text-ink tabular-nums">{row.lost}</td>
                    <td className="py-2 text-right text-ink tabular-nums">{row.found}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
