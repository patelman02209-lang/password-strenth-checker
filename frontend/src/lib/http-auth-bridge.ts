/**
 * Bridges React auth state to the Axios layer without circular imports.
 * Registered once from ``AuthProvider``.
 */
export type HttpAuthBridge = {
  getAccessToken: () => string | null
  getRefreshToken: () => string | null
  patchAccessToken: (access: string) => void
  clearSession: () => void
}

let bridge: HttpAuthBridge | null = null

export function registerHttpAuth(next: HttpAuthBridge | null) {
  bridge = next
}

export function getHttpAuth(): HttpAuthBridge | null {
  return bridge
}
