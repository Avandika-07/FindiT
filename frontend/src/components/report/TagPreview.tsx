import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { ItemTag } from '@/components/tag/ItemTag'
import { usePreviewData } from '@/hooks/usePreviewData'
import type { ItemType } from '@/lib/types'
import type { ReportValues } from './schema'

/** Live tag preview that follows the wizard form. */
export function TagPreview({ type, photo }: { type: ItemType; photo: File | null }) {
  const values = useWatch<ReportValues>() as ReportValues
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  const data = usePreviewData(type, values, photoUrl)
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink">Preview</p>
      <ItemTag item={data} static showDescription showColour />
      <p className="mt-3 text-xs text-ink-soft">This is how your tag will look to other students.</p>
    </div>
  )
}
