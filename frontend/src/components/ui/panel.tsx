import * as React from 'react'
import { cn } from '@/lib/utils'

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-panel border border-line bg-surface shadow-card', className)} {...props} />
}
