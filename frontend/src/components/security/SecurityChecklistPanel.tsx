import { useCallback, useEffect, useState, startTransition } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Card, ErrorState, PageHeader } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { cn } from '../ui/utils'

type ChecklistRow = {
  id: string
  title: string
  description: string
  done: boolean
}

type SecurityProfile = {
  two_factor_enabled: boolean
  password_rotation_max_age_days: number
  vault_security: { health_score: number; totals: Record<string, number> }
  checklist: ChecklistRow[]
}

export function SecurityChecklistPanel() {
  const { accessToken } = useAuth()
  const [data, setData] = useState<SecurityProfile | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const h = { Authorization: `Bearer ${accessToken ?? ''}` }
      const rep = await api<SecurityProfile>('/auth/security-profile', { headers: h })
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

  const doneCount = data?.checklist.filter((c) => c.done).length ?? 0
  const total = data?.checklist.length ?? 0

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
          eyebrow="Hardening"
          title="Security checklist"
          description="Actionable goals derived from your account flags and vault metadata. None of these steps require exposing vault passwords in exports or logs."
          actions={
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10"
            >
              Refresh
            </button>
          }
        />

        {err ? <ErrorState title="Could not load checklist" message={err} /> : null}

        {loading && !data ? (
          <div className="space-y-3" role="status" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-sm text-zinc-300">
                Progress: <span className="font-semibold text-white">{doneCount}</span> / {total}
              </p>
              <p className="text-sm text-zinc-400">
                Vault health score: <span className="font-mono text-emerald-300">{data.vault_security.health_score}</span>
              </p>
              <p className="text-xs text-zinc-500">2FA: {data.two_factor_enabled ? 'enabled' : 'not enabled'}</p>
            </div>
            <ul className="space-y-3">
              {data.checklist.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    'flex gap-3 rounded-xl border px-4 py-3',
                    row.done ? 'border-emerald-500/25 bg-emerald-950/20' : 'border-white/10 bg-black/25',
                  )}
                >
                  {row.done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" aria-hidden />
                  )}
                  <div>
                    <p className="font-medium text-white">{row.title}</p>
                    <p className="mt-1 text-sm text-zinc-400">{row.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Card>
  )
}
