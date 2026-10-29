import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { NotificationsResponse } from '@/lib/types'
import { useAuth } from './useAuth'

const KEY = ['notifications'] as const

export function useNotifications() {
  const { isLoggedIn } = useAuth()
  return useQuery({
    queryKey: KEY,
    queryFn: api.notifications,
    enabled: isLoggedIn,
    refetchInterval: isLoggedIn ? 30_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.readNotification(id),
    onMutate: (id) => {
      qc.setQueryData<NotificationsResponse>(KEY, (old) => {
        if (!old) return old
        const target = old.items.find((n) => n.id === id)
        if (!target || target.is_read) return old
        return {
          unread: Math.max(0, old.unread - 1),
          items: old.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        }
      })
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.readAllNotifications,
    onMutate: () => {
      qc.setQueryData<NotificationsResponse>(KEY, (old) =>
        old ? { unread: 0, items: old.items.map((n) => ({ ...n, is_read: true })) } : old,
      )
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}
