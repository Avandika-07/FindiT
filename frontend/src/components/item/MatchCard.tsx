import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { ItemTag } from '@/components/tag/ItemTag'
import { MatchDial } from '@/components/tag/MatchDial'
import type { AIReview, Match } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AIDetails, AIVerdictLine } from './AIRecommendation'
import { MatchBreakdown } from './MatchBreakdown'

export function MatchCard({
  match,
  dialDelay = 0,
  defaultOpen = false,
  ai,
  onRetryAi,
  retryingAi = false,
}: {
  match: Match
  dialDelay?: number
  defaultOpen?: boolean
  /** The AI's second opinion on this match, if one was requested. */
  ai?: AIReview
  onRetryAi?: () => void
  retryingAi?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col">
      <ItemTag
        item={match.item}
        aside={<MatchDial score={match.score} size={56} delay={dialDelay} />}
        className="z-10"
      />
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <div className="mx-4 rounded-b-panel border border-t-0 border-line bg-surface sm:mx-6">
          {ai && <AIVerdictLine review={ai} className="border-b border-line px-4 py-2.5" />}
          <Collapsible.Trigger className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-sm font-semibold text-ink hover:text-cobalt focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cobalt">
            Why this matched
            <ChevronDown
              className={cn('size-4 text-ink-soft transition-transform duration-200', open && 'rotate-180')}
              aria-hidden="true"
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="flex flex-col gap-5 px-4 pt-1 pb-4">
            <MatchBreakdown breakdown={match.breakdown} reasons={match.reasons} />
            <AIDetails review={ai} onRetry={onRetryAi} retrying={retryingAi} />
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    </div>
  )
}
