import { SearchX } from 'lucide-react'

export default function EmptyState({ title = 'Chưa tìm thấy món ăn phù hợp', description = 'Bạn thử đổi từ khóa hoặc điều chỉnh bộ lọc để khám phá thêm món ăn nhé.', action }) {
  return (
    <div className="rounded-3xl border border-dashed border-forest/20 bg-white px-5 py-14 text-center" role="status">
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-forest/8 text-forest"><SearchX size={29} strokeWidth={1.4} aria-hidden="true" /></div>
      <h3 className="text-xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink/65">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}
