import { Home, LayoutDashboard } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/auth/AuthCard'
import { Button, ErrorState } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'

type UnauthorizedState = {
  requiredRoles?: string[]
  role?: string | null
}

export default function UnauthorizedPage() {
  const location = useLocation()
  const nav = useNavigate()
  const { isAuthenticated } = useAuth()
  const state = (location.state as UnauthorizedState | null) ?? {}

  const required = state.requiredRoles?.length ? state.requiredRoles.join(', ') : 'elevated access'
  const roleLabel = state.role ?? 'unknown'

  return (
    <AuthLayout>
      <AuthCard accent="violet" className="max-w-lg border-amber-500/15">
        <ErrorState
          variant="forbidden"
          title="Unauthorized"
          message={`This area requires: ${required}. Your current role is ${roleLabel}.`}
          action={
            <div className="flex flex-wrap gap-2">
              {isAuthenticated ? (
                <Button type="button" leftIcon={<LayoutDashboard className="h-4 w-4" aria-hidden />} onClick={() => nav('/app')}>
                  Dashboard
                </Button>
              ) : (
                <Button type="button" leftIcon={<Home className="h-4 w-4" aria-hidden />} onClick={() => nav('/auth/login')}>
                  Sign in
                </Button>
              )}
            </div>
          }
        />
      </AuthCard>
    </AuthLayout>
  )
}
