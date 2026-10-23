import { CircleAlert, RotateCcw } from 'lucide-react'

function errorMessage(error) {
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'Tải dữ liệu mất nhiều thời gian hơn dự kiến. Bạn thử lại sau một chút nhé.'
  }
  if (error?.response?.data?.message && typeof error.response.data.message === 'string') {
    return error.response.data.message
  }
  if (!error?.response) return 'Không thể kết nối để tải dữ liệu. Bạn kiểm tra kết nối và thử lại nhé.'
  return 'Dữ liệu hiện chưa sẵn sàng. Bạn vui lòng thử lại sau.'
}

export default function ErrorState({ title = 'Chưa thể tải dữ liệu', error, onRetry }) {
  return (
    <div className="rounded-3xl border border-orange/30 bg-white px-5 py-12 text-center" role="alert">
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-orange/12 text-[#A35720]"><CircleAlert size={29} strokeWidth={1.4} aria-hidden="true" /></div>
      <h3 className="text-xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-ink/65">{errorMessage(error)}</p>
      {onRetry && <button type="button" onClick={onRetry} className="button-secondary mt-6"><RotateCcw size={17} aria-hidden="true" />Thử lại</button>}
    </div>
  )
}
