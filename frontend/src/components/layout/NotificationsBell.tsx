import { Bell, BellOff, CheckCheck, Inbox, Sparkles, ShieldCheck, ShieldX, PackageCheck, Info, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarkAllRead, useNotifications } from '@/hooks/useNotifications'
import { useOpenNotification } from '@/hooks/useOpenNotification'
import { errorMessage } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import type { AppNotification, NotificationKind } from '@/lib/types'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  MATCH: Sparkles,
  CLAIM_NEW: Inbox,
  CLAIM_VERIFIED: ShieldCheck,
  CLAIM_REJECTED: ShieldX,
  RETURNED: PackageCheck,
  SYSTEM: Info,
}

export function NotificationRow({
  n,
  onOpen,
  dense,
}: {
  n: AppNotification
  onOpen: (n: AppNotification) => void
  dense?: boolean
}) {
  const Icon = KIND_ICON[n.kind] ?? Info
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        'flex w-full items-start gap-3 rounded-control text-left transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-cobalt',
        dense ? 'p-2.5' : 'p-3.5',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
          n.is_read ? 'bg-wash text-ink-soft' : 'bg-violet-tint text-violet-text',
        )}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm text-ink', n.is_read ? 'font-medium' : 'font-bold')}>{n.title}</span>
        {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-ink-soft">{n.body}</span>}
        <span className="mt-1 block text-xs text-ink-soft">{formatRelative(n.created_at)}</span>
      </span>
      {!n.is_read && (
        <span className="mt-2 size-2.5 shrink-0 rounded-full bg-violet">
          <span className="sr-only">Unread</span>
        </span>
      )}
    </button>
  )
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { data, isPending, isError, error } = useNotifications()
  const markAll = useMarkAllRead()
  const openNotification = useOpenNotification()
  const unread = data?.unread ?? 0
  const latest = data?.items.slice(0, 6) ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-violet-text px-1 text-[11px] leading-none font-bold text-white dark:bg-violet dark:text-paper"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-2">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <h2 className="font-semibold text-ink">Notifications</h2>
          {unread > 0 && (
            <Button variant="quiet" size="sm" onClick={() => markAll.mutate()}>
              <CheckCheck aria-hidden="true" />
              Mark all as read
            </Button>
          )}
        </div>
        <div className="max-h-[22rem] overflow-y-auto">
          {isPending ? (
            <div className="space-y-2 p-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4 rounded-full" />
                    <Skeleton className="h-3 w-1/2 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="p-3 text-sm text-ink-soft" role="alert">
              {errorMessage(error)}
            </p>
          ) : latest.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff className="size-6 text-ink-soft" aria-hidden="true" />
              <p className="text-sm text-ink-soft">Nothing new. We'll tell you here when something matches.</p>
            </div>
          ) : (
            latest.map((n) => <NotificationRow key={n.id} n={n} dense onOpen={(x) => openNotification(x, () => setOpen(false))} />)
          )}
        </div>
        <div className="mt-1 border-t border-line px-1 pt-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/me?tab=notifications" onClick={() => setOpen(false)}>
              See all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
