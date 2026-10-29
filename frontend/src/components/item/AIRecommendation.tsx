import { Check, LoaderCircle, RotateCcw, Sparkles, X } from 'lucide-react'
import type { AIReview } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Plain-English verdict for an AI score, following the prompt's own bands. */
function verdict(review: AIReview): { text: string; tone: string } {
  if (review.confidence === 'high') return { text: 'Very likely the same item', tone: 'text-found-text' }
  if (review.match) return { text: 'Possibly the same item', tone: 'text-ink' }
  return { text: 'Probably a different item', tone: 'text-ink-soft' }
}

/** One quiet line under a match tag: what the AI thinks, or that it is still checking. */
export function AIVerdictLine({ review, className }: { review: AIReview | undefined; className?: string }) {
  if (!review) return null
  const waiting = review.status === 'PENDING' || review.status === 'RUNNING'
  return (
    <p className={cn('flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-sm', className)} aria-live="polite">
      {waiting ? (
        <>
          <LoaderCircle className="size-4 shrink-0 text-cobalt motion-safe:animate-spin" aria-hidden="true" />
          <span className="text-ink-soft">AI is checking this match</span>
        </>
      ) : review.status === 'DONE' && review.score !== null ? (
        <>
          <Sparkles className="size-4 shrink-0 text-cobalt" aria-hidden="true" />
          <span className="text-ink-soft">AI says</span>
          <span className={cn('font-semibold', verdict(review).tone)}>{verdict(review).text}</span>
          <span className="text-ink-soft tabular-nums">({review.score} of 100)</span>
        </>
      ) : (
        <>
          <Sparkles className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <span className="text-ink-soft">AI check didn't run</span>
        </>
      )}
    </p>
  )
}

/** The AI's reasoning: what matches, what conflicts, and a retry when it failed. */
export function AIDetails({
  review,
  onRetry,
  retrying = false,
}: {
  review: AIReview | undefined
  onRetry?: () => void
  retrying?: boolean
}) {
  if (!review) return null
  const waiting = review.status === 'PENDING' || review.status === 'RUNNING'

  return (
    <section className="flex flex-col gap-3 rounded-control bg-wash p-4" aria-label="AI recommendation">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Sparkles className="size-4 text-cobalt" aria-hidden="true" />
        AI recommendation
      </h4>

      {waiting && <p className="text-sm text-ink-soft">The AI is reading both reports. This usually takes a few seconds.</p>}

      {review.status === 'FAILED' && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-soft">
            The AI model wasn't available, so this match has only FindiT's own score.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-cobalt hover:underline focus-visible:outline-2 focus-visible:outline-cobalt disabled:opacity-60"
            >
              <RotateCcw className={cn('size-4', retrying && 'motion-safe:animate-spin')} aria-hidden="true" />
              Ask the AI again
            </button>
          )}
        </div>
      )}

      {review.status === 'DONE' && review.score !== null && (
        <>
          <p className="text-sm text-ink">
            <span className={cn('font-semibold', verdict(review).tone)}>{verdict(review).text}</span>
            <span className="text-ink-soft">
              {' '}
              with {review.confidence} confidence, {review.score} of 100.
            </span>
          </p>
          {review.reason && <p className="text-sm text-ink">{review.reason}</p>}
          {review.matching_features.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-ink-soft">What matches</p>
              <ul className="flex flex-col gap-1">
                {review.matching_features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-found-text" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.conflicting_features.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-ink-soft">What doesn't match</p>
              <ul className="flex flex-col gap-1">
                {review.conflicting_features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-ink-soft">
            Suggested by the {review.model ?? 'local'} AI model running on this server. It can be wrong, so check
            the details yourself. The dial shows FindiT's own match score.
          </p>
        </>
      )}
    </section>
  )
}
