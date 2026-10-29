import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { DialogOverlay } from './dialog'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export { DialogTitle as SheetTitle, DialogDescription as SheetDescription } from './dialog'

/** Bottom sheet built on Radix Dialog (focus trap, Escape, scroll lock). */
export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-[24px] border-t border-line bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-2xl data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
        className,
      )}
      {...props}
    >
      <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-wash hover:text-ink"
          aria-label="Close"
        >
          <X className="size-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1 pr-10', className)} {...props} />
}
