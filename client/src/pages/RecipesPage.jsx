import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import SearchBar from '../components/SearchBar'
import Pagination from '../components/Pagination'
import RecipeSkeleton from '../components/RecipeSkeleton'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import useApiResource from '../hooks/useApiResource'
import { getCategories, getRecipes } from '../services/catalogService'
import {
  createRecipeSearchParams,
  readRecipeFilters,
  RECIPE_DIFFICULTIES,
  RECIPE_SORT_OPTIONS,
  toRecipeApiParams,
} from '../utilities/recipeFilters'

const TIME_OPTIONS = [15, 30, 45, 60, 90, 120]

function RecipeSearch({ search, onSearch }) {
  const [draft, setDraft] = useState(search)
  return (
    <SearchBar
      value={draft}
      onChange={setDraft}
      onSubmit={() => onSearch(draft)}
      placeholder="Bạn muốn nấu món gì? Ví dụ: trứng, canh chua…"
    />
  )
}

export default function RecipesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawQuery = searchParams.toString()
  const filters = useMemo(() => readRecipeFilters(rawQuery), [rawQuery])
  const canonicalQuery = createRecipeSearchParams(filters).toString()

  useEffect(() => {
    if (rawQuery !== canonicalQuery) {
      setSearchParams(canonicalQuery, { replace: true })
    }
  }, [rawQuery, canonicalQuery, setSearchParams])

  const categories = useApiResource((signal) => getCategories({ signal }), [])
  const recipes = useApiResource(
    (signal) => getRecipes(toRecipeApiParams(filters), { signal }),
    [canonicalQuery],
  )

  const categoryList = categories.data?.data ?? []
  const recipeList = recipes.data?.data ?? []
  const pagination = recipes.data?.pagination
  const hasFilters = Boolean(filters.search || filters.categoryId || filters.maxTime || filters.difficulty)
  const selectedCategory = categoryList.find((category) => String(category.categoryId) === filters.categoryId)
  const hasCustomTime = filters.maxTime && !TIME_OPTIONS.includes(Number(filters.maxTime))

  function updateFilters(changes) {
    setSearchParams(createRecipeSearchParams({ ...filters, ...changes, page: 1 }))
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams())
  }

  function changePage(page) {
    setSearchParams(createRecipeSearchParams({ ...filters, page }))
    document.getElementById('recipe-results')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <>
      <section className="border-b border-forest/10 bg-cream py-10 sm:py-14">
        <div className="container-shell">
          <p className="eyebrow">Cảm hứng cho căn bếp</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-dark-green sm:text-5xl">
            Khám phá món ngon mỗi ngày
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-ink/65">
            Từ bữa cơm quen thuộc đến một hương vị mới. Tìm công thức phù hợp với thời gian và sở thích của bạn.
          </p>
          <div className="mt-7 max-w-2xl">
            <RecipeSearch
              key={canonicalQuery}
              search={filters.search}
              onSearch={(search) => updateFilters({ search })}
            />
          </div>
        </div>
      </section>

      <section className="container-shell py-8 sm:py-10" aria-label="Tìm và lọc công thức">
        <div className="rounded-2xl border border-forest/10 bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-dark-green">
              <SlidersHorizontal size={17} aria-hidden="true" /> Lọc theo sở thích
            </h2>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline">
                <X size={15} aria-hidden="true" /> Xóa bộ lọc
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium text-ink" htmlFor="recipe-category">
              Danh mục
              <select id="recipe-category" className="field w-full" value={filters.categoryId} onChange={(event) => updateFilters({ categoryId: event.target.value })}>
                <option value="">Tất cả danh mục</option>
                {filters.categoryId && !selectedCategory && (
                  <option value={filters.categoryId}>Danh mục đã chọn (#{filters.categoryId})</option>
                )}
                {categoryList.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink" htmlFor="recipe-time">
              Thời gian nấu
              <select id="recipe-time" className="field w-full" value={filters.maxTime} onChange={(event) => updateFilters({ maxTime: event.target.value })}>
                <option value="">Không giới hạn</option>
                {hasCustomTime && <option value={filters.maxTime}>Tối đa {filters.maxTime} phút</option>}
                {TIME_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>Tối đa {minutes} phút</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink sm:col-span-2 lg:col-span-1" htmlFor="recipe-difficulty">
              Độ khó
              <select id="recipe-difficulty" className="field w-full" value={filters.difficulty} onChange={(event) => updateFilters({ difficulty: event.target.value })}>
                <option value="">Tất cả mức độ</option>
                {RECIPE_DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
              </select>
            </label>
          </div>
          {categories.loading && <p className="mt-3 text-xs text-ink/55" role="status">Đang tải danh mục…</p>}
          {categories.error && (
            <p className="mt-3 text-sm text-ink/65" role="alert">
              Chưa tải được danh mục. Bạn vẫn có thể tìm theo tên và các bộ lọc khác.{' '}
              <button type="button" className="font-semibold text-forest underline underline-offset-4" onClick={categories.retry}>Thử lại</button>
            </p>
          )}
        </div>

        <div id="recipe-results" className="scroll-mt-28 pt-9">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div aria-live="polite" aria-atomic="true" className="min-w-0">
              <h2 className="text-xl font-bold text-dark-green [overflow-wrap:anywhere]">{filters.search ? `Kết quả cho “${filters.search}”` : 'Những công thức dành cho bạn'}</h2>
              <p className="mt-1 text-sm text-ink/60">
                {recipes.loading
                  ? 'Đang tìm công thức phù hợp…'
                  : recipes.error
                    ? 'Hãy thử kết nối lại để xem các công thức.'
                    : `${pagination?.total ?? 0} công thức${selectedCategory ? ` · ${selectedCategory.categoryName}` : ''}`}
              </p>
            </div>
            <label className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-ink/65" htmlFor="recipe-sort">
              Sắp xếp
              <select id="recipe-sort" className="field max-w-full sm:w-auto" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value })}>
                {RECIPE_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          {recipes.loading ? (
            <RecipeSkeleton count={8} />
          ) : recipes.error ? (
            <ErrorState title="Chưa thể tải công thức" error={recipes.error} onRetry={recipes.retry} />
          ) : recipeList.length === 0 ? (
            <EmptyState
              title={pagination?.total > 0 ? 'Trang này chưa có công thức' : 'Chưa tìm thấy món phù hợp'}
              description={pagination?.total > 0
                ? 'Số trang trên đường dẫn vượt quá kết quả hiện có. Hãy quay về trang đầu để tiếp tục khám phá.'
                : 'Thử một tên món khác hoặc bớt điều kiện lọc để khám phá thêm nhiều công thức.'}
              action={pagination?.total > 0
                ? <button type="button" className="button-primary" onClick={() => changePage(1)}>Về trang đầu</button>
                : <button type="button" className="button-primary" onClick={resetFilters}>Xóa bộ lọc</button>}
            />
          ) : (
            <>
              <div className="recipe-grid">
                {recipeList.map((recipe) => <RecipeCard key={recipe.recipeId} recipe={recipe} />)}
              </div>
              <Pagination pagination={pagination} onPageChange={changePage} />
            </>
          )}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-2xl bg-cream p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-lg font-bold text-dark-green">Có nguyên liệu, chưa có ý tưởng?</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-ink/65">Ghé căn bếp SmartCook để tìm hiểu tính năng gợi ý món từ nguyên liệu.</p>
          </div>
          <Link to="/ingredients" className="button-secondary shrink-0">Tìm món từ nguyên liệu <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  )
}
