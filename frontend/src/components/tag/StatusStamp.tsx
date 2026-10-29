import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { CLAIM_STATUS_LABEL, ITEM_STATUS_LABEL } from '@/lib/format'
import type { ClaimStatus, ItemStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'cobalt' | 'signal' | 'found' | 'filled' | 'danger' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-ink-soft bg-surface text-ink-soft',
  cobalt: 'border-cobalt bg-cobalt-tint text-cobalt-text',
  signal: 'border-signal bg-signal-tint text-signal-text',
  found: 'border-found bg-found-tint text-found-text',
  filled: 'border-found-fill bg-found-fill text-on-found',
  danger: 'border-danger bg-danger-tint text-danger-text',
  muted: 'border-dashed border-ink-soft bg-surface text-ink-soft',
}

const ITEM_TONE: Record<ItemStatus, Tone> = {
  OPEN: 'neutral',
  MATCHED: 'cobalt',
  CLAIM_PENDING: 'signal',
  RETURNED: 'filled',
  EXPIRED: 'muted',
  CLOSED: 'muted',
}

const CLAIM_TONE: Record<ClaimStatus, Tone> = {
  PENDING: 'signal',
  VERIFIED: 'found',
  REJECTED: 'danger',
  HANDED_OVER: 'filled',
}

interface StampProps {
  label: string
  tone: Tone
  size?: 'sm' | 'md' | 'lg'
  /** Force the "thunk" on mount (e.g. right after a status change elsewhere). */
  thunk?: boolean
  changeKey: string
  className?: string
}

function Stamp({ label, tone, size = 'md', thunk, changeKey, className }: StampProps) {
  const reduce = useReducedMotion()
  const [initialKey] = useState(changeKey)
  const animateIn = !reduce && (thunk || changeKey !== initialKey)

  return (
    <motion.span
      key={changeKey}
      initial={animateIn ? { scale: 1.6, rotate: -14, opacity: 0 } : false}
      animate={{ scale: 1, rotate: -4, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 700, damping: 18, mass: 0.6 }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-[8px] border-2 font-display leading-none font-bold whitespace-nowrap',
        size === 'sm' && 'px-1.5 py-1 text-xs',
        size === 'md' && 'px-2 py-1.5 text-[13px]',
        size === 'lg' && 'px-3 py-2 text-base',
        TONE_CLASS[tone],
        className,
      )}
    >
      {tone === 'filled' && <Check className={size === 'lg' ? 'size-4' : 'size-3.5'} strokeWidth={3} aria-hidden="true" />}
      {label}
    </motion.span>
  )
}

export function StatusStamp({
  status,
  size,
  thunk,
  className,
}: {
  status: ItemStatus
  size?: 'sm' | 'md' | 'lg'
  thunk?: boolean
  className?: string
}) {
  return (
    <Stamp
      label={ITEM_STATUS_LABEL[status] ?? status}
      tone={ITEM_TONE[status] ?? 'neutral'}
      size={size}
      thunk={thunk}
      changeKey={status}
      className={className}
    />
  )
}

export function ClaimStamp({
  status,
  size,
  thunk,
  className,
}: {
  status: ClaimStatus
  size?: 'sm' | 'md' | 'lg'
  thunk?: boolean
  className?: string
}) {
  return (
    <Stamp
      label={CLAIM_STATUS_LABEL[status] ?? status}
      tone={CLAIM_TONE[status] ?? 'neutral'}
      size={size}
      thunk={thunk}
      changeKey={status}
      className={className}
    />
  )
}
