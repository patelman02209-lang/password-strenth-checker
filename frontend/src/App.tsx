import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/routing/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import TwoFactorSetupPage from './pages/auth/TwoFactorSetupPage'
import TwoFactorVerifyPage from './pages/auth/TwoFactorVerifyPage'
import UnauthorizedPage from './pages/auth/UnauthorizedPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth/login" replace />} />
            <Route path="/register" element={<Navigate to="/auth/register" replace />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/verify" element={<TwoFactorVerifyPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/auth/2fa-setup" element={<TwoFactorSetupPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/auth/login" replace />} />
          </Routes>
          </BrowserRouter>
        </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
