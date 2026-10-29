import * as React from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'flex h-11 w-full min-w-0 rounded-control border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-soft/80 transition-colors focus-visible:border-cobalt focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-cobalt disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />
  ),
)
Input.displayName = 'Input'
