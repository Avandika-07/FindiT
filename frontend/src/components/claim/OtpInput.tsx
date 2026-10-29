import { useAnimate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { isCompleteCode } from '@/lib/otp'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  /** Fixed-length string; empty slots are spaces. */
  value: string
  onChange: (value: string) => void
  length?: number
  /** Change this number to shake the boxes (wrong code). */
  shakeKey?: number
  invalid?: boolean
  disabled?: boolean
  size?: 'md' | 'lg'
  label?: string
  autoFocus?: boolean
  onComplete?: (code: string) => void
  describedBy?: string
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  shakeKey = 0,
  invalid,
  disabled,
  size = 'lg',
  label = 'Handover code',
  autoFocus,
  onComplete,
  describedBy,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduce = useReducedMotion()
  const chars = value.padEnd(length, ' ').slice(0, length).split('')

  useEffect(() => {
    if (!shakeKey || !scope.current) return
    if (reduce) return
    void animate(scope.current, { x: [0, -12, 12, -9, 9, -5, 5, 0] }, { duration: 0.45 })
  }, [shakeKey, animate, scope, reduce])

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))]
    el?.focus()
    el?.select()
  }

  const commit = (next: string[]) => {
    const joined = next.join('')
    onChange(joined)
    if (isCompleteCode(joined, length)) onComplete?.(joined)
  }

  const fillFrom = (start: number, digits: string) => {
    const next = [...chars]
    let i = start
    for (const d of digits) {
      if (i >= length) break
      next[i] = d
      i += 1
    }
    commit(next)
    focus(Math.min(i, length - 1))
  }

  const handleChange = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return
    if (digits.length > 1) {
      fillFrom(i, digits)
      return
    }
    const next = [...chars]
    next[i] = digits
    commit(next)
    if (i < length - 1) focus(i + 1)
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...chars]
      if (chars[i] !== ' ') {
        next[i] = ' '
        commit(next)
      } else if (i > 0) {
        next[i - 1] = ' '
        commit(next)
        focus(i - 1)
      }
    } else if (e.key === 'Delete') {
      e.preventDefault()
      const next = [...chars]
      next[i] = ' '
      commit(next)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(i + 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focus(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focus(length - 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return
    e.preventDefault()
    // A full paste always fills every box from the first one.
    fillFrom(digits.length >= length ? 0 : chars.indexOf(' ') === -1 ? 0 : chars.indexOf(' '), digits)
  }

  return (
    <div
      ref={scope}
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn('flex justify-center', size === 'lg' ? 'gap-2 sm:gap-3' : 'gap-2')}
    >
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={ch === ' ' ? '' : ch}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'rounded-control border-2 bg-surface text-center font-display font-extrabold text-ink caret-cobalt transition-colors focus-visible:border-cobalt focus-visible:outline-none disabled:opacity-60',
            size === 'lg' ? 'h-16 w-12 text-3xl sm:h-20 sm:w-16 sm:text-4xl' : 'h-14 w-11 text-2xl',
            invalid ? 'border-danger' : ch !== ' ' ? 'border-ink-soft' : 'border-line-strong',
          )}
        />
      ))}
    </div>
  )
}
