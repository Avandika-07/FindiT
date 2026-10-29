import type { ItemFilters } from './types'

export function countActiveFilters(f: ItemFilters): number {
  return [f.type, f.category, f.status, f.location_id, f.date_from || f.date_to].filter(Boolean).length
}
