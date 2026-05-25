import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/** Requires a stored access JWT; redirects to login with return URL. */
export function ProtectedRoute() {
  const { accessToken } = useAuth()
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}
