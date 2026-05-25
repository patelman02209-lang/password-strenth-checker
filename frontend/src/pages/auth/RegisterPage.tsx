import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/auth/AuthCard'
import { Button, Input, PasswordInput } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { api } from '../../lib/api'
import { validateEmail, validatePasswordPolicy, validateUsername } from '../../lib/auth-validation'

export default function RegisterPage() {
  const nav = useNavigate()
  const { pushToast } = useToast()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const uErr = validateUsername(username)
    const eErr = validateEmail(email)
    const pErr = validatePasswordPolicy(password)
    const next = { username: uErr ?? undefined, email: eErr ?? undefined, password: pErr ?? undefined }
    if (uErr || eErr || pErr) {
      setFieldErrors(next)
      return
    }
    setFieldErrors({})

    setLoading(true)
    try {
      await api('/auth/register', {
        method: 'POST',
        json: { username, email, password },
      })
      pushToast({ variant: 'success', title: 'Account created', message: 'You can sign in now.' })
      nav('/auth/login', { replace: true })
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      pushToast({ variant: 'error', title: 'Registration failed', message: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthCard accent="sky">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-400/90">Onboarding</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Create account</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Password policy matches the API: at least 10 characters, no leading or trailing spaces.
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Input
            label="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: undefined }))
            }}
            autoComplete="username"
            error={fieldErrors.username}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }))
            }}
            autoComplete="email"
            error={fieldErrors.email}
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }))
            }}
            minLength={10}
            autoComplete="new-password"
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
            className="w-full bg-sky-500 text-sky-950 hover:bg-sky-400 focus-visible:ring-sky-400/60"
            size="lg"
            loading={loading}
            leftIcon={<UserPlus className="h-4 w-4" aria-hidden />}
          >
            {loading ? 'Creating…' : 'Register'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have access?{' '}
          <Link className="text-emerald-400 hover:text-emerald-300" to="/auth/login">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
