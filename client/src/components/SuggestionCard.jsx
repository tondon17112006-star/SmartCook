import { ArrowUpRight, ChartNoAxesColumnIncreasing, CheckCircle2, ChevronDown, Clock3, ShoppingBasket, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import IngredientStatusList from './IngredientStatusList'
import MatchProgress from './MatchProgress'
import RecipeImage from './RecipeImage'
import FavoriteButton from './FavoriteButton.jsx'

export default function SuggestionCard({ recipe }) {
  const detailState = { from: '/suggestions', recipeId: recipe.recipeId, suggestedServings: recipe.requestedServings ?? recipe.servings }
  const ready = recipe.status === 'ready'
  const StatusIcon = ready ? CheckCircle2 : ShoppingBasket
  const optionalIngredients = recipe.optionalIngredients ?? []

  return (
    <article className="surface-card relative flex h-full min-w-0 flex-col overflow-hidden">
      <Link to={`/recipes/${recipe.recipeId}`} state={detailState} className="group block" aria-label={`Xem công thức ${recipe.recipeName}`}>
        <RecipeImage src={recipe.imageUrl} alt={recipe.recipeName} className="aspect-[16/10] w-full" />
      </Link>
      <FavoriteButton recipeId={recipe.recipeId} recipeName={recipe.recipeName} className="absolute right-3 top-3 z-10 flex flex-col items-end" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {recipe.categoryName && <p className="mb-2 text-xs font-semibold text-forest">{recipe.categoryName}</p>}
        <h3 className="text-xl font-bold leading-snug text-dark-green">
          <Link to={`/recipes/${recipe.recipeId}`} state={detailState} className="transition-colors hover:text-forest">{recipe.recipeName}</Link>
        </h3>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink/65">
          <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{recipe.totalTime} phút</span>
          {recipe.difficulty && <span className="inline-flex items-center gap-1.5"><ChartNoAxesColumnIncreasing size={14} aria-hidden="true" />{recipe.difficulty}</span>}
          <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden="true" />{recipe.requestedServings ?? recipe.servings} khẩu phần</span>
        </div>

        <div className="mt-5">
          <MatchProgress percentage={recipe.matchPercentage} />
          <p className="mt-2 text-xs leading-relaxed text-ink/60">
            Đã chọn {recipe.matchedRequiredCount}/{recipe.totalRequiredCount} loại bắt buộc · Còn thiếu {recipe.missingRequiredCount} loại
          </p>
        </div>
        <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold leading-relaxed ${ready ? 'bg-forest/8 text-dark-green' : 'bg-orange/12 text-amber-900'}`}>
          <StatusIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{ready ? 'Đủ loại nguyên liệu chính' : `Cần thêm ${recipe.missingRequiredCount} loại nguyên liệu bắt buộc`}</span>
        </div>

        <div className="mt-5 space-y-5 border-t border-stone-100 pt-5">
          <IngredientStatusList title="Bạn đã có" ingredients={recipe.matchedIngredients} kind="matched" />
          <IngredientStatusList title="Bạn còn thiếu" ingredients={recipe.missingIngredients} kind="missing" />
        </div>

        {optionalIngredients.length > 0 && (
          <details className="group/optional mt-5 rounded-xl border border-stone-200/80 bg-stone-50/60">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-ink/75 [&::-webkit-details-marker]:hidden">
              <span>Gia vị / nguyên liệu tùy chọn ({optionalIngredients.length})</span>
              <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open/optional:rotate-180" />
            </summary>
            <div className="border-t border-stone-200/70 px-3 py-3">
              <IngredientStatusList title="Có thể thêm nếu bạn thích" ingredients={optionalIngredients} kind="optional" showNotes />
            </div>
          </details>
        )}

        <p className="mt-4 text-xs leading-relaxed text-ink/55">
          Định lượng cho {recipe.requestedServings ?? recipe.servings} khẩu phần. Hãy kiểm tra lượng nguyên liệu thực tế trong bếp.
        </p>
        <div className="mt-auto pt-5">
          <Link to={`/recipes/${recipe.recipeId}`} state={detailState} className="flex min-h-11 items-center justify-between gap-3 border-t border-stone-100 pt-4 text-sm font-semibold text-forest hover:text-dark-green">
            Xem công thức <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
