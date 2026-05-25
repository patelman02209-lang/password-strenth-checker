/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'psc_theme'

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => (typeof document !== 'undefined' ? readStored() : 'dark'))

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
