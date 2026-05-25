import { Copy, QrCode, Shield } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/auth/AuthCard'
import { Button, Input } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { api } from '../../lib/api'
import { normalizeOtp, validateOtpCode } from '../../lib/auth-validation'

type SetupPayload = {
  secret: string
  otpauth_url: string
  qr_data_url: string
  message?: string
}

export default function TwoFactorSetupPage() {
  const { accessToken } = useAuth()
  const nav = useNavigate()
  const { pushToast } = useToast()
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` }

  const [setup, setSetup] = useState<SetupPayload | null>(null)
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [loadingEnable, setLoadingEnable] = useState(false)

  if (!accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: '/auth/2fa-setup' }} />
  }

  async function beginSetup() {
    setError(null)
    setLoadingSetup(true)
    try {
      const res = await api<SetupPayload>('/auth/two_factor/setup', { method: 'POST', headers })
      setSetup(res)
      setCode('')
      pushToast({ variant: 'info', title: 'Secret issued', message: 'Scan the QR code with Google Authenticator.' })
    } catch (err) {
      setError((err as Error).message)
      pushToast({ variant: 'error', title: 'Setup failed', message: (err as Error).message })
    } finally {
      setLoadingSetup(false)
    }
  }

  async function enable(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const otpErr = validateOtpCode(code)
    if (otpErr) {
      setFieldError(otpErr)
      return
    }
    setFieldError(undefined)
    setLoadingEnable(true)
    try {
      await api('/auth/two_factor/enable', {
        method: 'POST',
        headers,
        json: { code: normalizeOtp(code) },
      })
      pushToast({ variant: 'success', title: '2FA enabled', message: 'Your next sign-in will require a TOTP code.' })
      nav('/app', { replace: true })
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      pushToast({ variant: 'error', title: 'Enable failed', message: msg })
    } finally {
      setLoadingEnable(false)
    }
  }

  async function copySecret() {
    if (!setup?.secret) return
    try {
      await navigator.clipboard.writeText(setup.secret)
      pushToast({ variant: 'success', title: 'Copied', message: 'Store the secret offline if your policy requires it.' })
    } catch {
      pushToast({ variant: 'error', title: 'Copy failed', message: 'Select and copy the secret manually.' })
    }
  }

  return (
    <AuthLayout>
      <AuthCard accent="emerald" className="max-w-2xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <Shield className="h-5 w-5 text-emerald-300" aria-hidden />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-400/90">Authenticator</p>
            <h1 className="mt-1 text-xl font-semibold text-white">Set up two-factor authentication</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Links your account to a time-based one-time password (TOTP). Compatible with Google Authenticator,
              1Password, Authy, and similar apps.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
          <p className="font-medium text-white">Google Authenticator</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-zinc-400">
            <li>Install Google Authenticator from the App Store or Google Play.</li>
            <li>Tap <strong className="text-zinc-200">+</strong> then <strong className="text-zinc-200">Scan a QR code</strong>.</li>
            <li>Point the camera at the code below (or use “Enter a setup key” with issuer PSC Manager).</li>
            <li>Enter the 6-digit code to confirm — codes rotate every 30 seconds.</li>
          </ol>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void beginSetup()}
            loading={loadingSetup}
            leftIcon={<QrCode className="h-4 w-4" aria-hidden />}
          >
            {setup ? 'Regenerate QR & secret' : 'Generate QR code'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => nav('/app')}>
            Cancel
          </Button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        {setup?.qr_data_url ? (
          <div className="mt-6 flex flex-col gap-6 border-t border-white/10 pt-6 md:flex-row md:items-start">
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white p-3 shadow-inner shadow-black/40">
              <img src={setup.qr_data_url} alt="QR code for TOTP enrollment in Google Authenticator" width={200} height={200} className="h-[200px] w-[200px]" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Manual entry secret</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded-lg bg-black/50 px-3 py-2 font-mono text-xs text-emerald-200">
                  {setup.secret}
                </code>
                <Button type="button" variant="secondary" size="sm" onClick={() => void copySecret()} leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden />}>
                  Copy
                </Button>
              </div>
              {setup.message ? <p className="text-xs text-zinc-500">{setup.message}</p> : null}
              <form className="space-y-3 pt-2" onSubmit={enable}>
                <Input
                  label="Confirmation code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    if (fieldError) setFieldError(undefined)
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  error={fieldError}
                  required
                />
                <Button type="submit" className="w-full sm:w-auto" loading={loadingEnable}>
                  {loadingEnable ? 'Enabling…' : 'Enable 2FA on my account'}
                </Button>
              </form>
            </div>
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-zinc-500">
          To turn off 2FA later, use the <span className="text-zinc-300">Authenticator</span> tab in the app (password
          + code required).
        </p>
        <p className="mt-2 text-center text-sm">
          <Link className="text-emerald-400 hover:text-emerald-300" to="/app">
            Back to dashboard
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
