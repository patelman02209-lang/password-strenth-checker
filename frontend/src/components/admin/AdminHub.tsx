import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../ui'
import { AdminDashboard } from './AdminDashboard'
import { SecurityAuditDashboard } from './SecurityAuditDashboard'

export function AdminHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('adminView') === 'security' ? 'security' : 'analytics'

  const setView = useCallback(
    (next: 'analytics' | 'security') => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', 'admin')
          if (next === 'security') p.set('adminView', 'security')
          else p.delete('adminView')
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5">
        <Button
          type="button"
          variant={view === 'analytics' ? 'primary' : 'secondary'}
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={() => setView('analytics')}
        >
          Analytics
        </Button>
        <Button
          type="button"
          variant={view === 'security' ? 'primary' : 'secondary'}
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={() => setView('security')}
        >
          Security &amp; audit
        </Button>
      </div>
      {view === 'analytics' ? <AdminDashboard key="analytics" /> : <SecurityAuditDashboard key="security" />}
    </div>
  )
}
