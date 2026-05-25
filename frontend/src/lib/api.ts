/**
 * Axios API client: JWT on requests, one-shot refresh on 401, safe errors.
 * Paths are relative to ``VITE_API_PREFIX`` (default ``/api/v1``).
 *
 * **XSS**: Responses are JSON only; the React app renders user/server strings as
 * text nodes by default (avoid ``dangerouslySetInnerHTML`` for untrusted HTML).
 */
import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import { getHttpAuth } from './http-auth-bridge'

const API_ORIGIN = import.meta.env.VITE_API_URL ?? ''
const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? '/api/v1'

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path
  }
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_ORIGIN}${API_PREFIX}${p}`
}

export class ApiError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function toApiError(err: AxiosError): ApiError {
  const status = err.response?.status ?? 0
  const data = err.response?.data
  const msg =
    typeof data === 'object' && data !== null && 'msg' in data && typeof (data as { msg: unknown }).msg === 'string'
      ? (data as { msg: string }).msg
      : err.message || 'Request failed'
  return new ApiError(msg, status, data)
}

const client = axios.create({
  timeout: 60_000,
  headers: { Accept: 'application/json' },
})

client.interceptors.request.use((config) => {
  const b = getHttpAuth()
  const token = b?.getAccessToken()
  if (!token) return config
  const headers = AxiosHeaders.from(config.headers ?? {})
  if (!headers.get('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  config.headers = headers
  return config
})

client.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status

    if (!original || status !== 401 || original._retry) {
      return Promise.reject(error.response ? toApiError(error) : error)
    }

    const url = String(original.url ?? '')
    if (url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/two_factor/verify')) {
      return Promise.reject(toApiError(error))
    }

    const b = getHttpAuth()
    const refresh = b?.getRefreshToken()
    if (!refresh || !b) {
      b?.clearSession()
      return Promise.reject(toApiError(error))
    }

    original._retry = true
    try {
      const refreshRes = await axios.post<{ access_token: string }>(
        resolveApiUrl('/auth/refresh'),
        {},
        {
          headers: { Authorization: `Bearer ${refresh}` },
          timeout: 30_000,
        },
      )
      if (refreshRes.status !== 200 || !refreshRes.data?.access_token) {
        b.clearSession()
        return Promise.reject(toApiError(error))
      }
      b.patchAccessToken(refreshRes.data.access_token)
      const hdr = AxiosHeaders.from(original.headers ?? {})
      hdr.set('Authorization', `Bearer ${refreshRes.data.access_token}`)
      original.headers = hdr
      return client.request(original)
    } catch {
      b.clearSession()
      return Promise.reject(toApiError(error))
    }
  },
)

export type ApiInit = Omit<AxiosRequestConfig, 'url'> & {
  /** When set, sent as JSON body (``Content-Type: application/json``). */
  json?: unknown
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers: initHeaders, data: initData, ...rest } = init
  const method = (rest.method ?? 'GET').toString().toUpperCase()
  const headers = new AxiosHeaders(initHeaders as Record<string, string> | undefined)
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  try {
    const res = (await client.request({
      ...rest,
      method,
      url: resolveApiUrl(path),
      data: json !== undefined ? json : initData,
      headers,
    })) as AxiosResponse<unknown>
    return (res.data ?? {}) as T
  } catch (e) {
    if (axios.isAxiosError(e)) {
      throw toApiError(e)
    }
    throw e
  }
}

/** Server-side logout; ignores network errors. */
export async function postLogout(accessToken: string, refreshToken: string | null): Promise<void> {
  try {
    await axios.post(
      resolveApiUrl('/auth/logout'),
      refreshToken ? { refresh_token: refreshToken } : {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    )
  } catch {
    /* ignore */
  }
}
