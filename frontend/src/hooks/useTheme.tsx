import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMediaQuery } from './useMediaQuery'

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'findit:theme'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (pref: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolved: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0B1026' : '#F5F7FF')
  }, [resolved])

  const setPreference = useCallback((pref: ThemePreference) => {
    setPref(pref)
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

/** Read resolved CSS colour tokens (for Recharts, which needs concrete colours). */
export function useThemeTokens<T extends string>(names: readonly T[]): Record<T, string> {
  const { resolved } = useTheme()
  const key = names.join(',')
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement)
    const out = {} as Record<T, string>
    for (const n of key.split(',') as T[]) out[n] = style.getPropertyValue(`--${n}`).trim() || '#888'
    return out
    // resolved is a dependency on purpose: tokens change with the theme class
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, resolved])
}
