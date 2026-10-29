import { ArrowLeft, Archive, Inbox, LogIn, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ClaimReviewRow } from '@/components/claim/ClaimReviewRow'
import { ClaimSheet } from '@/components/claim/ClaimSheet'
import { EmptyState, ErrorState } from '@/components/common/States'
import { TagMessage } from '@/components/common/TagMessage'
import { MatchCard } from '@/components/item/MatchCard'
import { PhotoViewer } from '@/components/item/PhotoViewer'
import { Timeline } from '@/components/item/Timeline'
import { Container } from '@/components/layout/PageHeader'
import { useLoginHref } from '@/hooks/useLoginHref'
import { CategoryIcon } from '@/components/tag/CategoryIcon'
import { ClaimStamp, StatusStamp } from '@/components/tag/StatusStamp'
import { RowSkeleton, SkeletonList } from '@/components/tag/TagSkeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useItemClaims, useMyClaims } from '@/hooks/useClaims'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  useItem,
  useItemAiReviews,
  useItemMatches,
  useItemTimeline,
  useRerunAiReview,
  useUpdateItem,
} from '@/hooks/useItems'
import { ApiError, errorMessage } from '@/lib/api'
import { formatDateLong, ITEM_TYPE_LABEL } from '@/lib/format'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'

const CLAIMABLE = new Set(['OPEN', 'MATCHED', 'CLAIM_PENDING'])

export default function ItemPage() {
  const params = useParams()
  const itemId = Number(params.id)
  const itemQ = useItem(itemId)
  useDocumentTitle(itemQ.data?.title ?? 'Item')

  if (!Number.isInteger(itemId) || itemId < 1 || (itemQ.error instanceof ApiError && itemQ.error.status === 404)) {
    return (
      <TagMessage
        code="404"
        title="This tag has no item attached"
        actions={
          <Button asChild>
            <Link to="/search">Browse items</Link>
          </Button>
        }
      >
        This item doesn't exist or was removed by the person who reported it.
      </TagMessage>
    )
  }

  return (
    <Container>
      <BackButton />
      {itemQ.isError ? (
        <ErrorState title="This item didn't load" error={itemQ.error} onRetry={() => void itemQ.refetch()} />
      ) : itemQ.isPending ? (
        <ItemSkeleton />
      ) : (
        <ItemDetail item={itemQ.data} />
      )}
    </Container>
  )
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <Button
      variant="quiet"
      size="sm"
      className="-ml-2 mb-4 h-11"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/search'))}
    >
      <ArrowLeft aria-hidden="true" />
      Back
    </Button>
  )
}

