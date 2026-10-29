import { useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { Tooltip } from '@/components/ui/tooltip'
import type { HotspotsResponse } from '@/lib/types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

type Kind = 'lost' | 'found'
type Row = HotspotsResponse['by_weekday'][number]

/**
 * Single-hue ramp (surface -> lost/found). Empty cells are a neutral wash, and any
 * non-zero count starts at a clearly visible tint so 0 and 1 never look alike.
 */
function shade(kind: Kind, n: number, max: number) {
  if (n === 0 || max === 0) return 'var(--wash)'
  return `color-mix(in srgb, var(--${kind}) ${Math.round(20 + (n / max) * 46)}%, var(--surface))`
}

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

/** Names the top entries; when more than two tie, says how many instead of listing them all. */
function leaders(names: readonly string[], values: number[], plural: string) {
  const top = Math.max(0, ...values)
  if (top === 0) return null
  const tied = names.filter((_, i) => values[i] === top)
  if (tied.length > 2) return { label: `${tied.length} ${plural} tie`, detail: `${items(top)} each` }
  return { label: tied.join(' and '), detail: tied.length > 1 ? `${items(top)} each` : items(top) }
}

export function WeekdayHeatmap({ rows }: { rows: HotspotsResponse['by_weekday'] }) {
  const [kind, setKind] = useState<Kind>('lost')
  const verb = kind === 'lost' ? 'lost' : 'found'

  const total = (r: Row) => r[kind].reduce((a, b) => a + b, 0)
  // Busiest zone first, so the table reads top-down from most to least.
  const sorted = [...rows].sort((a, b) => total(b) - total(a) || a.zone.localeCompare(b.zone))
  const max = Math.max(0, ...rows.flatMap((r) => r[kind]))
  const dayTotals = DAYS.map((_, d) => rows.reduce((sum, r) => sum + r[kind][d], 0))
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0)

  const busiestDay = leaders(DAY_NAMES, dayTotals, 'days')
  const busiestZone = leaders(
    sorted.map((r) => r.zone),
    sorted.map(total),
    'zones',
  )
  const cells = sorted.flatMap((r) => r[kind].map((n, d) => ({ label: `${r.zone} on ${DAY_NAMES[d]}`, n })))
  const hotspot = leaders(
    cells.map((c) => c.label),
    cells.map((c) => c.n),
    'boxes',
  )

  const takeaways = [
    { label: 'Busiest day', value: busiestDay },
    { label: 'Busiest zone', value: busiestZone },
    { label: 'Busiest box', value: hotspot },
  ]

  return (
    <section aria-labelledby="heatmap-title" className="rounded-panel border border-line bg-surface shadow-card p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 id="heatmap-title" className="font-semibold text-ink">
            Which days are items {verb}?
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Each box shows how many items were {verb} in a zone on that day of the week. Darker boxes mean more items.
          </p>
        </div>
        <Segmented
          label="Show"
          value={kind}
          onValueChange={setKind}
          options={[
            { value: 'lost', label: 'Lost items' },
            { value: 'found', label: 'Found items' },
          ]}
          className="w-full sm:w-auto sm:min-w-60"
        />
      </div>

      {weekTotal === 0 ? (
        <p className="rounded-panel bg-wash p-4 text-sm text-ink-soft">No {verb} items reported yet.</p>
      ) : (
        <>
          <dl className="mb-5 divide-y divide-line rounded-panel bg-wash sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {takeaways.map((t) => (
              <div key={t.label} className="flex items-baseline justify-between gap-3 px-4 py-2.5 sm:block sm:py-3">
                <dt className="shrink-0 text-xs font-medium text-ink-soft">{t.label}</dt>
                <dd className="text-right font-semibold text-ink sm:mt-0.5 sm:text-left">
                  {t.value?.label}
                  <span className="block text-sm font-normal text-ink-soft sm:ml-1.5 sm:inline">{t.value?.detail}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] table-fixed border-separate border-spacing-1 text-sm">
              <caption className="sr-only">
                Items {verb} per zone and day of the week
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-24 text-left text-xs font-medium text-ink-soft sm:w-40">
                    Zone
                  </th>
                  {DAYS.map((d, i) => (
                    <th key={d} scope="col" className="text-center text-xs font-medium text-ink-soft">
                      <span className="lg:hidden">{d}</span>
                      <span className="hidden lg:inline">{DAY_NAMES[i]}</span>
                    </th>
                  ))}
                  <th scope="col" className="w-10 text-right text-xs font-medium text-ink-soft sm:w-20">
                    <span className="sm:hidden">All</span>
                    <span className="hidden sm:inline">Whole week</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.zone}>
                    <th scope="row" className="truncate text-left font-medium text-ink" title={r.zone}>
                      {r.zone}
                    </th>
                    {r[kind].map((n, d) => (
                      <Tooltip
                        key={d}
                        content={n ? `${items(n)} ${verb} in ${r.zone} on ${DAY_NAMES[d]}s` : `Nothing ${verb} in ${r.zone} on ${DAY_NAMES[d]}s`}
                      >
                        <td
                          tabIndex={0}
                          aria-label={`${r.zone}, ${DAY_NAMES[d]}: ${items(n)}`}
                          className="h-11 rounded-[6px] text-center font-bold text-ink tabular-nums outline-cobalt transition-shadow hover:ring-2 hover:ring-ink/40 focus-visible:outline-2"
                          style={{ backgroundColor: shade(kind, n, max) }}
                        >
                          {n > 0 ? n : ''}
                        </td>
                      </Tooltip>
                    ))}
                    <td className="text-right font-semibold text-ink tabular-nums">{total(r)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="truncate border-t border-line pt-2 text-left text-xs font-medium text-ink-soft">
                    All zones
                  </th>
                  {dayTotals.map((n, d) => (
                    <td key={d} className="border-t border-line pt-2 text-center text-xs font-semibold text-ink-soft tabular-nums">
                      {n}
                    </td>
                  ))}
                  <td className="border-t border-line pt-2 text-right text-xs font-semibold text-ink tabular-nums">{weekTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <Key kind={kind} max={max} />
        </>
      )}
    </section>
  )
}

/** Swatches labelled with the real counts they stand for, so the colours need no decoding. */
function Key({ kind, max }: { kind: Kind; max: number }) {
  const values = max <= 6 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, ...[0.25, 0.5, 0.75, 1].map((s) => Math.max(1, Math.round(s * max)))]
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft" aria-hidden="true">
      <span>Items per box:</span>
      <span className="flex items-center gap-1">
        {[...new Set(values)].map((v) => (
          <span key={v} className="flex flex-col items-center gap-0.5">
            <span className="h-4 w-7 rounded-[4px] border border-line" style={{ backgroundColor: shade(kind, v, max) }} />
            <span className="tabular-nums">{v}</span>
          </span>
        ))}
      </span>
      <span>Empty box = none.</span>
    </div>
  )
}
