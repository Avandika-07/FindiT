import { useQuery } from '@tanstack/react-query'
import { Lock, Pencil, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ItemTag } from '@/components/tag/ItemTag'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { eventPhrase } from '@/lib/format'
import type { ItemType } from '@/lib/types'
import { toPayload, type ReportValues, type StepId } from './schema'
import { usePreviewData } from '@/hooks/usePreviewData'

export function StepReview({
  type,
  values,
  photo,
  onEdit,
}: {
  type: ItemType
  values: ReportValues
  photo: File | null
  onEdit: (step: StepId) => void
}) {
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  const data = usePreviewData(type, values, photoUrl)
  const payload = useMemo(() => toPayload(type, values), [type, values])

  const dupes = useQuery({
    queryKey: ['duplicates', payload],
    queryFn: () => api.checkDuplicates(payload),
    staleTime: 60_000,
    retry: false,
  })
  const duplicates = dupes.data?.duplicates ?? []

  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-soft">This is your tag exactly as other students will see it.</p>

      {duplicates.length > 0 && (
        <div role="alert" className="rounded-panel border border-[color-mix(in_srgb,var(--signal)_55%,var(--line))] bg-[color-mix(in_srgb,var(--signal)_10%,var(--surface))] p-4">
          <p className="flex items-start gap-2 font-semibold text-ink">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-signal-text" aria-hidden="true" />
            You already reported something very similar
          </p>
          <p className="mt-1 pl-7 text-sm text-ink-soft">
            Check it isn't the same item before reporting again. A second report won't get you matched faster.
          </p>
          <ul className="mt-3 flex flex-col gap-1 pl-7">
            {duplicates.slice(0, 3).map((d) => (
              <li key={d.item.id}>
                <Link
                  to={`/items/${d.item.id}`}
                  target="_blank"
                  className="text-sm font-semibold text-cobalt underline-offset-4 hover:underline"
                >
                  {d.item.title}
                </Link>
                <span className="text-sm text-ink-soft"> ({Math.round(d.score)}% similar)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ItemTag item={data} static showDescription showColour />

      <dl className="grid gap-4 rounded-panel border border-line bg-surface shadow-card p-5 sm:grid-cols-2">
        <ReviewFact label="Brand" value={values.brand || 'Not given'} onEdit={() => onEdit('what')} />
        <ReviewFact label="Colour" value={values.color || 'Not sure'} onEdit={() => onEdit('what')} />
        <ReviewFact label="Photo" value={photo ? photo.name : 'No photo'} onEdit={() => onEdit('photo')} />
        <ReviewFact
          label="Place and date"
          value={`${data.location?.name ?? 'Place not chosen'}, ${eventPhrase(data.event_date)}`}
          onEdit={() => onEdit('where')}
        />
        {type === 'FOUND' && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-soft">Secret question</dt>
            <dd className="mt-0.5 flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-ink">{values.secret_question}</span>
              <EditButton label="Edit secret question" onClick={() => onEdit('secret')} />
            </dd>
            <dd className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
              <Lock className="size-3.5" aria-hidden="true" />
              The answer stays private. We never show it.
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function ReviewFact({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 flex items-start justify-between gap-3">
        <span className="truncate text-sm font-semibold text-ink">{value}</span>
        <EditButton label={`Edit ${label.toLowerCase()}`} onClick={onEdit} />
      </dd>
    </div>
  )
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="quiet" size="iconSm" onClick={onClick} aria-label={label} className="-mt-1.5 shrink-0">
      <Pencil aria-hidden="true" />
    </Button>
  )
}
