import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ItemFilters } from '@/lib/types'

export function useSearch(q: string, filters: ItemFilters) {
  const query = q.trim()
  return useQuery({
    queryKey: ['search', query, filters],
    queryFn: ({ signal }) => api.search({ q: query, ...filters, limit: 50 }, signal),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  })
}

export function useDebounced<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** Suggestions for the last word being typed. */
export function useSuggestions(text: string) {
  const lastWord = text.split(/\s+/).pop()?.trim() ?? ''
  const prefix = useDebounced(lastWord.toLowerCase(), 150)
  return useQuery({
    queryKey: ['suggest', prefix],
    queryFn: ({ signal }) => api.suggest(prefix, signal),
    enabled: prefix.length >= 2,
    staleTime: 60_000,
    retry: false,
  })
}
