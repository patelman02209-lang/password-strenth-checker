import { ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/auth/AuthCard'
import { Button, Input } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { api } from '../../lib/api'
import { normalizeOtp, validateOtpCode } from '../../lib/auth-validation'

type VerifyState = {
  pendingToken: string
  from?: string
}

export default function TwoFactorVerifyPage() {
  const nav = useNavigate()
  const location = useLocation()
  const { setSession, accessToken } = useAuth()
  const { pushToast } = useToast()
  const state = location.state as VerifyState | null

  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  const pendingToken = state?.pendingToken ?? null

  useEffect(() => {
    if (accessToken) {
      const target = state?.from && state.from.startsWith('/') ? state.from : '/app'
      nav(target, { replace: true })
    }
  }, [accessToken, nav, state?.from])

  useEffect(() => {
    if (!pendingToken && !accessToken) {
      pushToast({ variant: 'info', title: 'Session expired', message: 'Sign in again to continue.' })
      nav('/auth/login', { replace: true })
    }
  }, [accessToken, nav, pendingToken, pushToast])

  if (!pendingToken || accessToken) {
    return null
  }

  const returnTo = state?.from && state.from.startsWith('/') ? state.from : '/app'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const otpErr = validateOtpCode(otp)
    if (otpErr) {
      setFieldError(otpErr)
      return
    }
    setFieldError(undefined)
    setLoading(true)
    try {
      const data = await api<{ access_token: string; refresh_token: string }>('/auth/two_factor/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pendingToken}` },
        json: { code: normalizeOtp(otp) },
      })
      setSession(data)
      pushToast({ variant: 'success', title: 'Verified', message: 'Session established.' })
      nav(returnTo, { replace: true })
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      pushToast({ variant: 'error', title: 'Verification failed', message: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthCard accent="violet" className="max-w-lg">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
            <ShieldCheck className="h-6 w-6 text-violet-300" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-violet-300/90">Two-factor verification</p>
            <h1 className="mt-1 text-xl font-semibold text-white">Authenticator code</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Open <span className="text-zinc-200">Google Authenticator</span> (or any TOTP app), select this account,
              and enter the 6-digit code that refreshes every 30 seconds.
            </p>
          </div>
        </div>

        <ol className="mb-6 list-decimal space-y-2 pl-5 text-sm text-zinc-400">
          <li>Launch Google Authenticator on your phone.</li>
          <li>Find the entry for <strong className="text-zinc-200">PSC Manager</strong>.</li>
          <li>Type the current code below (spaces are optional).</li>
        </ol>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Input
            label="One-time code"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value)
              if (fieldError) setFieldError(undefined)
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000 000"
            className="tracking-[0.35em]"
            error={fieldError}
            required
          />
          {error ? (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link className="text-zinc-300 underline-offset-4 hover:text-white hover:underline" to="/auth/login" replace>
            Wrong account? Back to sign in
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
