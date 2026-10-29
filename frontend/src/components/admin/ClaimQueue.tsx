import { useQuery } from '@tanstack/react-query'
import { Flag, Inbox } from 'lucide-react'
import { DecisionForm } from '@/components/claim/DecisionForm'
import { AIDetails } from '@/components/item/AIRecommendation'
import { EmptyState, ErrorState } from '@/components/common/States'
import { ItemTag } from '@/components/tag/ItemTag'
import { RowSkeleton } from '@/components/tag/TagSkeleton'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { formatRelative, mediaUrl, plural } from '@/lib/format'
import type { QueueEntry } from '@/lib/types'
import { EvidenceMeter, GuidanceChip } from './EvidenceMeter'

export function ClaimQueue() {
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['admin', 'queue'], queryFn: api.adminQueue })
  if (isError) return <ErrorState title="The claim queue didn't load" error={error} onRetry={() => void refetch()} />
  if (isPending) {
    return (
      <div className="space-y-4" role="status">
        <span className="sr-only">Loading claims</span>
        <RowSkeleton className="h-48" />
        <RowSkeleton className="h-48" />
      </div>
    )
  }
  if (!data.length) {
    return (
      <EmptyState icon={Inbox} title="The queue is clear">
        No claims are waiting. New claims appear here oldest first.
      </EmptyState>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-soft" aria-live="polite">
        {plural(data.length, 'claim')} waiting, oldest first
      </p>
      <ul className="flex flex-col gap-6">
        {data.map((entry) => (
          <QueueCard key={entry.claim.id} entry={entry} />
        ))}
      </ul>
    </div>
  )
}

function QueueCard({ entry }: { entry: QueueEntry }) {
  const { claim, claimant } = entry
  const photo = mediaUrl(claim.proof_photo_url)

  return (
    <li className="rounded-panel border border-line bg-surface shadow-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GuidanceChip guidance={entry.guidance} />
        <p className="text-sm text-ink-soft">Claimed {formatRelative(claim.created_at).toLowerCase()}</p>
      </div>
      {entry.guidance_reasons.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-soft">
          {entry.guidance_reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink">The item</h3>
          <ItemTag item={claim.item} />
          {entry.secret_question && (
            <div className="rounded-control bg-wash p-3">
              <p className="text-xs text-ink-soft">Secret question</p>
              <p className="text-sm font-semibold text-ink">{entry.secret_question}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink">The claimant</h3>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{claimant.full_name || claimant.display_name}</p>
            <span className="text-sm text-ink-soft">{claimant.roll_no}</span>
            {claimant.is_flagged && (
              <Badge tone="danger">
                <Flag className="size-3" aria-hidden="true" />
                Flagged
              </Badge>
            )}
            <Badge tone="neutral">{claimant.karma} karma</Badge>
          </div>
          <blockquote className="border-l-2 border-line-strong pl-3 text-sm whitespace-pre-line text-ink">
            {claim.proof_text}
          </blockquote>
          {photo && (
            <a
              href={photo}
              target="_blank"
              rel="noreferrer"
              className="inline-block self-start overflow-hidden rounded-control border border-line focus-visible:outline-2 focus-visible:outline-cobalt"
            >
              <img src={photo} alt={`Proof photo from ${claimant.display_name}`} className="h-28 w-40 object-cover" />
            </a>
          )}
          <div className="flex flex-col gap-3 rounded-control border border-line p-4">
            <EvidenceMeter label="Secret answer match" value={claim.answer_score} empty="Not scored" />
            <EvidenceMeter label="Photo similarity" value={claim.photo_similarity} empty="No proof photo" />
            <EvidenceMeter
              label="Past rejections"
              value={claimant.rejected_claims}
              max={3}
              display={String(claimant.rejected_claims)}
            />
          </div>
          {entry.ai_review && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-soft">The claimant also reported this item as lost.</p>
              <AIDetails review={entry.ai_review} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <DecisionForm claimId={claim.id} />
      </div>
    </li>
  )
}
