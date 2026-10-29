import { useQuery } from '@tanstack/react-query'
import { KeyRound, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { HandoverForm } from '@/components/claim/HandoverForm'
import { EmptyState, ErrorState } from '@/components/common/States'
import { CategoryIcon } from '@/components/tag/CategoryIcon'
import { ClaimStamp } from '@/components/tag/StatusStamp'
import { RowSkeleton } from '@/components/tag/TagSkeleton'
import { api } from '@/lib/api'
import type { Claim } from '@/lib/types'
import { cn } from '@/lib/utils'

export function HandoverDesk() {
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['admin', 'verified'], queryFn: api.adminVerified })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [justDone, setJustDone] = useState<Claim | null>(null)

  if (isError) return <ErrorState title="Approved claims didn't load" error={error} onRetry={() => void refetch()} />
  if (isPending) {
    return (
      <div className="space-y-3" role="status">
        <span className="sr-only">Loading approved claims</span>
        <RowSkeleton />
        <RowSkeleton />
      </div>
    )
  }

  const selected = data.find((e) => e.claim.id === selectedId) ?? (data.length === 1 ? data[0] : undefined)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="ready-title">
        <h3 id="ready-title" className="mb-3 font-semibold text-ink">
          Ready for pickup
        </h3>
        {justDone && (
          <div className="mb-3 flex items-center gap-3 rounded-panel border border-line bg-surface shadow-card p-4" role="status">
            <ClaimStamp status="HANDED_OVER" thunk />
            <p className="text-sm text-ink">{justDone.item.title} is back with {justDone.claimant.display_name}.</p>
          </div>
        )}
        {data.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Nothing waiting for pickup">
            Approved claims show up here until the owner collects the item with their code.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Approved claims">
            {data.map(({ claim }) => {
              const active = selected?.claim.id === claim.id
              return (
                <li key={claim.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(claim.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-panel border bg-surface p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt',
                      active ? 'border-cobalt ring-1 ring-cobalt' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-control bg-found-tint text-found-text">
                      <CategoryIcon category={claim.item.category} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{claim.item.title}</span>
                      <span className="block truncate text-sm text-ink-soft">
                        For {claim.claimant.display_name}, pickup at {claim.item.location.name}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="code-title" className="rounded-panel border border-line bg-surface shadow-card p-5 sm:p-8">
        {selected ? (
          <>
            <h3 id="code-title" className="text-center font-display text-xl font-bold text-ink">
              Enter {selected.claim.claimant.display_name}'s code
            </h3>
            <p className="mt-1 mb-6 text-center text-sm text-ink-soft">
              For {selected.claim.item.title}. Paste works too.
            </p>
            <HandoverForm
              key={selected.claim.id}
              claimId={selected.claim.id}
              autoFocus
              onDone={(claim) => {
                setJustDone(claim)
                setSelectedId(null)
              }}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
            <KeyRound className="size-8 text-ink-soft" aria-hidden="true" />
            <h3 id="code-title" className="font-semibold text-ink">
              Choose a claim to confirm
            </h3>
            <p className="max-w-xs text-sm text-ink-soft">
              Pick the student in front of you from the list, then type the 6-digit code from their handover pass.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
