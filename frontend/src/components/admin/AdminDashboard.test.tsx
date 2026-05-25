import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminDashboard } from './AdminDashboard'

vi.mock('../../lib/api', () => ({
  api: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ accessToken: 'admin-token' }),
}))

import { api } from '../../lib/api'

const analyticsPayload = {
  window_hours: 24,
  users: { total: 2, active: 2 },
  last_24h: { password_checks: 3, audit_events: 1 },
  password_checks_all_time: {
    total: 10,
    with_breach_flag: 1,
    by_strength_label: { weak: 4, moderate: 3, strong: 3 },
    weak_password_pct: 40,
    avg_entropy: 28.5,
  },
  top_detected_patterns: [{ pattern: 'keyboard_pattern', count: 2 }],
  checks_per_day: [{ date: '2026-01-01', checks: 2, breaches: 0 }],
  users_by_check_volume: [{ user_id: 1, name: 'u', email: 'u@e.com', password_checks: 5 }],
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset()
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/admin/analytics') return analyticsPayload
      if (path === '/admin/users') return { users: [{ id: 1, name: 'u', email: 'u@e.com', role: 'USER' }] }
      throw new Error(`unexpected api path ${path}`)
    })
  })

  it('renders admin analytics after data loads', async () => {
    render(
      <div style={{ width: 960, height: 1400 }}>
        <AdminDashboard />
      </div>,
    )
    await waitFor(() => {
      expect(screen.getByText(/Admin analytics/i)).toBeInTheDocument()
    })
    expect(await screen.findByText('Total users')).toBeInTheDocument()
    expect(await screen.findByText('40%')).toBeInTheDocument()
  })
})
