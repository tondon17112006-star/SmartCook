import { Check, CirclePlus, Minus } from 'lucide-react'
import { useId } from 'react'

const quantityFormatter = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 12 })

export default function IngredientStatusList({ title, ingredients = [], kind, showNotes = false }) {
  const headingId = useId()
  const isMissing = kind === 'missing'
  const isOptional = kind === 'optional'
  const emptyMessage = isMissing
    ? 'Không thiếu loại bắt buộc nào'
    : isOptional
      ? 'Công thức không có nguyên liệu tùy chọn.'
      : 'Chưa chọn loại nguyên liệu bắt buộc nào của món này.'

  return (
    <section aria-labelledby={headingId}>
      <h4 id={headingId} className="mb-2.5 flex items-center gap-2 text-sm font-bold text-ink">
        <span className={`size-1.5 rounded-full ${isMissing ? 'bg-orange' : isOptional ? 'bg-stone-400' : 'bg-forest'}`} aria-hidden="true" />
        {title}
        <span className="text-xs font-medium text-ink/50">({ingredients.length})</span>
      </h4>
      {ingredients.length === 0 ? (
        <p className="text-sm leading-relaxed text-ink/60">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2.5" aria-label={title}>
          {ingredients.map((ingredient) => {
            const isAvailable = isOptional ? ingredient.isAvailable : !isMissing
            const StatusIcon = isAvailable ? Check : isOptional ? Minus : CirclePlus
            const quantity = Number.isFinite(ingredient.adjustedQuantity) && ingredient.adjustedQuantity > 0
              ? quantityFormatter.format(ingredient.adjustedQuantity)
              : '—'

            return (
              <li key={ingredient.ingredientId} className="flex items-start gap-2 text-sm leading-relaxed">
                <StatusIcon
                  size={15}
                  className={`mt-0.5 shrink-0 ${isAvailable ? 'text-forest' : isOptional ? 'text-ink/45' : 'text-amber-700'}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="break-words text-ink/80">{ingredient.ingredientName}</span>
                    <span className="text-xs font-medium tabular-nums text-ink/65">{quantity} {ingredient.unit}</span>
                  </div>
                  {isOptional && (
                    <p className={`text-xs ${isAvailable ? 'text-forest' : 'text-ink/55'}`}>
                      {isAvailable ? 'Đã chọn' : 'Chưa chọn'}
                    </p>
                  )}
                  {showNotes && ingredient.notes && <p className="mt-0.5 text-xs text-ink/55">{ingredient.notes}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
