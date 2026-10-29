import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A large luggage tag used for the 404 and error pages. */
export function TagMessage({
  title,
  children,
  actions,
  code,
  tone = 'neutral',
}: {
  title: string
  children?: ReactNode
  actions?: ReactNode
  code?: string
  tone?: 'neutral' | 'lost'
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-10 sm:py-16">
      <div aria-hidden="true" className="mb-[-6px] h-12 w-px border-l-2 border-dashed border-line-strong" />
      <div className="relative w-full -rotate-2 overflow-hidden rounded-tag border border-line bg-surface shadow-tag">
        <span className={cn('absolute inset-y-0 left-0 w-2', tone === 'lost' ? 'bg-lost' : 'bg-line-strong')} />
        <span className="absolute top-1/2 left-6 size-5 -translate-y-1/2 rounded-full bg-paper shadow-[inset_0_1px_2px_rgb(0_0_0/0.18),0_0_0_2px_var(--line-strong)]" />
        <div className="py-8 pr-6 pl-16 sm:py-10 sm:pr-10 sm:pl-20">
          {code && <p className="font-display text-4xl font-extrabold text-ink-soft">{code}</p>}
          <h1 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">{title}</h1>
          {children && <div className="mt-3 text-base text-ink-soft">{children}</div>}
        </div>
      </div>
      {actions && <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  )
}
