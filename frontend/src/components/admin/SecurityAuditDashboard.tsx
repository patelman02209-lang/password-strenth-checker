import { AlertTriangle, Download, Lock, Search, Shield } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, Input, PageHeader } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { api, resolveApiUrl } from '../../lib/api'
import { getHttpAuth } from '../../lib/http-auth-bridge'

type AuditRow = {
  id: number
  user_id: number | null
  action: string
  entity: string | null
  entity_id: number | null
  ip_address: string | null
  user_agent: string | null
  metadata: unknown
  created_at: string | null
}

type SecurityActivity = {
  window_days: number
  failed_logins: { last_24h: number; in_window: number }
  password_activity: { total_events: number; by_action: Record<string, number> }
  vault_activity: { total_events: number; by_action: Record<string, number> }
  recent_failed_logins: AuditRow[]
}

function auditRisk(
  action: string,
): { label: string; variant: 'danger' | 'warning' | 'info' | 'success' | 'default' } {
  if (action === 'login_failed') return { label: 'Risk', variant: 'danger' }
  if (action === 'vault_reveal_password') return { label: 'Sensitive', variant: 'danger' }
  if (action === 'vault_delete') return { label: 'Destructive', variant: 'warning' }
  if (action.startsWith('vault_')) return { label: 'Vault', variant: 'info' }
  if (action === 'password_check' || action === 'hash_demo' || action === 'password_generate')
    return { label: 'Analysis', variant: 'success' }
  if (action.startsWith('admin_')) return { label: 'Admin', variant: 'default' }
  return { label: 'Activity', variant: 'default' }
}

function buildQuery(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && String(v).trim() !== '') u.set(k, String(v).trim())
  })
  const s = u.toString()
  return s ? `?${s}` : ''
}

const EMPTY_FILTERS = { userId: '', action: '', entity: '', dateFrom: '', dateTo: '', q: '' }

