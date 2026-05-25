import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'

type Props = {
  roles: string[]
  children: ReactNode
}

/** Renders children only when JWT role is in ``roles`` (case-sensitive, matches API). */
export function RequireRole({ roles, children }: Props) {
  const { role } = useAuth()
  if (!role || !roles.includes(role)) {
    return <Navigate to="/unauthorized" replace state={{ requiredRoles: roles, role: role ?? null }} />
  }
  return children
}
