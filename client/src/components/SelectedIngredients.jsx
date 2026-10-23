import { ArrowRight, ShoppingBasket, X } from 'lucide-react'
import ServingsSelector from './ServingsSelector'

export default function SelectedIngredients({ ingredients, servings, onRemove, onClear, onServingsChange, onFind, disabled = false, loading = false }) {
  const count = ingredients.length

  return (
    <section id="nguyen-lieu-cua-ban" className="surface-card scroll-mt-28 p-5 sm:p-6" aria-labelledby="selected-ingredients-heading">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest"><ShoppingBasket size={22} strokeWidth={1.7} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id="selected-ingredients-heading" className="font-bold text-dark-green">Nguyên liệu của bạn</h2>
          <p className="mt-0.5 text-xs text-ink/55" aria-live="polite" aria-atomic="true">Đã chọn {count} nguyên liệu</p>
        </div>
      </div>

      {count > 0 ? (
        <>
          <ul className="flex max-h-52 flex-wrap gap-2 overflow-y-auto p-1" aria-label="Nguyên liệu đã chọn">
            {ingredients.map((ingredient) => (
              <li key={ingredient.ingredientId} className="flex max-w-full items-center rounded-lg border border-forest/15 bg-forest/5 pl-3 text-sm text-dark-green">
                <span className="min-w-0 py-1.5 [overflow-wrap:anywhere]">{ingredient.ingredientName}</span>
                <button type="button" onClick={() => onRemove(ingredient.ingredientId)} disabled={loading} className="m-0.5 flex size-9 shrink-0 items-center justify-center rounded-md text-forest/70 hover:bg-forest/10 hover:text-dark-green disabled:opacity-50" aria-label={`Bỏ chọn ${ingredient.ingredientName}`}>
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onClear} disabled={loading} className="mt-2 min-h-11 text-xs font-semibold text-forest underline-offset-4 hover:underline disabled:opacity-50">Xóa tất cả</button>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-forest/20 bg-cream px-4 py-5 text-sm leading-6 text-ink/60">Chọn những nguyên liệu bạn đang có để bắt đầu khám phá món ngon.</p>
      )}

      <div className="mt-5 border-t border-stone-100 pt-5">
        <ServingsSelector value={servings} onChange={onServingsChange} disabled={loading} />
        <button type="button" onClick={onFind} disabled={count === 0 || disabled} className="button-primary mt-5 w-full px-4">
          Tìm món ăn phù hợp <ArrowRight size={17} aria-hidden="true" className="shrink-0" />
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-ink/55">{count === 0 ? 'Chọn ít nhất 1 nguyên liệu để tìm món.' : 'Gợi ý dựa trên loại nguyên liệu, chưa kiểm tra lượng đang có.'}</p>
      </div>
    </section>
  )
}
