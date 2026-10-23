import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { CircleAlert, RotateCcw } from 'lucide-react'
import useAuth from '../hooks/useAuth.js'
import LoadingSpinner from './LoadingSpinner.jsx'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, sessionStatus, error, refreshSession } = useAuth()
  const location = useLocation()
  if (isLoading) return <LoadingSpinner label="Đang kiểm tra phiên đăng nhập…" />
  if (sessionStatus === 'unknown') {
    return (
      <section className="container-shell py-16" role="alert">
        <div className="surface-card mx-auto max-w-xl p-8 text-center">
          <CircleAlert size={32} className="mx-auto text-orange" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-dark-green">Chưa thể kiểm tra phiên đăng nhập</h1>
          <p className="mt-3 text-sm leading-7 text-ink/70">{error}</p>
          <button type="button" onClick={() => void refreshSession()} className="button-secondary mt-6"><RotateCcw size={17} aria-hidden="true" />Thử lại</button>
        </div>
      </section>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  return children || <Outlet />
}
