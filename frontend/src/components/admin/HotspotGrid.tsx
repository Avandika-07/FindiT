import { useQuery } from '@tanstack/react-query'
import { MapPinned } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorState } from '@/components/common/States'
import { WeekdayHeatmap } from '@/components/admin/WeekdayHeatmap'
import { Skeleton } from '@/components/ui/skeleton'
import { useThemeTokens } from '@/hooks/useTheme'
import { api } from '@/lib/api'
import type { HotspotsResponse } from '@/lib/types'

export function HotspotGrid() {
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['admin', 'hotspots'], queryFn: api.adminHotspots })
  if (isError) return <ErrorState title="Hotspots didn't load" error={error} onRetry={() => void refetch()} />
  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" role="status">
        <span className="sr-only">Loading hotspots</span>
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-panel" />
        ))}
      </div>
    )
  }
  const max = Math.max(0, ...data.zones.flatMap((z) => z.locations.map((l) => l.lost_count)))
  if (!data.zones.length) {
    return (
      <EmptyState icon={MapPinned} title="No reports to map yet">
        Once students report lost items, the busiest places show up here.
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="chart-title" className="rounded-panel border border-line bg-surface shadow-card p-4 sm:p-6">
        <h3 id="chart-title" className="font-semibold text-ink">
          Top places for lost items
        </h3>
        <p className="mb-4 text-sm text-ink-soft">Lost reports per place, top 8.</p>
        <TopChart top={data.top} />
      </section>

      <WeekdayHeatmap rows={data.by_weekday ?? []} />

      <section aria-labelledby="zones-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="zones-title" className="font-semibold text-ink">
              Every place, by zone
            </h3>
            <p className="text-sm text-ink-soft">Darker tiles have more lost reports.</p>
          </div>
          <Legend max={max} />
        </div>
        <div className="flex flex-col gap-6">
          {data.zones.map((z) => (
            <div key={z.zone}>
              <h4 className="mb-2 text-sm font-medium text-ink-soft">{z.zone}</h4>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {z.locations.map((l) => {
                  const share = max ? l.lost_count / max : 0
                  return (
                    <li
                      key={l.id}
                      className="rounded-panel border border-line p-3.5"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--lost) ${Math.round(4 + share * 50)}%, var(--surface))`,
                      }}
                    >
                      <p className="truncate text-sm font-semibold text-ink">{l.name}</p>
                      <p className="mt-1 text-sm text-ink">
                        <span className="font-display text-xl font-extrabold tabular-nums">{l.lost_count}</span> lost
                        <span className="ml-2 text-ink-soft">{l.found_count} found</span>
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Legend({ max }: { max: number }) {
  const steps = [0, 0.25, 0.5, 0.75, 1]
  return (
    <div className="flex items-center gap-2 text-xs text-ink-soft" aria-hidden="true">
      <span>0</span>
      <span className="flex overflow-hidden rounded-full border border-line">
        {steps.map((s) => (
          <span
            key={s}
            className="h-3 w-6"
            style={{ backgroundColor: `color-mix(in srgb, var(--lost) ${Math.round(4 + s * 50)}%, var(--surface))` }}
          />
        ))}
      </span>
      <span>{max}</span>
    </div>
  )
}

const TOKENS = ['lost', 'ink', 'ink-soft', 'line', 'surface', 'wash'] as const

function TopChart({ top }: { top: HotspotsResponse['top'] }) {
  const t = useThemeTokens(TOKENS)
  const rows = top.slice(0, 8).map((r) => ({ name: r.name, zone: r.zone, lost: r.lost_count }))
  if (!rows.length) return <p className="text-sm text-ink-soft">No lost reports yet.</p>

  return (
    <>
      <div className="h-[340px] w-full" role="img" aria-label={`Bar chart of lost reports. ${rows.map((r) => `${r.name}: ${r.lost}`).join('. ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke={t.line} strokeDasharray="3 4" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: t['ink-soft'], fontSize: 13 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fill: t.ink, fontSize: 13 }}
              axisLine={{ stroke: t.line }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: t.wash }}
              contentStyle={{
                background: t.surface,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                color: t.ink,
                fontSize: 13,
              }}
              labelStyle={{ color: t.ink, fontWeight: 600 }}
              itemStyle={{ color: t.ink }}
              formatter={(value) => [value as number, 'Lost reports']}
            />
            <Bar dataKey="lost" name="Lost reports" fill={t.lost} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Lost reports by place</caption>
        <thead>
          <tr>
            <th scope="col">Place</th>
            <th scope="col">Zone</th>
            <th scope="col">Lost reports</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              <td>{r.zone}</td>
              <td>{r.lost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
