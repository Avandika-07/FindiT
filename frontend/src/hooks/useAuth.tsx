import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, getToken, setToken } from '@/lib/api'
import type { Me } from '@/lib/types'

interface AuthContextValue {
  token: string | null
  user: Me | null
  isLoggedIn: boolean
  isAdmin: boolean
  /** True while we hold a token but have not yet loaded the user. */
  isLoading: boolean
  login: (rollNo: string, password: string) => Promise<Me>
  logout: () => Promise<void>
  /** Clear local session without calling the server (used after a 401). */
  clearSession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const ME_KEY = ['auth', 'me'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setTokenState] = useState<string | null>(getToken)

  const meQuery = useQuery({
    queryKey: [...ME_KEY, token],
    queryFn: async () => {
      try {
        return await api.me()
      } catch (err) {
        // The saved token expired or belongs to another database: sign out quietly so
        // public pages keep working. Pages that need login redirect through their guard.
        if (err instanceof ApiError && err.status === 401) {
          setToken(null)
          setTokenState(null)
        }
        throw err
      }
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const clearSession = useCallback(() => {
    setToken(null)
    setTokenState(null)
    queryClient.removeQueries({ queryKey: ['me'] })
    queryClient.removeQueries({ queryKey: ['notifications'] })
    queryClient.removeQueries({ queryKey: ['admin'] })
  }, [queryClient])

  const login = useCallback(
    async (rollNo: string, password: string) => {
      const res = await api.login(rollNo, password)
      setToken(res.token)
      queryClient.setQueryData([...ME_KEY, res.token], res.user)
      setTokenState(res.token)
      return res.user
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* the token is dropped locally either way */
    }
    clearSession()
  }, [clearSession])

  const user = token ? (meQuery.data ?? null) : null
  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoggedIn: !!token,
      isAdmin: user?.role === 'ADMIN',
      isLoading: !!token && meQuery.isPending,
      login,
      logout,
      clearSession,
    }),
    [token, user, meQuery.isPending, login, logout, clearSession],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
