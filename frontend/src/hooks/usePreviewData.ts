import type { ReportValues } from '@/components/report/schema'
import type { TagData } from '@/components/tag/ItemTag'
import { todayIso } from '@/lib/format'
import type { Category, ItemType } from '@/lib/types'
import { useMeta } from './useMeta'

/** Build tag data from the report wizard's values for the live preview and review step. */
export function usePreviewData(type: ItemType, values: ReportValues, photoUrl: string | null): TagData {
  const { locations } = useMeta()
  const location = locations.find((l) => l.id === values.location_id)
  return {
    type,
    title: values.title || (type === 'LOST' ? 'What did you lose?' : 'What did you find?'),
    description: values.description,
    category: (values.category || 'Other') as Category,
    color: values.color || null,
    brand: values.brand || null,
    event_date: values.event_date || todayIso(),
    status: 'OPEN',
    photo_url: photoUrl,
    photo_blurred: false,
    location: location ? { name: location.name } : null,
  }
}
