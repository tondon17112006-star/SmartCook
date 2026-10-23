import { ArrowLeft, ChefHat, Clock3, CookingPot, Play, RotateCcw, Timer, UsersRound, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import CookingMode from '../components/CookingMode'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingSpinner from '../components/LoadingSpinner'
import RecipeImage from '../components/RecipeImage'
import RecipeIngredientChecklist from '../components/RecipeIngredientChecklist'
import RecipeSteps from '../components/RecipeSteps'
import RelatedRecipes from '../components/RelatedRecipes'
import FavoriteButton from '../components/FavoriteButton.jsx'
import ReviewList from '../components/ReviewList.jsx'
import useApiResource from '../hooks/useApiResource'
import useRecipeCooking from '../hooks/useRecipeCooking'
import { getRecipe } from '../services/catalogService'

function BackToRecipes() {
  return <Link to="/recipes" className="button-secondary"><ArrowLeft size={18} aria-hidden="true" />Khám phá món ăn</Link>
}

function RecipeContent({ recipeId }) {
  const { data: response, loading, error, retry } = useApiResource(
    (signal) => getRecipe(recipeId, { signal }),
    [recipeId],
  )

  if (loading) {
    return (
      <div className="container-shell flex min-h-[55vh] items-center justify-center py-20">
        <h1 className="sr-only">Công thức nấu ăn</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (error?.response?.status === 404) {
    return (
      <section className="container-shell py-16 sm:py-24">
        <h1 className="sr-only">Không tìm thấy món ăn</h1>
        <EmptyState title="Không tìm thấy món ăn" description="Công thức này chưa có trong căn bếp SmartCook. Bạn có thể khám phá những món ăn khác." action={<BackToRecipes />} />
      </section>
    )
  }

  if (error) {
    return (
      <section className="container-shell py-16 sm:py-24">
        <h1 className="sr-only">Chưa thể mở công thức</h1>
        <ErrorState title="Chưa thể mở công thức" error={error} onRetry={retry} />
        <div className="mt-6 flex justify-center"><BackToRecipes /></div>
      </section>
    )
  }

  const recipe = response?.data

  if (!recipe) {
    return (
      <section className="container-shell py-16 sm:py-24">
        <h1 className="sr-only">Công thức chưa có thông tin</h1>
        <EmptyState title="Công thức chưa có thông tin" description="Mời bạn quay lại danh sách để chọn một món ăn khác." action={<BackToRecipes />} />
      </section>
    )
  }

  return <DetailedRecipe recipe={recipe} />
}

function DetailedRecipe({ recipe }) {
  const location = useLocation()
  const entry = location.state
  const cameFromSuggestions = entry?.from === '/suggestions'
    && Number.isInteger(entry.recipeId) && entry.recipeId === recipe.recipeId
  const suggestedServings = cameFromSuggestions && Number.isInteger(entry.suggestedServings)
    && entry.suggestedServings >= 1 && entry.suggestedServings <= 20 ? entry.suggestedServings : undefined
  const cooking = useRecipeCooking(recipe, { suggestedServings, entryKey: location.key })
  const [isCooking, setIsCooking] = useState(false)
  const startButton = useRef(null)
  const categoryName = recipe.category?.categoryName ?? recipe.categoryName
  const facts = [
    { label: 'Chuẩn bị', value: `${recipe.prepTime} phút`, Icon: Timer },
    { label: 'Chế biến', value: `${recipe.cookTime} phút`, Icon: CookingPot },
    { label: 'Tổng thời gian', value: `${recipe.totalTime} phút`, Icon: Clock3 },
    { label: 'Khẩu phần gốc', value: Number.isInteger(recipe.servings) && recipe.servings > 0 ? `${recipe.servings} người` : 'Đang cập nhật', Icon: UsersRound },
  ]

  function exitCooking() {
    setIsCooking(false)
    // The focus target becomes available after the full recipe is rendered.
    window.requestAnimationFrame(() => startButton.current?.focus())
  }

  if (isCooking) {
    return (
      <article className="container-shell py-6 sm:py-10">
        <h1 className="sr-only">{recipe.recipeName}</h1>
        <CookingMode recipeName={recipe.recipeName} servings={cooking.servings} originalServings={recipe.servings} steps={cooking.steps} currentStepId={cooking.currentStepId} completedIds={cooking.completedIds} onSelectStep={cooking.setCurrentStep} onToggleStep={cooking.toggleStep} onExit={exitCooking} onRestart={cooking.reset} />
      </article>
    )
  }

  return (
    <article className="container-shell pb-16 pt-6 sm:pb-24 sm:pt-9">
      <nav aria-label="Đường dẫn trang" className="mb-7 flex flex-wrap items-center gap-2 text-sm text-ink/60">
        <Link to="/" className="transition-colors hover:text-forest">Trang chủ</Link>
        <span aria-hidden="true">›</span>
        <Link to="/recipes" className="transition-colors hover:text-forest">Khám phá món ăn</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page" className="text-ink">{recipe.recipeName}</span>
      </nav>

      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="overflow-hidden rounded-[2rem] border border-forest/10 bg-white">
          <RecipeImage src={recipe.imageUrl} alt={recipe.recipeName} className="aspect-[4/3] w-full object-cover" />
        </div>
        <div>
          {categoryName && (
            <Link to={recipe.category?.categoryId ? `/recipes?categoryId=${recipe.category.categoryId}` : '/recipes'} className="eyebrow inline-flex items-center gap-2 hover:underline">
              <CookingPot size={16} aria-hidden="true" />{categoryName}
            </Link>
          )}
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-dark-green sm:text-4xl lg:text-5xl">{recipe.recipeName}</h1>
          {recipe.description && <p className="mt-5 text-base leading-8 text-ink/70 sm:text-lg">{recipe.description}</p>}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest/10 px-4 py-2 text-sm font-semibold text-forest">
            <ChefHat size={18} aria-hidden="true" />Độ khó: {recipe.difficulty}
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-forest/15 pt-7">
            {facts.map(({ label, value, Icon }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-forest"><Icon size={20} aria-hidden="true" /></span>
                <div><dt className="text-sm text-ink/60">{label}</dt><dd className="mt-1 font-semibold text-dark-green">{value}</dd></div>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <FavoriteButton recipeId={recipe.recipeId} recipeName={recipe.recipeName} />
            <button ref={startButton} type="button" disabled={!cooking.steps.length} onClick={() => setIsCooking(true)} className="button-primary"><Play size={18} aria-hidden="true" />Bắt đầu nấu</button>
            <Link to={cameFromSuggestions ? '/suggestions' : '/recipes'} className="button-secondary"><ArrowLeft size={18} aria-hidden="true" />Quay lại</Link>
          </div>
          {!cooking.steps.length && <p className="mt-3 text-sm leading-6 text-ink/65">Hướng dẫn đang được cập nhật, bạn chưa thể bắt đầu chế độ nấu.</p>}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-forest/10 bg-white p-5">
        <p className="max-w-2xl text-sm leading-6 text-ink/65">Đánh dấu nguyên liệu và các bước để theo dõi buổi nấu. Tiến độ được giữ riêng cho món này trong phiên trình duyệt.</p>
        <button type="button" onClick={cooking.reset} className="button-ghost shrink-0"><RotateCcw size={16} aria-hidden="true" />Làm lại từ đầu</button>
      </div>
      {cooking.notice && <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-orange/30 bg-orange/10 p-4 text-sm leading-6 text-ink/75"><p>{cooking.notice}</p><button type="button" onClick={cooking.dismissNotice} aria-label="Ẩn thông báo tiến độ" className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-orange/15"><X size={18} aria-hidden="true" /></button></div>}
      {cooking.canScale && cooking.servings !== recipe.servings && <p role="status" className="mt-4 rounded-xl bg-cream p-4 text-sm leading-7 text-ink/75">Định lượng đã đổi cho {cooking.servings} người. Nội dung các bước giữ nguyên theo công thức gốc; hãy dùng lượng trong danh sách nguyên liệu.</p>}
      <div className="mt-9 grid items-start gap-9 lg:mt-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
        <RecipeIngredientChecklist ingredients={cooking.ingredients} preparedIds={cooking.preparedIds} servings={cooking.servings} preparedCount={cooking.preparedCount} canScale={cooking.canScale} scalingNotice={cooking.scalingNotice} onToggleIngredient={cooking.toggleIngredient} onServingsChange={cooking.setServings} />
        <RecipeSteps recipeName={recipe.recipeName} steps={cooking.steps} completedIds={cooking.completedIds} completedCount={cooking.completedCount} onToggleStep={cooking.toggleStep} />
      </div>
      <ReviewList recipeId={recipe.recipeId} />
      <RelatedRecipes recipe={recipe} />
    </article>
  )
}

export default function RecipeDetailPage() {
  const { id } = useParams()
  const isValidId = /^[1-9]\d*$/.test(id ?? '') && Number(id) <= 2147483647

  if (!isValidId) {
    return (
      <section className="container-shell py-16 sm:py-24">
        <h1 className="sr-only">Đường dẫn món ăn chưa hợp lệ</h1>
        <EmptyState title="Đường dẫn món ăn chưa hợp lệ" description="Mời bạn chọn một công thức từ danh sách món ăn để tiếp tục." action={<BackToRecipes />} />
      </section>
    )
  }

  return <RecipeContent key={id} recipeId={id} />
}
