import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-wash text-ink-soft',
        cobalt: 'bg-cobalt-tint text-cobalt-text',
        lost: 'bg-lost-tint text-lost-text',
        found: 'bg-found-tint text-found-text',
        signal: 'bg-signal-tint text-signal-text',
        violet: 'bg-violet-tint text-violet-text',
        danger: 'bg-danger-tint text-danger-text',
        solid: 'bg-cobalt text-on-cobalt',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
