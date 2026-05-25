import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../../context/AuthContext'
import { ToastProvider } from '../../context/ToastContext'
import LoginPage from './LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/auth/login']}>
      <AuthProvider>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('renders sign-in form', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /Sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Username or email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
  })
})
