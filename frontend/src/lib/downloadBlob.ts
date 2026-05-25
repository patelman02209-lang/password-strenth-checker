import axios from 'axios'
import { resolveApiUrl } from './api'
import { getHttpAuth } from './http-auth-bridge'

/** Authenticated GET returning a Blob (e.g. CSV export). Never used for password fields. */
export async function downloadAuthenticatedBlob(path: string, filename: string, accept = 'text/csv'): Promise<void> {
  const token = getHttpAuth()?.getAccessToken()
  const res = await axios.get(resolveApiUrl(path), {
    responseType: 'blob',
    timeout: 120_000,
    headers: {
      Accept: accept,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const blob = res.data as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
