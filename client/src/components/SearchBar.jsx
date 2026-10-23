import { Search } from 'lucide-react'
import { useId } from 'react'

export default function SearchBar({ value, onChange, onSubmit, placeholder = 'Bạn muốn tìm món gì?' }) {
  const inputId = useId()

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex min-w-0 flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <label htmlFor={inputId} className="sr-only">Tìm kiếm theo tên món ăn</label>
        <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest/65" />
        <input
          id={inputId}
          type="search"
          name="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={150}
          placeholder={placeholder}
          enterKeyHint="search"
          className="field w-full py-3.5 pr-4 pl-12"
        />
      </div>
      <button type="submit" className="button-primary shrink-0 px-6"><Search size={18} aria-hidden="true" />Tìm món ăn</button>
    </form>
  )
}
