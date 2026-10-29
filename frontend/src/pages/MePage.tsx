import { BellOff, CheckCheck, ClipboardList, Hand, MessageSquareText, PackageSearch } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { HandoverCode } from '@/components/claim/HandoverCode'
import { EmptyState, ErrorState } from '@/components/common/States'
import { NotificationRow } from '@/components/layout/NotificationsBell'
import { useOpenNotification } from '@/hooks/useOpenNotification'
import { Container, PageHeader } from '@/components/layout/PageHeader'
import { CategoryIcon } from '@/components/tag/CategoryIcon'
import { ClaimStamp, StatusStamp } from '@/components/tag/StatusStamp'
import { SkeletonList } from '@/components/tag/TagSkeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { useMyClaims } from '@/hooks/useClaims'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useItemTimeline, useMyItems } from '@/hooks/useItems'
import { useMarkAllRead, useNotifications } from '@/hooks/useNotifications'
import { eventPhrase, formatDateLong, formatRelative, ITEM_TYPE_LABEL, statusLabel } from '@/lib/format'
import type { Claim, Item } from '@/lib/types'
import { cn } from '@/lib/utils'

const TABS = ['reports', 'claims', 'notifications'] as const
type Tab = (typeof TABS)[number]

export default function MePage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'reports'
  const { user } = useAuth()
  const notifications = useNotifications()
  const unread = notifications.data?.unread ?? 0
  useDocumentTitle('My stuff')

  return (
    <Container className="max-w-[880px]">
      <PageHeader
        title="My stuff"
        description={user ? `Everything you've reported and claimed, ${user.display_name}.` : undefined}
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList aria-label="My stuff sections">
          <TabsTrigger value="reports">My reports</TabsTrigger>
          <TabsTrigger value="claims">My claims</TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
            {unread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-text px-1.5 text-xs font-bold text-white dark:bg-violet dark:text-paper">
                {unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="claims">
          <ClaimsTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </Container>
  )
}

function ReportsTab() {
  const { data, isPending, isError, error, refetch } = useMyItems()
  if (isError) return <ErrorState title="Your reports didn't load" error={error} onRetry={() => void refetch()} />
  if (isPending) return <SkeletonList count={3} kind="row" className="space-y-3" label="Loading your reports" />
  if (!data.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="You haven't reported anything yet"
        actions={
          <>
            <Button asChild>
              <Link to="/report/lost">Report a lost item</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/report/found">Report a found item</Link>
            </Button>
          </>
        }
      >
        Lost something, or found something that isn't yours? Report it and FindiT starts matching straight away.
      </EmptyState>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {data.map((item) => (
        <li key={item.id}>
          <ReportRow item={item} />
        </li>
      ))}
    </ul>
  )
}

function ReportRow({ item }: { item: Item }) {
  const lost = item.type === 'LOST'
  return (
    <Link
      to={`/items/${item.id}`}
      className="relative flex items-center gap-4 overflow-hidden rounded-panel border border-line bg-surface shadow-card p-4 pl-5 transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', lost ? 'bg-lost' : 'bg-found')} />
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-control',
          lost ? 'bg-lost-tint text-lost-text' : 'bg-found-tint text-found-text',
        )}
      >
        <CategoryIcon category={item.category} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{item.title}</p>
        <p className="text-sm text-ink-soft">
          <span className={lost ? 'text-lost-text' : 'text-found-text'}>{ITEM_TYPE_LABEL[item.type]}</span>{' '}
          {eventPhrase(item.event_date)}, at {item.location.name}
        </p>
        <LatestStep itemId={item.id} />
      </div>
      <StatusStamp status={item.status} size="sm" />
    </Link>
  )
}

function LatestStep({ itemId }: { itemId: number }) {
  const { data, isPending } = useItemTimeline(itemId)
  if (isPending) return <Skeleton className="mt-1.5 h-3 w-40 rounded-full" />
  const last = data?.[data.length - 1]
  if (!last) return null
  return (
    <p className="mt-1 truncate text-xs text-ink-soft">
      Latest: <span className="font-semibold text-ink">{last.from_status === null ? 'Reported' : statusLabel(last.to_status)}</span>
      {last.note ? `, ${last.note.charAt(0).toLowerCase()}${last.note.slice(1)}` : ''} ({formatRelative(last.at).toLowerCase()})
    </p>
  )
}

