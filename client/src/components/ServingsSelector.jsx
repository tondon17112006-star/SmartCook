import { Minus, Plus, UsersRound } from 'lucide-react'
import { useId } from 'react'

export default function ServingsSelector({ value, onChange, disabled = false, variant = 'select' }) {
  const selectId = useId()

  if (variant === 'stepper') {
    return (
      <div>
        <p id={selectId} className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark-green">
          <UsersRound size={17} aria-hidden="true" /> Số người ăn
        </p>
        <div role="group" aria-labelledby={selectId} className="inline-flex min-h-12 items-center overflow-hidden rounded-xl border border-forest/25 bg-white">
          <button type="button" aria-label="Giảm số người ăn" onClick={() => onChange(value - 1)} disabled={disabled || !Number.isInteger(value) || value <= 1} className="flex size-12 items-center justify-center text-forest transition-colors hover:bg-forest/10 disabled:opacity-35">
            <Minus size={18} aria-hidden="true" />
          </button>
          <output aria-label="Số người ăn" className="min-w-24 px-3 text-center font-bold tabular-nums text-dark-green">{Number.isInteger(value) ? `${value} người` : 'Chưa có'}</output>
          <button type="button" aria-label="Tăng số người ăn" onClick={() => onChange(value + 1)} disabled={disabled || !Number.isInteger(value) || value >= 20} className="flex size-12 items-center justify-center text-forest transition-colors hover:bg-forest/10 disabled:opacity-35">
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-ink/55">Chọn từ 1 đến 20 người. Giữ nguyên đơn vị của công thức.</p>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={selectId} className="mb-2 flex items-center gap-2 text-sm font-semibold text-dark-green">
        <UsersRound size={17} aria-hidden="true" /> Số người ăn
      </label>
      <select id={selectId} value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} className="field disabled:opacity-50">
        {Array.from({ length: 20 }, (_, index) => index + 1).map((servings) => <option key={servings} value={servings}>{servings} người</option>)}
      </select>
      <p className="mt-2 text-xs leading-5 text-ink/55">Định lượng công thức sẽ được điều chỉnh theo số người ăn.</p>
    </div>
  )
}
