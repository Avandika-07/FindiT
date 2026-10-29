import { motion, useReducedMotion } from 'framer-motion'
import { BellRing } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState } from '@/components/common/States'
import { MatchCard } from '@/components/item/MatchCard'
import { Container } from '@/components/layout/PageHeader'
import { ItemTag } from '@/components/tag/ItemTag'
import { SkeletonList, TagSkeleton } from '@/components/tag/TagSkeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useItem, useItemAiReviews, useItemMatches, useRerunAiReview } from '@/hooks/useItems'

const STAGGER = 0.22

export default function ReportDonePage() {
  const params = useParams()
  const itemId = Number(params.id)
  const itemQ = useItem(itemId)
  const matchesQ = useItemMatches(itemId)
  const aiQ = useItemAiReviews(itemId)
  const rerunAi = useRerunAiReview(itemId)
  const reduce = useReducedMotion()
  useDocumentTitle('Your matches')

  const matches = [...(matchesQ.data ?? [])].sort((a, b) => b.score - a.score)
  const count = matches.length
  const lost = itemQ.data?.type === 'LOST'

  return (
    <Container className="max-w-[880px]">
      <section aria-labelledby="reveal-title" aria-busy={matchesQ.isPending}>
        {matchesQ.isPending ? (
          <div className="night-panel mb-8 space-y-3 rounded-[28px] p-6 sm:p-8" role="status">
            <span className="sr-only">Looking for matches</span>
            <Skeleton className="h-10 w-3/4 rounded-full bg-white/15" />
            <Skeleton className="h-5 w-1/2 rounded-full bg-white/10" />
          </div>
        ) : matchesQ.isError ? null : (
          <header className="night-panel mb-8 rounded-[28px] p-6 shadow-[0_24px_50px_-24px_rgb(18_26_63/0.7)] sm:p-8">
            <h1 id="reveal-title" className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl" aria-live="polite">
              {count === 0
                ? 'No matches yet'
                : `We found ${count} possible ${count === 1 ? 'match' : 'matches'}`}
            </h1>
            <p className="mt-2 max-w-[60ch] text-lg text-night-soft">
              {count === 0
                ? "We'll notify you the moment something similar is reported."
                : lost
                  ? 'Strongest first. Open one to see why it matched, then claim it if it is yours.'
                  : 'Strongest first. These owners have been told about your report.'}
            </p>
          </header>
        )}

        <div className="mb-10">
          <p className="mb-3 text-sm font-semibold text-ink">Your report</p>
          {itemQ.isPending ? (
            <TagSkeleton />
          ) : itemQ.isError ? (
            <ErrorState compact title="Your report didn't load" error={itemQ.error} onRetry={() => void itemQ.refetch()} />
          ) : (
            <ItemTag item={itemQ.data} showColour thunk />
          )}
        </div>

        {matchesQ.isError ? (
          <ErrorState title="Matches didn't load" error={matchesQ.error} onRetry={() => void matchesQ.refetch()} />
        ) : matchesQ.isPending ? (
          <SkeletonList count={3} className="space-y-5" label="Looking for matches" />
        ) : count === 0 ? (
          <div className="flex flex-col items-center rounded-panel border border-dashed border-line-strong px-6 py-10 text-center">
            <span className="mb-4 grid size-14 place-items-center rounded-full bg-violet-tint text-violet-text">
              <BellRing className="size-6" aria-hidden="true" />
            </span>
            <p className="max-w-md text-ink-soft">
              Every new {lost ? 'found' : 'lost'} report is checked against yours automatically. You'll get a
              notification with the match score and the reasons.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to={`/items/${itemId}`}>See your report</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/">Back to home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ol className="flex flex-col gap-6">
              {matches.map((m, i) => (
                <motion.li
                  key={m.id}
                  initial={reduce ? false : { opacity: 0, y: -48, rotate: i % 2 ? 2.5 : -2.5 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: 0.15 + i * STAGGER, type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <div className="relative isolate">
                    {i === 0 && <span className="sun-glow" aria-hidden="true" />}
                    <MatchCard
                      match={m}
                      dialDelay={reduce ? 0 : 0.3 + i * STAGGER}
                      defaultOpen={i === 0}
                      ai={aiQ.byMatch.get(m.id)}
                      onRetryAi={() => rerunAi.mutate(m.id)}
                      retryingAi={rerunAi.isPending && rerunAi.variables === m.id}
                    />
                  </div>
                </motion.li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={`/items/${itemId}`}>See your report</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/me">Go to My stuff</Link>
              </Button>
            </div>
          </>
        )}
      </section>
    </Container>
  )
}
