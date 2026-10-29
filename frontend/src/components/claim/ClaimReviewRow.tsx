import { KeyRound, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { ClaimStamp } from '@/components/tag/StatusStamp'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { formatRelative, mediaUrl } from '@/lib/format'
import type { Claim } from '@/lib/types'
import { DecisionForm } from './DecisionForm'
import { HandoverForm } from './HandoverForm'

/** A claim as the finder (or an admin) sees it on the item page. */
export function ClaimReviewRow({ claim }: { claim: Claim }) {
  const [reviewing, setReviewing] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const photo = mediaUrl(claim.proof_photo_url)

  return (
    <li className="rounded-panel border border-line bg-surface shadow-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{claim.claimant.display_name}</p>
          <p className="text-xs text-ink-soft">Claimed {formatRelative(claim.created_at)}</p>
        </div>
        <ClaimStamp status={claim.status} size="sm" />
      </div>

      <p className="mt-3 text-sm whitespace-pre-line text-ink">{claim.proof_text}</p>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {claim.answer_score !== null && (
          <div>
            <dt className="text-xs text-ink-soft">Secret answer match</dt>
            <dd className="text-sm font-semibold text-ink">{claim.answer_score}%</dd>
          </div>
        )}
        {claim.photo_similarity !== null && (
          <div>
            <dt className="text-xs text-ink-soft">Photo similarity</dt>
            <dd className="text-sm font-semibold text-ink">{claim.photo_similarity}%</dd>
          </div>
        )}
      </dl>

      {photo && (
        <a
          href={photo}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block overflow-hidden rounded-control border border-line focus-visible:outline-2 focus-visible:outline-cobalt"
        >
          <img src={photo} alt={`Proof photo from ${claim.claimant.display_name}`} className="h-24 w-32 object-cover" />
        </a>
      )}

      {claim.decision_note && (
        <p className="mt-3 flex items-start gap-2 rounded-control bg-wash p-3 text-sm text-ink">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <span>
            <span className="sr-only">Decision note: </span>
            {claim.decision_note}
          </span>
        </p>
      )}

      {claim.status === 'PENDING' && (
        <div className="mt-4">
          {reviewing ? (
            <DecisionForm claimId={claim.id} onDone={() => setReviewing(false)} />
          ) : (
            <Button variant="secondary" onClick={() => setReviewing(true)}>
              Review claim
            </Button>
          )}
        </div>
      )}

      {claim.status === 'VERIFIED' && (
        <div className="mt-4">
          <Button variant="success" onClick={() => setHandoverOpen(true)}>
            <KeyRound aria-hidden="true" />
            Confirm handover
          </Button>
          <ResponsiveDialog
            open={handoverOpen}
            onOpenChange={setHandoverOpen}
            title="Confirm handover"
            description={`Ask ${claim.claimant.display_name} for the 6-digit code on their handover pass.`}
          >
            <div className="py-2">
              <HandoverForm claimId={claim.id} autoFocus onDone={() => setHandoverOpen(false)} />
            </div>
          </ResponsiveDialog>
        </div>
      )}
    </li>
  )
}
