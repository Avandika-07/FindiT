import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

interface SegmentedProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
  className?: string
}

/** Single-select segmented control (Radix ToggleGroup) that never ends up empty. */
export function Segmented<T extends string>({ value, onValueChange, options, label, className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className={cn('inline-flex w-full rounded-control border border-line-strong bg-wash p-1', className)}
    >
      {options.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          className="h-9 flex-1 rounded-[9px] px-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-cobalt data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-sm"
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
