import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 rounded-[10px] bg-ink px-2.5 py-1.5 text-xs font-medium text-paper shadow-lg data-[state=delayed-open]:animate-pop-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
