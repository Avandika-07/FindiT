import * as RadioGroup from '@radix-ui/react-radio-group'
import { Check } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const chipClass =
  'inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt data-[state=checked]:border-cobalt data-[state=checked]:bg-[color-mix(in_srgb,var(--cobalt)_10%,var(--surface))] data-[state=checked]:text-ink'

/** Radio group rendered as fully rounded chips (arrow keys move between options). */
export const ChipGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroup.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroup.Root>
>(({ className, ...props }, ref) => (
  <RadioGroup.Root ref={ref} className={cn('flex flex-wrap gap-2', className)} {...props} />
))
ChipGroup.displayName = 'ChipGroup'

export const Chip = React.forwardRef<
  React.ComponentRef<typeof RadioGroup.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroup.Item>
>(({ className, children, ...props }, ref) => (
  <RadioGroup.Item ref={ref} className={cn(chipClass, className)} {...props}>
    <RadioGroup.Indicator asChild>
      <Check className="-ml-1 size-4 text-cobalt" aria-hidden="true" />
    </RadioGroup.Indicator>
    {children}
  </RadioGroup.Item>
))
Chip.displayName = 'Chip'

export { RadioGroup }
