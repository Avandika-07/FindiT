import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepDef } from './schema'

export function StepIndicator({
  steps,
  current,
  onJump,
}: {
  steps: StepDef[]
  current: number
  /** Jump back to an earlier step. */
  onJump: (index: number) => void
}) {
  return (
    <nav aria-label="Report progress" className="mb-8">
      <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
        Step {current + 1} of {steps.length}
        <span className="sm:hidden">: {steps[current].label}</span>
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={step.id} className={cn('flex min-w-0 items-center gap-2', i < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${step.label}${done ? ', done. Go back to this step' : active ? ', current step' : ''}`}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt disabled:cursor-default',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-full border-2 text-sm font-bold transition-colors',
                    done && 'border-cobalt bg-cobalt text-on-cobalt',
                    active && 'border-cobalt bg-surface text-cobalt',
                    !done && !active && 'border-line-strong bg-surface text-ink-soft',
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-sm whitespace-nowrap md:inline',
                    active ? 'font-semibold text-ink' : 'text-ink-soft',
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn('h-0.5 min-w-3 flex-1 rounded-full', i < current ? 'bg-cobalt' : 'bg-line')}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
