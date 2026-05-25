import { useCallback, useEffect, useState, startTransition } from 'react'
import { Download, FileText, RefreshCw, Shield } from 'lucide-react'
import { Card, ErrorState, PageHeader } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { downloadAuthenticatedBlob } from '../../lib/downloadBlob'
import type { VaultSecurityReport } from '../../lib/vaultSecurityPdf'
import { downloadVaultSecurityPdf } from '../../lib/vaultSecurityPdf'

function StatTile({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card variant="outline" padding="md" className="border-white/10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
    </Card>
  )
}

export function PasswordHealthDashboard() {
  const { accessToken } = useAuth()
  const [data, setData] = useState<VaultSecurityReport | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const h = { Authorization: `Bearer ${accessToken ?? ''}` }
      const rep = await api<VaultSecurityReport>('/vault/security-report', { headers: h })
      setData(rep)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    startTransition(() => {
      void load()
    })
  }, [load])

  const onCsv = () => {
    void downloadAuthenticatedBlob('/vault/export/security-metadata.csv', 'password-security-metadata.csv')
  }

  const onPdf = () => {
    if (data) downloadVaultSecurityPdf(data)
  }

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
      <div className="space-y-6 p-6">
        <PageHeader
          eyebrow="Vault intelligence"
          title="Password health score"
          description="Aggregated from stored metadata only (strength labels, breach flags, rotation age, reuse detection). Passwords never leave the vault ciphertext except during explicit analysis."
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Refresh
              </button>
              <button
                type="button"
                onClick={onCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV report
              </button>
              <button
                type="button"
                onClick={onPdf}
                disabled={!data}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                PDF report
              </button>
            </div>
          }
        />

        {err ? <ErrorState title="Could not load health data" message={err} /> : null}

        {loading && !data ? (
          <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label="Loading health dashboard">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <Shield className="h-8 w-8 text-emerald-300" aria-hidden />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Composite score</p>
                  <p className="text-4xl font-bold tabular-nums text-white">{data.health_score}</p>
                  <p className="text-xs text-zinc-500">0 = needs attention · 100 = excellent posture</p>
                </div>
              </div>
              <p className="max-w-xl text-sm text-zinc-400">
                Reuse detection uses a privacy-preserving token per password (HMAC); identical secrets across sites
                increment the reuse cluster count. Rotate shared passwords and enable unique secrets per service.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile title="Credentials" value={String(data.totals.credentials)} subtitle="Entries in your vault" />
              <StatTile
                title="Weak / unanalyzed"
                value={`${data.totals.weak} / ${data.totals.unanalyzed}`}
                subtitle="Run analyzer on weak or blank labels"
              />
              <StatTile title="Breach flags" value={String(data.totals.breached_flags)} subtitle="From HIBP / local corpus checks" />
              <StatTile
                title="Stale passwords"
                value={String(data.totals.stale_passwords)}
                subtitle={`Older than ${data.password_rotation_max_age_days} days`}
              />
              <StatTile title="Reuse clusters" value={String(data.totals.reuse_clusters)} subtitle="Same password reused across entries" />
            </div>

            {data.reuse_clusters.length ? (
              <Card variant="outline" padding="md" className="border-amber-500/25 bg-amber-950/15">
                <p className="text-sm font-semibold text-amber-100">Reuse clusters detected</p>
                <ul className="mt-3 list-inside list-decimal space-y-2 text-sm text-zinc-300">
                  {data.reuse_clusters.map((c, idx) => (
                    <li key={idx}>
                      <span className="font-medium text-white">{c.size}</span> entries share the same secret —{' '}
                      <span className="text-zinc-400">{c.titles.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  )
}
