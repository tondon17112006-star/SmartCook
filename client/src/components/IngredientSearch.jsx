import { Search, X } from 'lucide-react'
import { useId, useRef } from 'react'

export default function IngredientSearch({ value, onChange, disabled = false }) {
  const inputId = useId()
  const inputRef = useRef(null)

  function clearSearch() {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div role="search" aria-label="Tìm nguyên liệu" className="relative min-w-0">
      <label htmlFor={inputId} className="sr-only">Tìm nguyên liệu theo tên</label>
      <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest/70" />
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="search"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        maxLength={150}
        placeholder="Tìm nguyên liệu: trứng, thịt, cà chua..."
        className="field min-w-0 py-3.5 pr-12 pl-12 disabled:opacity-50"
      />
      {value && (
        <button type="button" onClick={clearSearch} className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink/55 hover:bg-stone-50 hover:text-forest" aria-label="Xóa nội dung tìm nguyên liệu" disabled={disabled}>
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
