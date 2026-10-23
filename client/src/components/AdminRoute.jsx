import { Link, Outlet } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import useAuth from '../hooks/useAuth.js'
import ProtectedRoute from './ProtectedRoute.jsx'

function AuthorizedAdmin({ children }) {
  const { currentUser } = useAuth()
  // This protects the interface only. Express checks the current database role
  // on every admin API call, regardless of this client-side value.
  if (currentUser?.role !== 'Admin') {
    return (
      <main className="container-shell py-16">
        <div className="surface-card mx-auto max-w-xl p-8 text-center" role="alert">
          <ShieldAlert size={38} className="mx-auto text-orange" aria-hidden="true" />
          <p className="eyebrow mt-5">Không có quyền truy cập</p>
          <h1 className="mt-3 text-2xl font-bold text-dark-green">Khu vực dành cho quản trị viên</h1>
          <p className="mt-3 text-sm leading-7 text-ink/70">Tài khoản của bạn chưa được cấp quyền quản trị.</p>
          <Link className="button-primary mt-6" to="/">Về trang chủ</Link>
        </div>
      </main>
    )
  }
  return children || <Outlet />
}

export default function AdminRoute({ children }) {
  return <ProtectedRoute><AuthorizedAdmin>{children}</AuthorizedAdmin></ProtectedRoute>
}
