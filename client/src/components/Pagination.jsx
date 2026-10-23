import { ChevronLeft, ChevronRight } from 'lucide-react'

function visiblePages(current, total) {
  const pages = new Set([1, total])
  for (let value = Math.max(1, current - 1); value <= Math.min(total, current + 1); value += 1) pages.add(value)
  return [...pages].sort((left, right) => left - right)
}

export default function Pagination({ pagination, onPageChange, label = 'Phân trang món ăn' }) {
  if (!pagination || pagination.totalPages <= 1) return null
  const { page, totalPages } = pagination
  const pages = visiblePages(page, totalPages)

  return (
    <nav aria-label={label} className="mt-10 flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.min(totalPages, Math.max(1, page - 1)))}
          className="flex size-10 items-center justify-center rounded-xl border border-forest/15 bg-white text-forest transition hover:bg-forest/5 disabled:cursor-not-allowed disabled:opacity-35"
        ><ChevronLeft size={18} aria-hidden="true" /></button>
        {pages.map((value, index) => (
          <span key={value} className="inline-flex items-center gap-1.5 sm:gap-2">
            {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-ink/45" aria-hidden="true">…</span>}
            <button
              type="button"
              aria-label={`Trang ${value}`}
              aria-current={page === value ? 'page' : undefined}
              onClick={() => onPageChange(value)}
              className={`flex size-10 items-center justify-center rounded-xl border text-sm font-semibold transition ${page === value ? 'border-forest bg-forest text-white' : 'border-forest/15 bg-white text-ink hover:bg-forest/5'}`}
            >{value}</button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Trang sau"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex size-10 items-center justify-center rounded-xl border border-forest/15 bg-white text-forest transition hover:bg-forest/5 disabled:cursor-not-allowed disabled:opacity-35"
        ><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <p className="text-sm text-ink/60">Trang {page} / {totalPages}</p>
    </nav>
  )
}
