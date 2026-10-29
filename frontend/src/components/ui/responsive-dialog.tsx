import * as React from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'
import { SheetContent, SheetHeader } from './sheet'

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** Dialog on desktop, bottom sheet on mobile. Same Radix primitive underneath. */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}: ResponsiveDialogProps) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const header = (
    <>
      <DialogTitle>{title}</DialogTitle>
      {description ? (
        <DialogDescription>{description}</DialogDescription>
      ) : (
        <DialogDescription className="sr-only">{title}</DialogDescription>
      )}
    </>
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {desktop ? (
        <DialogContent className={cn('max-w-xl', className)}>
          <DialogHeader>{header}</DialogHeader>
          {children}
        </DialogContent>
      ) : (
        <SheetContent className={className}>
          <SheetHeader>{header}</SheetHeader>
          {children}
        </SheetContent>
      )}
    </Dialog>
  )
}
