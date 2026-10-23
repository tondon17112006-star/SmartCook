import { CircleCheck, LoaderCircle, RefreshCw, Server, TriangleAlert } from 'lucide-react'
import useApiHealth from '../hooks/useApiHealth.js'

export default function HealthStatusCard() {
  const { status, data, error, checkHealth } = useApiHealth()
  const isLoading = status === 'loading'

  return (
    <section aria-labelledby="health-title" className="rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-emerald-50 p-3 text-forest"><Server size={22} aria-hidden="true" /></span>
          <div>
            <h2 id="health-title" className="text-lg font-semibold">Kết nối máy chủ</h2>
            <p className="mt-1 text-sm text-slate-500">Kiểm tra môi trường phát triển SmartCook</p>
          </div>
        </div>
        <button type="button" onClick={checkHealth} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-emerald-900/15 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60">
          <RefreshCw size={16} aria-hidden="true" className={isLoading ? 'animate-spin motion-reduce:animate-none' : ''} />
          Kiểm tra lại
        </button>
      </div>
      <div role="status" aria-live="polite" className="mt-6 rounded-2xl bg-cream p-4">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang kiểm tra kết nối…</p>
        )}
        {status === 'success' && (
          <div>
            <p className="flex items-center gap-2 font-medium text-forest"><CircleCheck size={18} aria-hidden="true" />Máy chủ đang hoạt động</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {data.service} · Kiểm tra lúc{' '}
              <time dateTime={data.timestamp}>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(data.timestamp))}</time>
              {' '}(giờ Việt Nam)
            </p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <p className="flex items-center gap-2 font-medium text-amber-800"><TriangleAlert size={18} aria-hidden="true" />Chưa có kết nối</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Kiểm tra này xác nhận API hoạt động; kết nối SQL Server sẽ được thiết lập ở giai đoạn sau.</p>
    </section>
  )
}