export function SecurityAuditDashboard() {
  const { accessToken } = useAuth()
  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken ?? ''}` }), [accessToken])

  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const perPage = 25

  const [items, setItems] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [activity, setActivity] = useState<SecurityActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)

  const listQuery = useMemo(
    () =>
      buildQuery({
        page: String(page),
        per_page: String(perPage),
        user_id: applied.userId.trim() || undefined,
        action: applied.action.trim() || undefined,
        entity: applied.entity.trim() || undefined,
        date_from: applied.dateFrom.trim() || undefined,
        date_to: applied.dateTo.trim() || undefined,
        q: applied.q.trim() || undefined,
      }),
    [page, perPage, applied],
  )

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const [log, act] = await Promise.all([
          api<{ items: AuditRow[]; total: number }>(`/admin/audit-logs${listQuery}`, { headers }),
          api<SecurityActivity>('/admin/security/activity?days=7', { headers }),
        ])
        if (!cancelled) {
          setItems(log.items)
          setTotal(log.total)
          setActivity(act)
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, headers, listQuery])

  async function exportCsv() {
    const token = getHttpAuth()?.getAccessToken()
    if (!token) return
    setExportBusy(true)
    try {
      const qs = buildQuery({
        user_id: applied.userId.trim() || undefined,
        action: applied.action.trim() || undefined,
        entity: applied.entity.trim() || undefined,
        date_from: applied.dateFrom.trim() || undefined,
        date_to: applied.dateTo.trim() || undefined,
        q: applied.q.trim() || undefined,
      })
      const url = resolveApiUrl(`/admin/audit-logs/export.csv${qs}`)
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || res.statusText)
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'audit_logs_export.csv'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setExportBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

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
      <div className="space-y-8 p-6">
        <PageHeader
          title="Security and audit"
          description="Filterable audit trail with CSV export. Metadata is redacted server-side: passwords and vault secrets are never included in audit payloads."
        />

        {err ? <p className="text-sm text-rose-400">{err}</p> : null}

        {activity ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card variant="outline" padding="md" className="border-rose-500/20 bg-rose-950/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Failed logins</h3>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-rose-200">{activity.failed_logins.last_24h}</p>
              <p className="text-[11px] text-zinc-500">Last 24 hours (audit action login_failed)</p>
              <p className="mt-2 text-lg font-medium text-zinc-300">{activity.failed_logins.in_window}</p>
              <p className="text-[11px] text-zinc-500">In last {activity.window_days} days</p>
            </Card>
            <Card variant="outline" padding="md" className="border-emerald-500/15">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Password check activity</h3>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-200">
                {activity.password_activity.total_events}
              </p>
              <p className="text-[11px] text-zinc-500">Audit events: analyze, generate, hash demo</p>
              <ul className="mt-3 space-y-1 text-[11px] text-zinc-400">
                {Object.entries(activity.password_activity.by_action).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="font-mono text-zinc-500">{k}</span>
                    <span className="text-emerald-200">{v}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="outline" padding="md" className="border-sky-500/20">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-sky-400" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Credential (vault) activity</h3>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-sky-200">{activity.vault_activity.total_events}</p>
              <p className="text-[11px] text-zinc-500">Vault-related audit actions in window</p>
              <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-[11px] text-zinc-400">
                {Object.entries(activity.vault_activity.by_action).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="truncate font-mono text-zinc-500">{k}</span>
                    <span className="shrink-0 text-sky-200">{v}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : null}

        {activity && activity.recent_failed_logins.length > 0 ? (
          <Card variant="outline" padding="md" className="border-white/10">
            <h3 className="text-sm font-semibold text-white">Recent failed login attempts</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">No raw identifiers stored for unknown-user failures.</p>
            <DataTable
              className="mt-3"
              columns={[
                {
                  key: 't',
                  header: 'Time (UTC)',
                  cell: (r) => (
                    <span className="whitespace-nowrap font-mono text-[11px] text-zinc-400">
                      {r.created_at ? new Date(r.created_at).toISOString().slice(0, 19).replace('T', ' ') : '—'}
                    </span>
                  ),
                },
                { key: 'u', header: 'User id', cell: (r) => <span className="font-mono text-xs">{r.user_id ?? '—'}</span> },
                { key: 'ip', header: 'IP', cell: (r) => <span className="text-xs text-zinc-500">{r.ip_address ?? '—'}</span> },
                {
                  key: 'm',
                  header: 'Meta',
                  cell: (r) => (
                    <span className="line-clamp-2 text-[11px] text-zinc-500">
                      {r.metadata && typeof r.metadata === 'object' ? JSON.stringify(r.metadata) : '—'}
                    </span>
                  ),
                },
              ]}
              data={activity.recent_failed_logins}
              rowKey={(r) => r.id}
              empty="None"
            />
          </Card>
        ) : null}

        <Card variant="outline" padding="md" className="border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Security timeline</h3>
            <span className="text-[11px] text-zinc-500">Current result page (newest first)</span>
          </div>
          {loading && !items.length ? (
            <div className="mt-4 h-32 animate-pulse rounded-lg bg-white/5" />
          ) : (
            <ul className="relative mt-4 max-h-[420px] space-y-0 overflow-y-auto border-l border-white/10 pl-4">
              {items.map((row) => {
                const risk = auditRisk(row.action)
                const t = row.created_at ? new Date(row.created_at).toISOString().slice(0, 19).replace('T', ' ') : '—'
                return (
                  <li key={row.id} className="relative pb-6 pl-2">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-zinc-950" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-zinc-500">{t}</span>
                      <Badge variant={risk.variant}>{risk.label}</Badge>
                      <span className="text-xs font-medium text-sky-200">{row.action}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {row.entity ?? '—'}
                      {row.entity_id != null ? ` #${row.entity_id}` : ''} · user {row.user_id ?? '—'} ·{' '}
                      {row.ip_address ?? '—'}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card variant="outline" padding="md" className="border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Searchable audit log</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" aria-hidden />}
              loading={exportBusy}
              onClick={() => void exportCsv()}
            >
              Export CSV
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Filters apply to the table and export (max 5000 rows per CSV). Dates: YYYY-MM-DD UTC day bounds.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Input
              label="User id"
              value={draft.userId}
              onChange={(e) => setDraft((d) => ({ ...d, userId: e.target.value }))}
              placeholder="e.g. 2"
            />
            <Input
              label="Action contains"
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
              placeholder="login"
            />
            <Input
              label="Entity contains"
              value={draft.entity}
              onChange={(e) => setDraft((d) => ({ ...d, entity: e.target.value }))}
              placeholder="user"
            />
            <Input
              label="Date from"
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
            />
            <Input
              label="Date to"
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
            />
            <Input
              label="Search"
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder="action or entity"
              leftSlot={<Search className="h-4 w-4 text-zinc-500" aria-hidden />}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                setApplied({ ...draft })
                setPage(1)
              }}
            >
              Apply filters
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(EMPTY_FILTERS)
                setApplied(EMPTY_FILTERS)
                setPage(1)
              }}
            >
              Clear
            </Button>
          </div>

          <div className="mt-6">
            <DataTable
              columns={[
                {
                  key: 'risk',
                  header: '',
                  cell: (r) => {
                    const x = auditRisk(r.action)
                    return <Badge variant={x.variant}>{x.label}</Badge>
                  },
                },
                {
                  key: 't',
                  header: 'Time (UTC)',
                  cell: (r) => (
                    <span className="whitespace-nowrap font-mono text-[11px] text-zinc-400">
                      {r.created_at ? new Date(r.created_at).toISOString().slice(0, 19).replace('T', ' ') : '—'}
                    </span>
                  ),
                },
                { key: 'a', header: 'Action', cell: (r) => <span className="text-xs text-sky-200">{r.action}</span> },
                {
                  key: 'e',
                  header: 'Entity',
                  cell: (r) => (
                    <span className="text-xs text-zinc-400">
                      {r.entity ?? '—'}
                      {r.entity_id != null ? ` #${r.entity_id}` : ''}
                    </span>
                  ),
                },
                { key: 'u', header: 'User', cell: (r) => <span className="font-mono text-[11px]">{r.user_id ?? '—'}</span> },
                { key: 'ip', header: 'IP', cell: (r) => <span className="text-[11px] text-zinc-500">{r.ip_address ?? '—'}</span> },
                {
                  key: 'meta',
                  header: 'Metadata (sanitized)',
                  cell: (r) => (
                    <pre className="max-h-24 max-w-[18rem] overflow-auto whitespace-pre-wrap break-all text-[10px] text-zinc-500">
                      {r.metadata != null ? JSON.stringify(r.metadata) : '—'}
                    </pre>
                  ),
                },
              ]}
              data={items}
              rowKey={(r) => r.id}
              empty={loading ? 'Loading…' : 'No rows match filters.'}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              Page {page} of {totalPages} · {total} events
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Card>
  )
}
