import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../context/ToastContext'
import { VaultManager } from './VaultManager'

vi.mock('../../lib/api', () => ({
  api: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ accessToken: 'test-access-token' }),
}))

import { api } from '../../lib/api'

describe('VaultManager', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset()
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/vault/items') return { items: [] }
      if (path === '/vault/security-report') {
        return {
          generated_at: new Date().toISOString(),
          password_rotation_max_age_days: 180,
          health_score: 100,
          totals: { credentials: 0, weak: 0, unanalyzed: 0, breached_flags: 0, stale_passwords: 0, reuse_clusters: 0 },
          reuse_clusters: [],
          items: [],
        }
      }
      return {}
    })
  })

  it('renders the vault dashboard shell', async () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <ToastProvider>
          <VaultManager />
        </ToastProvider>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith('/vault/items', expect.anything())
    })
    expect(screen.getByRole('heading', { name: /Credential dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add credential/i })).toBeInTheDocument()
  })
})
