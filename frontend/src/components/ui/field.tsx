import { CircleAlert } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string
  optional?: boolean
  counter?: { value: number; max: number }
  className?: string
  children: React.ReactNode
}

/** Label + control + hint + inline error, wired with aria-describedby by the caller via ids. */
export function Field({ id, label, hint, error, optional, counter, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-soft">(optional)</span>}
        </Label>
        {counter && (
          <span
            className={cn(
              'text-xs tabular-nums text-ink-soft',
              counter.value > counter.max && 'font-semibold text-danger',
            )}
          >
            {counter.value} of {counter.max}
          </span>
        )}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export function describedBy(id: string, error?: string, hint?: boolean) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}
