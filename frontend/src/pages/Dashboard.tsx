import { AnimatePresence } from 'framer-motion'
import { LogOut, Moon, Sun } from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MeshBackground } from '../components/layout/MeshBackground'
import { EducationalTopicsModal } from '../components/education/EducationalTopicsModal'
import { PasswordHealthDashboard, SecurityChecklistPanel } from '../components/security'
import { PasswordStrengthAnalyzer, SecurePasswordGenerator } from '../components/password'
import { RequireRole } from '../components/routing/RequireRole'
import { VaultManager } from '../components/vault/VaultManager'
import { HashingDemoPanel } from '../components/hash/HashingDemoPanel'
import { AdminHub } from '../components/admin/AdminHub'
import { Card, ErrorState, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'

const ActivityBandChart = lazy(() =>
  import('../components/charts/ActivityBandChart').then((m) => ({ default: m.ActivityBandChart })),
)

type Tab = 'analyzer' | 'generator' | 'hibp' | 'vault' | 'hashing' | 'twofa' | 'health' | 'checklist' | 'admin'

function parseTab(searchParams: URLSearchParams, role: string | null | undefined): Tab {
  const raw = searchParams.get('tab')
  const base: Tab[] = ['analyzer', 'generator', 'hibp', 'vault', 'hashing', 'twofa', 'health', 'checklist']
  if (raw === 'admin' && role === 'ADMIN') return 'admin'
  if (role === 'ADMIN' && searchParams.get('adminView')) return 'admin'
  if (raw && base.includes(raw as Tab)) return raw as Tab
  if (searchParams.get('vaultMode') || searchParams.get('vaultItem')) return 'vault'
  return 'analyzer'
}

export default function Dashboard() {
  const { accessToken, logout, role } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = useMemo(() => parseTab(searchParams, role), [searchParams, role])
  const setTab = useCallback(
    (next: Tab) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', next)
          if (next !== 'vault') {
            p.delete('vaultMode')
            p.delete('vaultItem')
          }
          if (next !== 'admin') {
            p.delete('adminView')
          }
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const [analyzerImport, setAnalyzerImport] = useState<{ password: string; nonce: number } | null>(null)
  const [vaultImport, setVaultImport] = useState<{ password: string; title?: string; nonce: number } | null>(null)
  const clearAnalyzerImport = useCallback(() => setAnalyzerImport(null), [])
  const clearVaultImport = useCallback(() => setVaultImport(null), [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--psc-bg)] pb-24 text-zinc-100">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-emerald-950"
      >
        Skip to workspace
      </a>
      <MeshBackground />
      <div className="relative z-10">
        <header className="workspace-header border-b border-white/10 bg-zinc-950/50 backdrop-blur-xl">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 md:grid-cols-[1fr_minmax(200px,280px)] md:items-center">
            <div className="flex flex-wrap items-center justify-between gap-3 md:justify-start md:gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-400/90">PSC Manager</p>
                <h1 className="text-lg font-semibold text-white md:text-xl">Security command center</h1>
                <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">Neon SOC-style workspace · mobile-first</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <EducationalTopicsModal />
                <button
                  type="button"
                  onClick={() => toggleTheme()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-400/40 hover:text-emerald-100"
                  aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                >
                  {theme === 'dark' ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-300/90">
                  Role: {role ?? 'unknown'}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-rose-400/50 hover:text-rose-100"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Log out
                </button>
              </div>
            </div>
            <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-2 shadow-inner shadow-black/40">
              <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Activity band (demo series)
              </p>
              <Suspense
                fallback={<div className="h-28 animate-pulse rounded-lg bg-white/5 sm:h-32" aria-hidden />}
              >
                <ActivityBandChart />
              </Suspense>
            </div>
          </div>
          <nav
            className="mx-auto flex max-w-6xl gap-2 overflow-x-auto border-t border-white/5 px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Workspace sections"
          >
          {(
            [
              ['analyzer', 'Analyzer'],
              ['generator', 'Generator'],
              ['hibp', 'HIBP & breaches'],
              ['vault', 'Vault'],
              ['hashing', 'Hashing lab'],
              ['twofa', 'Authenticator'],
              ['health', 'Health'],
              ['checklist', 'Checklist'],
              ...(role === 'ADMIN' ? ([['admin', 'Admin']] as const) : []),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id as Tab)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition sm:py-1 ${
                tab === id
                  ? 'bg-emerald-500 text-emerald-950 ring-2 ring-emerald-400/40 ring-offset-2 ring-offset-zinc-950'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main id="workspace-main" className="mx-auto mt-8 max-w-6xl space-y-8 px-4 pb-8" tabIndex={-1}>
        <AnimatePresence mode="wait">
          {tab === 'analyzer' && (
            <AnalyzerPanel
              key="analyzer"
              onNavigate={setTab}
              importRequest={analyzerImport}
              onImportConsumed={clearAnalyzerImport}
            />
          )}
          {tab === 'generator' && (
            <GeneratorPanel
              key="gen"
              onAnalyzePassword={(pwd) => {
                setAnalyzerImport({ password: pwd, nonce: Date.now() })
                setTab('analyzer')
              }}
              onSaveToVault={({ password, suggestedTitle }) => {
                setVaultImport({ password, title: suggestedTitle, nonce: Date.now() })
                setTab('vault')
              }}
            />
          )}
          {tab === 'hibp' && <HibpPanel key="hibp" />}
          {tab === 'vault' && (
            <VaultManager
              key={accessToken ?? 'anon'}
              importRequest={vaultImport}
              onImportConsumed={clearVaultImport}
            />
          )}
          {tab === 'hashing' && <HashingDemoPanel key="hash" />}
          {tab === 'twofa' && <TwofaPanel key="twofa" />}
          {tab === 'health' && <PasswordHealthDashboard key="health" />}
          {tab === 'checklist' && <SecurityChecklistPanel key="checklist" />}
          {tab === 'admin' && (
            <RequireRole key="admin" roles={['ADMIN']}>
              <AdminHub />
            </RequireRole>
          )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <Card
      variant="glass"
      padding="none"
      motionProps={{
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.2 },
      }}
    >
      <div className="p-6">
        <PageHeader title={title} description={subtitle} />
        {children}
      </div>
    </Card>
  )
}

function AnalyzerPanel({
  onNavigate,
  importRequest,
  onImportConsumed,
}: {
  onNavigate: (t: Tab) => void
  importRequest: { password: string; nonce: number } | null
  onImportConsumed: () => void
}) {
  const { accessToken } = useAuth()
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` }

  return (
    <Panel
      title="Password intelligence"
      subtitle="Live entropy, complexity scoring, pattern heuristics, HIBP range checks, crack-time models, and hardening tips—without storing your secret as plaintext."
    >
      <PasswordStrengthAnalyzer
        headers={headers}
        onOpenHibpTab={() => onNavigate('hibp')}
        importRequest={importRequest}
        onImportConsumed={onImportConsumed}
      />
    </Panel>
  )
}

function GeneratorPanel({
  onAnalyzePassword,
  onSaveToVault,
}: {
  onAnalyzePassword: (password: string) => void
  onSaveToVault: (payload: { password: string; suggestedTitle: string }) => void
}) {
  const { accessToken } = useAuth()
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` }

  return (
    <Panel
      title="Secure generator"
      subtitle="CSPRNG random strings or memorable passphrases — analyzed in-memory only; save explicitly in Vault if needed."
    >
      <SecurePasswordGenerator
        headers={headers}
        onAnalyzePassword={onAnalyzePassword}
        onSaveToVault={onSaveToVault}
      />
    </Panel>
  )
}

function HibpPanel() {
  const { accessToken } = useAuth()
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` }
  const [pwd, setPwd] = useState('')
  const [remote, setRemote] = useState<string | null>(null)
  const [local, setLocal] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function checkRemote() {
    setErr(null)
    try {
      const res = await api<{
        pwned_count: number
        breach_count?: number
        source?: string
        hibp_error?: string | null
      }>('/hibp', {
        method: 'POST',
        headers,
        json: { password: pwd },
      })
      setRemote(
        res.pwned_count < 0
          ? `Could not confirm exposure via HIBP${res.hibp_error ? ` (${String(res.hibp_error)})` : ''}.`
          : res.pwned_count === 0
            ? res.source === 'hibp'
              ? 'Not observed in the HIBP corpus (k-anonymity range API).'
              : 'Not listed in the sources consulted.'
            : `Observed ${res.pwned_count} time(s) in breach data${res.source === 'local_fallback' ? ' (offline list; HIBP unreachable).' : ''}.`,
      )
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function checkLocal() {
    setErr(null)
    try {
      const res = await api<Record<string, unknown>>('/local-breach', {
        method: 'POST',
        headers,
        json: { password: pwd },
      })
      setLocal(JSON.stringify(res, null, 2))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <Panel
      title="Exposure intelligence"
      subtitle="Online k-anonymity check plus optional offline hash corpora (see README)."
    >
      <textarea
        rows={3}
        className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-sm text-zinc-100"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={checkRemote}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          Have I Been Pwned
        </button>
        <button
          type="button"
          onClick={checkLocal}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-100 hover:border-sky-400/60"
        >
          Local breach file
        </button>
      </div>
      {err ? <ErrorState title="Check failed" message={err} className="mt-3" /> : null}
      {remote && <p className="mt-3 text-sm text-emerald-200">{remote}</p>}
      {local && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-black/70 p-3 text-xs text-zinc-200">{local}</pre>
      )}
    </Panel>
  )
}

function TwofaPanel() {
  const { accessToken } = useAuth()
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` }
  const [setup, setSetup] = useState<{ qr_data_url?: string; secret?: string } | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function begin() {
    setMsg(null)
    const res = await api<{ qr_data_url: string; secret: string }>('/auth/two_factor/setup', {
      method: 'POST',
      headers,
    })
    setSetup(res)
  }

  async function enable() {
    setMsg(null)
    await api('/auth/two_factor/enable', {
      method: 'POST',
      headers,
      json: { code },
    })
    setMsg('Two-factor authentication is now enforced on login.')
  }

  async function disable(password: string, codeVal: string) {
    setMsg(null)
    await api('/auth/two_factor/disable', {
      method: 'POST',
      headers,
      json: { password, code: codeVal },
    })
    setSetup(null)
    setMsg('2FA disabled and secrets cleared.')
  }

  const [dpwd, setDpwd] = useState('')
  const [dcode, setDcode] = useState('')

  return (
    <Panel
      title="Authenticator (TOTP)"
      subtitle="PyOTP-compatible secrets for Google Authenticator and similar apps."
    >
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void begin().catch((e) => setMsg((e as Error).message))}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950"
        >
          Start enrollment
        </button>
      </div>
      {setup?.qr_data_url && (
        <div className="mt-4 flex flex-col items-start gap-3 md:flex-row">
          <img src={setup.qr_data_url} alt="TOTP QR" className="rounded-xl border border-white/10 bg-white p-2" />
          <div className="text-xs text-zinc-300">
            <p className="font-mono break-all text-[11px] text-emerald-200">{setup.secret}</p>
            <p className="mt-2 max-w-md text-[11px] text-zinc-500">
              Scan the QR code, then enter a 6-digit rolling code to confirm enrollment. The secret is shown once for
              backup — store it offline if required by policy.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm"
                placeholder="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-sky-950"
                onClick={() => void enable().catch((e) => setMsg((e as Error).message))}
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-8 border-t border-white/5 pt-4">
        <p className="text-sm text-zinc-400">Disable 2FA</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="password"
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm"
            placeholder="Account password"
            value={dpwd}
            onChange={(e) => setDpwd(e.target.value)}
          />
          <input
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm"
            placeholder="TOTP code"
            value={dcode}
            onChange={(e) => setDcode(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-rose-500/40 px-3 py-1 text-xs text-rose-200"
            onClick={() => void disable(dpwd, dcode).catch((e) => setMsg((e as Error).message))}
          >
            Disable
          </button>
        </div>
      </div>
      {msg && <p className="mt-4 text-sm text-emerald-200">{msg}</p>}
    </Panel>
  )
}
