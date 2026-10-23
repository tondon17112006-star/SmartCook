import { LoaderCircle } from 'lucide-react'

export default function LoadingSpinner({ label = 'Đang tải dữ liệu…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-forest" role="status" aria-live="polite">
      <LoaderCircle size={21} className="motion-safe:animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
