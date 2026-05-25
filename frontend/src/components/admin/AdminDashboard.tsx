import { Activity, AlertTriangle, BarChart3, Binary, Flame, Shield, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, DataTable, ErrorState, PageHeader } from '../ui'
import { cn } from '../ui/utils'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'

const TOOLTIP_STYLE = {
  background: 'rgba(9,9,11,0.92)',
  border: '1px solid rgba(63,63,70,0.6)',
  borderRadius: 10,
  fontSize: 12,
} as const

/** Avoids Recharts first-paint -1×-1 in flex/jsdom before ResizeObserver runs. */
const CHART_INIT_DIM = { width: 640, height: 248 } as const

const STRENGTH_ORDER = ['very_weak', 'weak', 'moderate', 'strong', 'very_strong'] as const
const STRENGTH_COLORS: Record<string, string> = {
  very_weak: '#f87171',
  weak: '#fb923c',
  moderate: '#fbbf24',
  strong: '#34d399',
  very_strong: '#22d3ee',
}

function formatStrengthKey(k: string): string {
  return k.replace(/_/g, ' ')
}

type AdminAnalytics = {
  window_hours: number
  users: { total: number; active: number }
  last_24h: { password_checks: number; audit_events: number }
  password_checks_all_time: {
    total: number
    with_breach_flag: number
    by_strength_label: Record<string, number>
    weak_password_pct: number
    avg_entropy: number | null
  }
  top_detected_patterns: { pattern: string; count: number }[]
  checks_per_day: { date: string; checks: number; breaches: number }[]
  users_by_check_volume: { user_id: number; name: string; email: string; password_checks: number }[]
}