function ClaimsTab() {
  const { data, isPending, isError, error, refetch } = useMyClaims()
  if (isError) return <ErrorState title="Your claims didn't load" error={error} onRetry={() => void refetch()} />
  if (isPending) return <SkeletonList count={3} kind="row" className="space-y-3" label="Loading your claims" />
  if (!data.length) {
    return (
      <EmptyState
        icon={Hand}
        title="No claims yet"
        actions={
          <Button asChild>
            <Link to="/search?type=FOUND">Browse found items</Link>
          </Button>
        }
      >
        When you spot your item among the found reports, claim it and your claim will show up here.
      </EmptyState>
    )
  }
  return (
    <ul className="flex flex-col gap-4">
      {data.map((claim) => (
        <li key={claim.id}>
          <ClaimRow claim={claim} />
        </li>
      ))}
    </ul>
  )
}

function ClaimRow({ claim }: { claim: Claim }) {
  return (
    <article className="flex flex-col gap-4 rounded-panel border border-line bg-surface shadow-card p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-found-tint text-found-text">
          <CategoryIcon category={claim.item.category} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/items/${claim.item.id}`}
            className="font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-cobalt"
          >
            {claim.item.title}
          </Link>
          <p className="text-sm text-ink-soft">Claimed {formatRelative(claim.created_at).toLowerCase()}</p>
        </div>
        <ClaimStamp status={claim.status} size="sm" />
      </div>

      {claim.status === 'PENDING' && (
        <p className="text-sm text-ink-soft">
          Waiting for an admin or the finder to check your answer. We'll notify you as soon as it's decided.
        </p>
      )}
      {claim.status === 'VERIFIED' &&
        (claim.handover_code ? (
          <HandoverCode claim={claim} />
        ) : (
          <p className="text-sm text-ink-soft">Approved. Your handover code will appear here shortly.</p>
        ))}
      {claim.status === 'HANDED_OVER' && (
        <p className="text-sm text-ink">Collected on {formatDateLong(claim.updated_at)}. Glad it found its way home.</p>
      )}
      {claim.decision_note && claim.status !== 'PENDING' && (
        <p className="flex items-start gap-2 rounded-control bg-wash p-3 text-sm text-ink">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <span>
            <span className="font-semibold">Reviewer's note: </span>
            {claim.decision_note}
          </span>
        </p>
      )}
    </article>
  )
}

function NotificationsTab() {
  const { data, isPending, isError, error, refetch } = useNotifications()
  const markAll = useMarkAllRead()
  const open = useOpenNotification()
  if (isError) return <ErrorState title="Notifications didn't load" error={error} onRetry={() => void refetch()} />
  if (isPending) return <SkeletonList count={4} kind="row" className="space-y-3" label="Loading notifications" />
  if (!data.items.length) {
    return (
      <EmptyState
        icon={BellOff}
        title="No notifications yet"
        actions={
          <Button asChild variant="secondary">
            <Link to="/search">
              <PackageSearch aria-hidden="true" />
              Search items
            </Link>
          </Button>
        }
      >
        Matches, claim decisions and handovers will show up here.
      </EmptyState>
    )
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-soft">{data.unread ? `${data.unread} unread` : 'All caught up'}</p>
        {data.unread > 0 && (
          <Button variant="secondary" size="sm" className="h-11 sm:h-9" onClick={() => markAll.mutate()}>
            <CheckCheck aria-hidden="true" />
            Mark all as read
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-panel border border-line bg-surface shadow-card p-1.5">
        {data.items.map((n) => (
          <li key={n.id} className="py-0.5">
            <NotificationRow n={n} onOpen={(x) => open(x)} />
          </li>
        ))}
      </ul>
    </div>
  )
}
