import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AIReview, ItemFilters, ItemUpdate } from '@/lib/types'
import { useAuth } from './useAuth'

export function useItem(id: number) {
  return useQuery({ queryKey: ['item', id], queryFn: () => api.getItem(id), enabled: Number.isFinite(id) && id > 0 })
}

export function useItemTimeline(id: number) {
  return useQuery({
    queryKey: ['item', id, 'timeline'],
    queryFn: () => api.itemTimeline(id),
    enabled: Number.isFinite(id) && id > 0,
  })
}

export function useItemMatches(id: number, enabled = true) {
  return useQuery({
    queryKey: ['item', id, 'matches'],
    queryFn: () => api.itemMatches(id),
    enabled: enabled && Number.isFinite(id) && id > 0,
  })
}

/**
 * AI second opinions for an item's matches, keyed by match id. Polls every few seconds
 * while any review is still waiting, then stops.
 */
export function useItemAiReviews(id: number, enabled = true) {
  const query = useQuery({
    queryKey: ['item', id, 'ai-reviews'],
    queryFn: () => api.itemAiReviews(id),
    enabled: enabled && Number.isFinite(id) && id > 0,
    refetchInterval: (q) =>
      q.state.data?.reviews.some((r) => r.status === 'PENDING' || r.status === 'RUNNING') ? 3000 : false,
  })
  const byMatch = new Map<number, AIReview>()
  for (const review of query.data?.reviews ?? []) byMatch.set(review.match_id, review)
  return { ...query, byMatch, aiEnabled: query.data?.enabled ?? false }
}

export function useRerunAiReview(itemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchId: number) => api.rerunAiReview(matchId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['item', itemId, 'ai-reviews'] }),
  })
}

export function useRecentItems(filters: ItemFilters, pageSize = 10) {
  return useQuery({
    queryKey: ['items', 'recent', filters, pageSize],
    queryFn: () => api.listItems({ ...filters, page: 1, page_size: pageSize }),
  })
}

export function useBrowseItems(filters: ItemFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['items', 'browse', filters],
    queryFn: ({ pageParam }) => api.listItems({ ...filters, page: pageParam, page_size: 24 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
    enabled,
  })
}

export function useMyItems() {
  const { isLoggedIn } = useAuth()
  return useQuery({ queryKey: ['me', 'items'], queryFn: api.myItems, enabled: isLoggedIn })
}

export function useUpdateItem(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ItemUpdate) => api.updateItem(id, payload),
    onSuccess: (item) => {
      qc.setQueryData(['item', id], item)
      void qc.invalidateQueries({ queryKey: ['item', id, 'timeline'] })
      void qc.invalidateQueries({ queryKey: ['me', 'items'] })
      void qc.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: api.stats, staleTime: 5 * 60_000 })
}
