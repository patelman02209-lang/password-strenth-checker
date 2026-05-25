/* eslint-disable react-refresh/only-export-components -- hook paired with provider */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { registerHttpAuth } from '../lib/http-auth-bridge'
import { postLogout } from '../lib/api'

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  role: string | null
  isHydrated: boolean
}

type AuthContextValue = AuthState & {
  isAuthenticated: boolean
  hasRole: (...roles: string[]) => boolean
  setSession: (tokens: { access_token: string; refresh_token: string } | null) => void
  patchAccessToken: (access: string) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function decodeJwtPayload(token: string): { role?: string } {
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as { role?: string }
  } catch {
    return {}
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccess] = useState<string | null>(() => localStorage.getItem('psc_access'))
  const [refreshToken, setRefresh] = useState<string | null>(() => localStorage.getItem('psc_refresh'))

  const isHydrated = true

  const role = useMemo(
    () => (accessToken ? decodeJwtPayload(accessToken).role ?? null : null),
    [accessToken],
  )

  const setSession = useCallback(
    (tokens: { access_token: string; refresh_token: string } | null) => {
      if (!tokens) {
        setAccess(null)
        setRefresh(null)
        localStorage.removeItem('psc_access')
        localStorage.removeItem('psc_refresh')
        return
      }
      setAccess(tokens.access_token)
      setRefresh(tokens.refresh_token)
      localStorage.setItem('psc_access', tokens.access_token)
      localStorage.setItem('psc_refresh', tokens.refresh_token)
    },
    [],
  )

  const patchAccessToken = useCallback((access: string) => {
    setAccess(access)
    localStorage.setItem('psc_access', access)
  }, [])

  const clearSession = useCallback(() => {
    setAccess(null)
    setRefresh(null)
    localStorage.removeItem('psc_access')
    localStorage.removeItem('psc_refresh')
  }, [])

  const logout = useCallback(async () => {
    const access = accessToken
    const refresh = refreshToken
    if (access) {
      try {
        await postLogout(access, refresh)
      } catch {
        /* still clear local session */
      }
    }
    clearSession()
  }, [accessToken, refreshToken, clearSession])

  useEffect(() => {
    registerHttpAuth({
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshToken,
      patchAccessToken,
      clearSession,
    })
    return () => registerHttpAuth(null)
  }, [accessToken, refreshToken, patchAccessToken, clearSession])

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!role) return false
      return roles.includes(role)
    },
    [role],
  )

  const isAuthenticated = Boolean(accessToken)

  const value = useMemo(
    () => ({
      accessToken,
      refreshToken,
      role,
      isHydrated,
      isAuthenticated,
      hasRole,
      setSession,
      patchAccessToken,
      logout,
    }),
    [
      accessToken,
      refreshToken,
      role,
      isHydrated,
      isAuthenticated,
      hasRole,
      setSession,
      patchAccessToken,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
