import { useId } from 'react'
import { Star } from 'lucide-react'

export default function StarRating({ value = 0, onChange, disabled = false, label = 'Chọn số sao' }) {
  const name = useId()
  if (!onChange) {
    return <span role="img" aria-label={`${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)} trên 5 sao`} className="inline-flex gap-0.5 text-orange">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={18} fill={star <= Math.round(value) ? 'currentColor' : 'none'} aria-hidden="true" />)}</span>
  }
  return <fieldset disabled={disabled}>
    <legend className="mb-2 text-sm font-semibold text-dark-green">{label}</legend>
    <div className="flex flex-wrap gap-1">
      {[1, 2, 3, 4, 5].map((star) => <label key={star} className="relative cursor-pointer">
        <input type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} aria-label={`${star} sao`} className="peer sr-only" />
        <span className="flex size-11 items-center justify-center rounded-lg text-orange transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest peer-disabled:cursor-not-allowed peer-disabled:opacity-50 hover:bg-orange/10"><Star size={27} fill={star <= value ? 'currentColor' : 'none'} aria-hidden="true" /></span>
      </label>)}
    </div>
    <p className="mt-1 text-xs text-ink/60" aria-live="polite">{value ? `Bạn chọn ${value}/5 sao` : 'Chọn từ 1 đến 5 sao.'}</p>
  </fieldset>
}
