import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = { accessToken: null as string | null }

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    accessToken: authState.accessToken,
    refreshToken: null,
    role: null,
    isHydrated: true,
    isAuthenticated: Boolean(authState.accessToken),
    hasRole: () => false,
    setSession: vi.fn(),
    patchAccessToken: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}))

import { ProtectedRoute } from './ProtectedRoute'

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.accessToken = null
  })

  it('redirects unauthenticated users to login', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<div>Secret workspace</div>} />
          </Route>
          <Route path="/auth/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Login screen')).toBeInTheDocument()
    expect(screen.queryByText('Secret workspace')).not.toBeInTheDocument()
  })

  it('renders nested route when a JWT is present', () => {
    authState.accessToken = 'header.payload.sig'
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<div>Secret workspace</div>} />
          </Route>
          <Route path="/auth/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Secret workspace')).toBeInTheDocument()
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument()
  })
})
