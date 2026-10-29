import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { MatchBreakdown as Breakdown } from '@/lib/types'

const ROWS: { key: keyof Breakdown; label: string; max: number }[] = [
  { key: 'category', label: 'Category', max: 25 },
  { key: 'text', label: 'Description', max: 30 },
  { key: 'color', label: 'Colour', max: 10 },
  { key: 'brand', label: 'Brand', max: 10 },
  { key: 'location', label: 'Place', max: 15 },
  { key: 'time', label: 'Time', max: 10 },
]

export function MatchBreakdown({ breakdown, reasons }: { breakdown: Breakdown; reasons: string[] }) {
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-2.5">
        {ROWS.map((row) => {
          const value = Math.max(0, Math.min(row.max, breakdown[row.key] ?? 0))
          const pct = (value / row.max) * 100
          return (
            <div key={row.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
              <dt className="text-sm text-ink">{row.label}</dt>
              <dd className="h-2 overflow-hidden rounded-full bg-wash" aria-hidden="true">
                <motion.div
                  className="h-full rounded-full bg-cobalt"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </dd>
              <dd className="text-right text-xs text-ink-soft tabular-nums">
                <span className="sr-only">{row.label}: </span>
                {value} of {row.max}
              </dd>
            </div>
          )
        })}
      </dl>
      {reasons.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-sm text-ink">
              <Check className="mt-0.5 size-4 shrink-0 text-found-text" aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
