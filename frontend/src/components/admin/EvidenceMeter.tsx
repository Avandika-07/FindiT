import { ShieldCheck, ShieldX, TriangleAlert } from 'lucide-react'
import { GUIDANCE_LABEL } from '@/lib/format'
import type { Guidance } from '@/lib/types'
import { cn } from '@/lib/utils'

export function EvidenceMeter({
  label,
  value,
  max = 100,
  display,
  empty,
}: {
  label: string
  value: number | null
  max?: number
  display?: string
  /** Text shown when there is no value (e.g. no proof photo). */
  empty?: string
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        <span className="text-sm font-semibold text-ink tabular-nums">{value === null ? empty ?? 'None' : display ?? `${value}%`}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value ?? 0}
        aria-valuetext={value === null ? empty ?? 'None' : display ?? `${value}%`}
        className="h-2 overflow-hidden rounded-full bg-wash"
      >
        <div className="h-full rounded-full bg-cobalt transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const GUIDANCE_STYLE: Record<Guidance, { icon: typeof ShieldCheck; className: string }> = {
  STRONG: { icon: ShieldCheck, className: 'border-found-text text-found-text' },
  WEAK: { icon: ShieldX, className: 'border-danger text-danger' },
  CHECK_CAREFULLY: { icon: TriangleAlert, className: 'border-signal-text text-signal-text' },
}

export function GuidanceChip({ guidance }: { guidance: Guidance }) {
  const style = GUIDANCE_STYLE[guidance] ?? GUIDANCE_STYLE.CHECK_CAREFULLY
  const Icon = style.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold', style.className)}>
      <Icon className="size-4" aria-hidden="true" />
      {GUIDANCE_LABEL[guidance] ?? guidance}
    </span>
  )
}
