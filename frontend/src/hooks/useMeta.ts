import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/lib/api'
import { FALLBACK_CATEGORIES, FALLBACK_COLORS } from '@/lib/catalog'
import { env } from '@/lib/env'
import type { LocationRef, MetaCategory, MetaColor, MetaZone } from '@/lib/types'

export function useMeta() {
  const metaQuery = useQuery({ queryKey: ['meta'], queryFn: api.meta, staleTime: Infinity })
  // Locations are a fallback for zones when meta is unavailable.
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: api.locations,
    staleTime: Infinity,
    enabled: metaQuery.isError,
  })

  return useMemo(() => {
    const meta = metaQuery.data
    const categories: MetaCategory[] = meta?.categories?.length ? meta.categories : FALLBACK_CATEGORIES
    const colors: MetaColor[] = meta?.colors?.length ? meta.colors : FALLBACK_COLORS

    let zones: MetaZone[] = meta?.zones ?? []
    if (!zones.length && locationsQuery.data) {
      const byZone = new Map<string, LocationRef[]>()
      for (const loc of locationsQuery.data) {
        const list = byZone.get(loc.zone) ?? []
        list.push({ id: loc.id, name: loc.name, zone: loc.zone })
        byZone.set(loc.zone, list)
      }
      zones = [...byZone.entries()].map(([zone, locations]) => ({ zone, locations }))
    }
    const locations = zones.flatMap((z) => z.locations)

    return {
      categories,
      colors,
      zones,
      locations,
      maxUploadMb: meta?.max_upload_mb || env.maxUploadMb,
      debug: meta?.debug ?? false,
      expiryDays: meta?.item_expiry_days ?? 30,
      isLoading: metaQuery.isPending || (metaQuery.isError && locationsQuery.isPending),
      zonesError: metaQuery.isError && locationsQuery.isError ? locationsQuery.error : null,
      refetch: () => {
        void metaQuery.refetch()
        if (metaQuery.isError) void locationsQuery.refetch()
      },
    }
  }, [metaQuery, locationsQuery])
}

export function useCategoryIcon() {
  const { categories } = useMeta()
  return useMemo(() => {
    const map = new Map(categories.map((c) => [c.name as string, c.icon]))
    return (category: string) => map.get(category) ?? null
  }, [categories])
}