type UserRow = {
  id: number
  name: string
  email: string
  role: string
  status?: string
  is_two_factor_enabled?: boolean
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  accent: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'zinc'
}) {
  const ring =
    accent === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-950/20'
      : accent === 'sky'
        ? 'border-sky-500/20 bg-sky-950/20'
        : accent === 'amber'
          ? 'border-amber-500/25 bg-amber-950/20'
          : accent === 'rose'
            ? 'border-rose-500/20 bg-rose-950/20'
            : accent === 'violet'
              ? 'border-violet-500/20 bg-violet-950/20'
              : 'border-white/10 bg-black/30'
  const iconClass =
    accent === 'emerald'
      ? 'text-emerald-400'
      : accent === 'sky'
        ? 'text-sky-400'
        : accent === 'amber'
          ? 'text-amber-300'
          : accent === 'rose'
            ? 'text-rose-400'
            : accent === 'violet'
              ? 'text-violet-400'
              : 'text-zinc-500'

  return (
    <Card variant="outline" padding="md" className={cn('min-h-[108px] border', ring)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{title}</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tabular-nums text-white">{value}</p>
          {subtitle ? <p className="mt-1 text-[11px] leading-snug text-zinc-500">{subtitle}</p> : null}
        </div>
        <span className={cn('shrink-0 rounded-lg border border-white/10 bg-black/40 p-2', iconClass)}>{icon}</span>
      </div>
    </Card>
  )
}

function ChartCard({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card variant="outline" padding="md" className={cn('min-w-0 overflow-hidden border-white/10', className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description ? <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p> : null}
      </div>
      <div className="h-[260px] w-full min-h-[220px] min-w-0">{children}</div>
    </Card>
  )
}

export function AdminDashboard() {
  const { accessToken } = useAuth()
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      const headers = { Authorization: `Bearer ${accessToken}` }
      try {
        const [a, u] = await Promise.all([
          api<AdminAnalytics>('/admin/analytics', { headers }),
          api<{ users: UserRow[] }>('/admin/users', { headers }),
        ])
        if (!cancelled) {
          setAnalytics(a)
          setUsers(u.users)
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
  }, [accessToken])

  const strengthChartData = useMemo(() => {
    const by = analytics?.password_checks_all_time.by_strength_label ?? {}
    return STRENGTH_ORDER.filter((k) => (by[k] ?? 0) > 0).map((k) => ({
      label: formatStrengthKey(k),
      key: k,
      count: by[k] ?? 0,
    }))
  }, [analytics])

  const timelineData = useMemo(
    () =>
      (analytics?.checks_per_day ?? []).map((d) => ({
        ...d,
        short: d.date.slice(5),
      })),
    [analytics],
  )

  const patternChartData = useMemo(() => {
    const rows = analytics?.top_detected_patterns ?? []
    return rows.slice(0, 12).map((r) => ({
      ...r,
      short: r.pattern.length > 42 ? `${r.pattern.slice(0, 40)}…` : r.pattern,
    }))
  }, [analytics])

  const topPatternsText = useMemo(() => {
    const rows = analytics?.top_detected_patterns ?? []
    return rows.slice(0, 5)
  }, [analytics])

  const pc = analytics?.password_checks_all_time

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
          title="Admin analytics"
          description="Organization-wide password intelligence and audit visibility. All metrics are derived from stored metadata only — never from raw passwords."
        />

        {err ? <ErrorState title="Could not load admin data" message={err} /> : null}

        {loading && !analytics ? (
          <div
            className="grid animate-pulse gap-4 md:grid-cols-2 lg:grid-cols-3"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading admin analytics"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : null}

        {analytics && pc ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <StatCard
                title="Total users"
                value={analytics.users.total}
                subtitle={`${analytics.users.active} active`}
                icon={<Users className="h-4 w-4" aria-hidden />}
                accent="emerald"
              />
              <StatCard
                title="Password checks (all time)"
                value={pc.total}
                subtitle={`${analytics.last_24h.password_checks} in last ${analytics.window_hours}h`}
                icon={<Activity className="h-4 w-4" aria-hidden />}
                accent="sky"
              />
              <StatCard
                title="Weak password rate"
                value={`${pc.weak_password_pct}%`}
                subtitle="very_weak + weak labels"
                icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
                accent="amber"
              />
              <StatCard
                title="Breach-flagged checks"
                value={pc.with_breach_flag}
                subtitle="HIBP / breach metadata at analysis time"
                icon={<Flame className="h-4 w-4" aria-hidden />}
                accent="rose"
              />
              <StatCard
                title="Avg entropy"
                value={pc.avg_entropy != null ? pc.avg_entropy.toFixed(1) : '—'}
                subtitle="bits (stored score)"
                icon={<Binary className="h-4 w-4" aria-hidden />}
                accent="violet"
              />
              <StatCard
                title="Audit events (24h)"
                value={analytics.last_24h.audit_events}
                subtitle="Security-relevant actions logged"
                icon={<Shield className="h-4 w-4" aria-hidden />}
                accent="zinc"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card variant="outline" padding="md" className="border-white/10">
                <h3 className="text-sm font-semibold text-white">Most common detected patterns</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Aggregated from saved analysis metadata (password text is never stored).</p>
                {topPatternsText.length ? (
                  <ol className="mt-4 space-y-2">
                    {topPatternsText.map((p, i) => (
                      <li key={p.pattern} className="flex items-center justify-between gap-2 text-sm text-zinc-300">
                        <span className="min-w-0 truncate">
                          <span className="mr-2 font-mono text-xs text-zinc-500">{i + 1}.</span>
                          {p.pattern}
                        </span>
                        <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-emerald-200">{p.count}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500">No pattern data yet — run password analyses to populate.</p>
                )}
              </Card>

              <Card variant="outline" padding="md" className="border-amber-500/20 bg-amber-950/10">
                <div className="flex gap-3">
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-100">Security findings summary</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                      Placeholder for a future feed: static analysis (SAST), dependency advisories, policy drift, and
                      production security scans. Wire external tools here when available; this panel is intentionally
                      non-blocking for coursework demos.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <ChartCard
                title="Strength distribution"
                description="Histogram of persisted strength_label values across all password checks."
              >
                {strengthChartData.length ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    initialDimension={CHART_INIT_DIM}
                  >
                    <BarChart data={strengthChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={56} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#a1a1aa' }} />
                      <Bar dataKey="count" name="Checks" radius={[6, 6, 0, 0]}>
                        {strengthChartData.map((e) => (
                          <Cell key={e.key} fill={STRENGTH_COLORS[e.key] ?? '#71717a'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-zinc-500">No strength data yet.</p>
                )}
              </ChartCard>

              <ChartCard
                title="Password checks over time"
                description="Last 14 days (UTC), count of stored password analysis rows per day."
              >
                <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT_DIM}>
                  <ComposedChart data={timelineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="short" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#a1a1aa' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="checks" name="Checks" fill="#34d399" radius={[4, 4, 0, 0]} opacity={0.85} />
                    <Line type="monotone" dataKey="breaches" name="Breach-flagged" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Breach detection trend"
                description="Same 14-day window: checks where breach metadata was true at analysis time."
              >
                <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT_DIM}>
                  <ComposedChart data={timelineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="short" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#a1a1aa' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="breaches" name="Breach-flagged" stroke="#fb7185" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Pattern frequency"
                description="Top detected pattern strings (truncated on axis for readability)."
              >
                {patternChartData.length ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    initialDimension={CHART_INIT_DIM}
                  >
                    <BarChart layout="vertical" data={patternChartData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.12)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="short"
                        width={118}
                        tick={{ fill: '#a1a1aa', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const row = payload[0].payload as { pattern: string; count: number }
                          return (
                            <div
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs shadow-xl"
                              style={{ background: 'rgba(9,9,11,0.92)' }}
                            >
                              <p className="max-w-xs text-zinc-300">{row.pattern}</p>
                              <p className="mt-1 font-mono text-emerald-300">Count: {row.count}</p>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="count" name="Occurrences" fill="#38bdf8" radius={[0, 6, 6, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-zinc-500">No patterns recorded yet.</p>
                )}
              </ChartCard>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zinc-500" aria-hidden />
                <h3 className="text-sm font-semibold text-white">User activity summary</h3>
              </div>
              <p className="mb-3 text-[11px] text-zinc-500">Users with the highest volume of stored password analyses.</p>
              <DataTable
                columns={[
                  { key: 'name', header: 'User', cell: (r) => <span className="font-medium text-white">{r.name}</span> },
                  {
                    key: 'email',
                    header: 'Email',
                    cell: (r) => <span className="text-xs text-zinc-400">{r.email}</span>,
                  },
                  {
                    key: 'n',
                    header: 'Checks',
                    cell: (r) => (
                      <span className="font-mono text-emerald-300">{r.password_checks}</span>
                    ),
                  },
                ]}
                data={analytics.users_by_check_volume}
                rowKey={(r) => r.user_id}
                empty="No password checks recorded yet."
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">User directory</h3>
                <span className="text-[11px] text-zinc-500">{users.length} accounts</span>
              </div>
              <DataTable
                columns={[
                  { key: 'name', header: 'User', cell: (u) => u.name },
                  {
                    key: 'email',
                    header: 'Email',
                    cell: (u) => <span className="text-xs text-zinc-400">{u.email}</span>,
                  },
                  {
                    key: 'role',
                    header: 'Role',
                    cell: (u) => <span className="text-xs font-medium text-emerald-300">{u.role}</span>,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (u) => <span className="text-xs text-zinc-400">{u.status ?? '—'}</span>,
                  },
                  {
                    key: '2fa',
                    header: '2FA',
                    cell: (u) => (
                      <span className="text-xs text-zinc-400">{u.is_two_factor_enabled ? 'On' : 'Off'}</span>
                    ),
                  },
                ]}
                data={users}
                rowKey={(u) => u.id}
                empty="No registered users."
              />
            </div>
          </>
        ) : null}
      </div>
    </Card>
  )
}
