import { animate, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface MatchDialProps {
  score: number
  size?: number
  /** Seconds to wait before filling (used by the staggered match reveal). */
  delay?: number
  className?: string
}

export function MatchDial({ score, size = 64, delay = 0, className }: MatchDialProps) {
  const reduce = useReducedMotion()
  const value = Math.max(0, Math.min(100, Math.round(score)))
  const [count, setCount] = useState(0)

  const stroke = Math.max(4, Math.round(size / 11))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  useEffect(() => {
    if (reduce) return
    const controls = animate(0, value, {
      duration: 1.1,
      delay,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setCount(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, delay, reduce])

  const shown = reduce ? value : count

  return (
    <div
      role="img"
      aria-label={`Match score ${value} out of 100`}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--signal-tint)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--signal)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - value / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: reduce ? 0 : 1.1, delay, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center font-display leading-none font-extrabold text-ink tabular-nums"
        style={{ fontSize: Math.round(size * 0.32) }}
      >
        {shown}
      </span>
    </div>
  )
}
