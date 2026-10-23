import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import ErrorState from '../components/ErrorState.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { checkAdminAccess } from '../services/authService.js'

export default function AdminAccessPage() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ loading: true, error: null, verified: false })
  useEffect(() => {
    const controller = new AbortController()
    checkAdminAccess({ signal: controller.signal }).then(() => {
      if (!controller.signal.aborted) setState({ loading: false, error: null, verified: true })
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ loading: false, error, verified: false })
    })
    return () => controller.abort()
  }, [attempt])
  return (
    <section className="container-shell py-12 sm:py-16">
      <p className="eyebrow">Quản trị SmartCook</p>
      <h1 className="section-title mt-3">Khu vực quản trị</h1>
      <div className="mt-8 max-w-3xl">
        {state.loading && <LoadingSpinner label="Đang xác minh quyền quản trị…" />}
        {state.error && <ErrorState title={state.error?.response?.status === 403 ? 'Bạn không có quyền quản trị' : 'Chưa thể xác minh quyền quản trị'} error={state.error} onRetry={() => { setState({ loading: true, error: null, verified: false }); setAttempt((value) => value + 1) }} />}
        {state.verified && <div className="surface-card p-7 sm:p-10"><ShieldCheck size={38} className="text-forest" aria-hidden="true" /><h2 className="mt-5 text-xl font-bold text-dark-green">Đã xác minh quyền quản trị</h2><p className="mt-4 leading-8 text-ink/70">Tài khoản của bạn đã được máy chủ xác nhận quyền truy cập khu vực này. Các công cụ quản lý món ăn, danh mục, nguyên liệu, tài khoản và đánh giá sẽ được phát triển ở giai đoạn tiếp theo.</p><Link to="/recipes" className="button-secondary mt-6">Khám phá món ăn</Link></div>}
      </div>
    </section>
  )
}
