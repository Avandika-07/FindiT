import { Hand, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Dialog } from '@/components/ui/dialog'
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export function ReportChoiceTile({
  kind,
  onNavigate,
  size = 'md',
}: {
  kind: 'lost' | 'found'
  onNavigate?: () => void
  size?: 'md' | 'lg'
}) {
  const lost = kind === 'lost'
  const Icon = lost ? Search : Hand
  return (
    <Link
      to={`/report/${kind}`}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-start gap-4 overflow-hidden rounded-panel border text-left shadow-card transition-[border-color,box-shadow] hover:shadow-tag-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt',
        lost
          ? 'border-[color-mix(in_srgb,var(--lost)_28%,var(--line))] bg-lost-tint hover:border-lost'
          : 'border-[color-mix(in_srgb,var(--found)_30%,var(--line))] bg-found-tint hover:border-found',
        size === 'lg' ? 'p-6 sm:p-7' : 'p-4',
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', lost ? 'bg-lost' : 'bg-found')} />
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-control text-white dark:text-paper',
          size === 'lg' ? 'size-14' : 'size-11',
          lost ? 'bg-lost-text' : 'bg-found-fill',
        )}
      >
        <Icon className={size === 'lg' ? 'size-6' : 'size-5'} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={cn('block font-display font-bold text-ink', size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg')}>
          {lost ? 'I lost something' : 'I found something'}
        </span>
        <span className="mt-1 block text-sm text-ink-soft">
          {lost
            ? 'Describe it once. We check every found report for a match and tell you.'
            : 'Log where you found it and set a secret question so only the owner can claim it.'}
        </span>
      </span>
    </Link>
  )
}

export function ReportChooser({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const close = () => onOpenChange(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>What would you like to report?</SheetTitle>
          <SheetDescription>It takes about a minute.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3">
          <ReportChoiceTile kind="lost" onNavigate={close} />
          <ReportChoiceTile kind="found" onNavigate={close} />
        </div>
      </SheetContent>
    </Dialog>
  )
}