function ItemSkeleton() {
  return (
    <div role="status" className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <span className="sr-only">Loading item</span>
      <Skeleton className="aspect-[4/3] w-full rounded-panel" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-9 w-3/4 rounded-full" />
        <Skeleton className="h-7 w-24 -rotate-4 rounded-[8px]" />
        <div className="grid grid-cols-2 gap-4 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-4 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ItemDetail({ item }: { item: Item }) {
  const { user, isLoggedIn, isAdmin } = useAuth()
  const loginHref = useLoginHref()
  const [claimOpen, setClaimOpen] = useState(false)
  const timelineQ = useItemTimeline(item.id)
  const matchesQ = useItemMatches(item.id)
  const aiQ = useItemAiReviews(item.id)
  const rerunAi = useRerunAiReview(item.id)
  const myClaimsQ = useMyClaims()

  const lost = item.type === 'LOST'
  const isOwner = !!user && item.reporter.id === user.id
  const canSeeClaims = !lost && (isOwner || isAdmin)
  const myClaim = myClaimsQ.data?.find((c) => c.item.id === item.id && c.status !== 'REJECTED')
  const claimable = !lost && !isOwner && CLAIMABLE.has(item.status) && !myClaim

  const facts: { label: string; value: string }[] = [
    { label: 'Category', value: item.category },
    { label: 'Colour', value: item.color || 'Not given' },
    { label: 'Brand', value: item.brand || 'Not given' },
    { label: 'Place', value: `${item.location.name}, ${item.location.zone}` },
    { label: lost ? 'Lost on' : 'Found on', value: formatDateLong(item.event_date) },
    { label: 'Reported by', value: isOwner ? `${item.reporter.display_name} (you)` : item.reporter.display_name },
  ]

  const claimButton = isLoggedIn ? (
    <Button size="lg" className="w-full sm:w-auto" onClick={() => setClaimOpen(true)}>
      Claim this item
    </Button>
  ) : (
    <Button asChild size="lg" className="w-full sm:w-auto">
      <Link to={loginHref}>
        <LogIn aria-hidden="true" />
        Log in to claim this item
      </Link>
    </Button>
  )

  return (
    <>
      <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <PhotoViewer item={item} />

        <div className="flex min-w-0 flex-col">
          <p className={cn('flex items-center gap-2 text-sm font-semibold', lost ? 'text-lost-text' : 'text-found-text')}>
            <CategoryIcon category={item.category} className="size-[18px]" />
            {ITEM_TYPE_LABEL[item.type]} item
          </p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{item.title}</h1>
            <StatusStamp status={item.status} size="lg" className="mt-1" />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-panel border border-line bg-surface shadow-card p-5">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-xs text-ink-soft">{f.label}</dt>
                <dd className="mt-0.5 text-sm font-semibold break-words text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>

          {item.description && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-ink">Description</h2>
              <p className="mt-1.5 max-w-[70ch] whitespace-pre-line text-ink-soft">{item.description}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {myClaim && (
              <div className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface shadow-card p-4">
                <ClaimStamp status={myClaim.status} size="sm" />
                <p className="flex-1 text-sm text-ink">You claimed this item.</p>
                <Button asChild variant="secondary" size="sm" className="h-11 sm:h-9">
                  <Link to="/me?tab=claims">See my claim</Link>
                </Button>
              </div>
            )}
            {claimable && <div className="hidden md:block">{claimButton}</div>}
            {isOwner && <OwnerActions item={item} />}
            {lost && !isOwner && (
              <p className="rounded-panel border border-line bg-surface shadow-card p-4 text-sm text-ink-soft">
                Seen this item? If you have it,{' '}
                <Link to="/report/found" className="font-semibold text-cobalt underline-offset-4 hover:underline">
                  report it as found
                </Link>{' '}
                and FindiT will match it to this report.
              </p>
            )}
          </div>
        </div>
      </div>

      {canSeeClaims && <ClaimsSection itemId={item.id} />}

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="history-title">
          <h2 id="history-title" className="mb-5 font-display text-xl font-bold text-ink">
            History
          </h2>
          <div className="rounded-panel border border-line bg-surface shadow-card p-5">
            <Timeline
              entries={timelineQ.data}
              isPending={timelineQ.isPending}
              error={timelineQ.error}
              onRetry={() => void timelineQ.refetch()}
            />
          </div>
        </section>

        <section aria-labelledby="matches-title">
          <h2 id="matches-title" className="mb-5 font-display text-xl font-bold text-ink">
            Possible matches
          </h2>
          {matchesQ.isError ? (
            <ErrorState compact title="Matches didn't load" error={matchesQ.error} onRetry={() => void matchesQ.refetch()} />
          ) : matchesQ.isPending ? (
            <SkeletonList count={2} className="space-y-4" label="Loading matches" />
          ) : matchesQ.data.length === 0 ? (
            <EmptyState icon={Sparkles} title="No matches yet">
              {isOwner
                ? "We'll notify you the moment something similar is reported."
                : `When a similar ${lost ? 'found' : 'lost'} item is reported it will show up here.`}
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-5">
              {matchesQ.data.map((m) => (
                <li key={m.id}>
                  <MatchCard
                    match={m}
                    ai={aiQ.byMatch.get(m.id)}
                    onRetryAi={isOwner || isAdmin ? () => rerunAi.mutate(m.id) : undefined}
                    retryingAi={rerunAi.isPending && rerunAi.variables === m.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {claimable && (
        <>
          <div className="h-20 md:hidden" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-line bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] px-4 py-3 backdrop-blur-md md:hidden">
            {claimButton}
          </div>
          {isLoggedIn && <ClaimSheet item={item} open={claimOpen} onOpenChange={setClaimOpen} />}
        </>
      )}
    </>
  )
}

function OwnerActions({ item }: { item: Item }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const update = useUpdateItem(item.id)
  const canClose = item.status === 'OPEN' || item.status === 'MATCHED'

  if (!canClose) {
    return <p className="text-sm text-ink-soft">This is your report. It can't be closed in its current state.</p>
  }

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface shadow-card p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm text-ink-soft">
        This is your report. Close it if you no longer need it, for example if you got it back another way.
      </p>
      <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
        <Archive aria-hidden="true" />
        Mark as closed
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this report as closed?</DialogTitle>
            <DialogDescription>
              It stops appearing in matches and search filters for open items. You can't reopen it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Keep it open</Button>
            </DialogClose>
            <Button
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { status: 'CLOSED' },
                  {
                    onSuccess: () => {
                      toast.success('Marked as closed')
                      setConfirmOpen(false)
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            >
              Mark as closed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClaimsSection({ itemId }: { itemId: number }) {
  const claimsQ = useItemClaims(itemId, true)
  return (
    <section aria-labelledby="claims-title" className="mt-12">
      <h2 id="claims-title" className="mb-5 font-display text-xl font-bold text-ink">
        Claims on this item
      </h2>
      {claimsQ.isError ? (
        <ErrorState compact title="Claims didn't load" error={claimsQ.error} onRetry={() => void claimsQ.refetch()} />
      ) : claimsQ.isPending ? (
        <div className="space-y-3" role="status">
          <span className="sr-only">Loading claims</span>
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : claimsQ.data.length === 0 ? (
        <EmptyState icon={Inbox} title="No claims yet">
          When someone says this is theirs, their claim shows up here for you to review.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {claimsQ.data.map((c) => (
            <ClaimReviewRow key={c.id} claim={c} />
          ))}
        </ul>
      )}
    </section>
  )
}
