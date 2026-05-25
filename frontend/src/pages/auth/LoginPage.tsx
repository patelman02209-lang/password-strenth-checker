import { LogIn } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/auth/AuthCard'
import { Button, Input, PasswordInput } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { api } from '../../lib/api'
import { validateUsername } from '../../lib/auth-validation'

type LocationState = { from?: string }

function validateIdentifier(raw: string): string | null {
  const s = raw.trim()
  if (!s) return 'Enter your username or email.'
  if (s.includes('@')) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return 'Enter a valid email address.'
    return null
  }
  return validateUsername(s)
}

export default function LoginPage() {
  const nav = useNavigate()
  const location = useLocation()
  const { setSession, accessToken } = useAuth()
  const { pushToast } = useToast()
  const from = (location.state as LocationState | null)?.from

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    const target = from && from.startsWith('/') && from !== '/auth/login' ? from : '/app'
    nav(target, { replace: true })
  }, [accessToken, from, nav])

  if (accessToken) {
    return null
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const idErr = validateIdentifier(identifier)
    const pwEmpty = !password.trim()
    const next: typeof fieldErrors = {}
    if (idErr) next.identifier = idErr
    if (pwEmpty) next.password = 'Password is required.'
    if (Object.keys(next).length) {
      setFieldErrors(next)
      return
    }
    setFieldErrors({})

    setLoading(true)
    try {
      const data = await api<
        | { two_factor_required: true; pending_token: string }
        | { access_token: string; refresh_token: string }
      >('/auth/login', { method: 'POST', json: { username: identifier.trim(), password } })
      if ('two_factor_required' in data && data.two_factor_required) {
        pushToast({
          variant: 'info',
          title: 'Two-factor required',
          message: 'Open Google Authenticator and enter your current code.',
        })
        nav('/auth/verify', {
          replace: true,
          state: {
            pendingToken: data.pending_token,
            from: from && from.startsWith('/') ? from : '/app',
          },
        })
        return
      }
      if ('access_token' in data) {
        setSession(data)
        pushToast({ variant: 'success', title: 'Welcome', message: 'Secure channel active.' })
        const target = from && from.startsWith('/') && from !== '/auth/login' ? from : '/app'
        nav(target, { replace: true })
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      pushToast({ variant: 'error', title: 'Sign-in failed', message: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthCard accent="emerald">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/90">Secure access</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-400">Password Strength Checker &amp; Manager</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Input
            label="Username or email"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value)
              if (fieldErrors.identifier) setFieldErrors((f) => ({ ...f, identifier: undefined }))
            }}
            autoComplete="username"
            error={fieldErrors.identifier}
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }))
            }}
            autoComplete="current-password"
            error={fieldErrors.password}
            required
          />
          {error ? (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
            leftIcon={<LogIn className="h-4 w-4" aria-hidden />}
          >
            {loading ? 'Signing in…' : 'Continue'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          New here?{' '}
          <Link className="text-emerald-400 hover:text-emerald-300" to="/auth/register">
            Create an account
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-zinc-600">
          <Link className="hover:text-zinc-400" to="/auth/2fa-setup">
            Set up two-factor authentication
          </Link>{' '}
          <span className="text-zinc-600">(after sign-in)</span>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
