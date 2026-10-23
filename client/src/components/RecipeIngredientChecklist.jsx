import { Check, ListChecks } from 'lucide-react'
import ServingsSelector from './ServingsSelector'

const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 12 })

export default function RecipeIngredientChecklist({ ingredients, preparedIds, servings, preparedCount, canScale, scalingNotice, onToggleIngredient, onServingsChange }) {
  return (
    <section aria-labelledby="recipe-ingredients" className="surface-card rounded-3xl border border-forest/10 bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <ListChecks size={25} className="mt-1 shrink-0 text-forest" aria-hidden="true" />
        <h2 id="recipe-ingredients" className="text-2xl font-bold leading-snug text-dark-green">Nguyên liệu cần chuẩn bị</h2>
      </div>
      <div className="my-6 border-y border-forest/10 py-5">
        <ServingsSelector value={servings} onChange={onServingsChange} disabled={!canScale} variant="stepper" />
        {scalingNotice && <p role="status" className="mt-3 rounded-xl bg-orange/10 px-3 py-2 text-sm leading-6 text-ink/75">{scalingNotice}</p>}
      </div>
      {ingredients.length ? (
        <>
          <p aria-live="polite" className="flex items-center gap-2 text-sm font-semibold text-forest"><Check size={17} aria-hidden="true" />{preparedCount}/{ingredients.length} nguyên liệu đã chuẩn bị</p>
          <ul className="mt-3 divide-y divide-forest/10">
            {ingredients.map((ingredient) => {
              const checked = preparedIds.includes(ingredient.ingredientId)
              const quantity = Number.isFinite(ingredient.adjustedQuantity) && ingredient.adjustedQuantity > 0
                ? quantityFormat.format(ingredient.adjustedQuantity)
                : null
              return (
                <li key={ingredient.ingredientId} className="py-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={checked} onChange={() => onToggleIngredient(ingredient.ingredientId)} aria-label={`Đã chuẩn bị ${ingredient.ingredientName}`} className="mt-1 size-5 shrink-0 cursor-pointer accent-forest" />
                    <span className="min-w-0 flex-1">
                      <span className={`block break-words font-semibold leading-6 ${checked ? 'text-forest' : 'text-ink'}`}>{ingredient.ingredientName}</span>
                      <span className="mt-1 block font-semibold text-forest [overflow-wrap:anywhere]">{quantity ? `${quantity} ${ingredient.unit || ingredient.defaultUnit || ''}` : 'Định lượng chưa được cập nhật'}</span>
                      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-ink/60">
                        <span>{ingredient.isRequired ? 'Bắt buộc' : 'Tùy chọn'}</span>
                        {checked && <span className="inline-flex items-center gap-1 text-forest"><Check size={13} aria-hidden="true" />Đã chuẩn bị</span>}
                      </span>
                      {ingredient.notes && <span className="mt-2 block text-sm leading-6 text-ink/60 [overflow-wrap:anywhere]">{ingredient.notes}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      ) : <p className="text-sm leading-7 text-ink/65">Danh sách nguyên liệu đang được cập nhật. Bạn có thể xem các bước chế biến bên cạnh.</p>}
    </section>
  )
}
