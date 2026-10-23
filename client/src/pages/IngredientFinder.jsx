import { useMemo, useState } from 'react'
import { ArrowDown, CircleAlert, SlidersHorizontal, Sprout, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import IngredientCard from '../components/IngredientCard'
import IngredientSearch from '../components/IngredientSearch'
import SelectedIngredients from '../components/SelectedIngredients'
import usePantry from '../hooks/usePantry'
import { filterIngredients } from '../utilities/ingredientFilters'

function IngredientSkeleton() {
  return (
    <div role="status" aria-label="Đang tải danh sách nguyên liệu">
      <p className="sr-only">Đang tải danh sách nguyên liệu…</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border-2 border-stone-100 motion-safe:animate-pulse">
            <div className="aspect-[1.7] bg-stone-100" />
            <div className="space-y-3 p-4"><div className="h-4 w-3/4 rounded bg-stone-100" /><div className="h-3 w-1/2 rounded bg-stone-100" /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IngredientFinder() {
  const pantry = usePantry()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const activeGroup = pantry.groups.includes(group) ? group : ''
  const selectedSet = useMemo(() => new Set(pantry.selectedIds), [pantry.selectedIds])
  const visibleIngredients = useMemo(() => filterIngredients(pantry.catalog, { search, group: activeGroup }), [pantry.catalog, search, activeGroup])
  const hasFilters = Boolean(search.trim() || activeGroup)

  function resetFilters() {
    setSearch('')
    setGroup('')
  }

  function findRecipes() {
    if (pantry.isReady && pantry.selectedIds.length > 0) navigate('/suggestions')
  }

  return (
    <>
      <section className="border-b border-forest/10 bg-cream py-10 sm:py-14">
        <div className="container-shell">
          <p className="eyebrow flex items-center gap-2"><Sprout size={16} aria-hidden="true" /> Bữa ngon từ căn bếp của bạn</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-dark-green sm:text-5xl">Trong bếp bạn có gì?</h1>
          <p className="mt-4 max-w-2xl leading-7 text-ink/65">Chọn những nguyên liệu bạn đang có, SmartCook sẽ giúp bạn tìm ra các món ăn phù hợp.</p>
        </div>
      </section>

      <div className="container-shell py-8 sm:py-10">
        {pantry.selectionNotice && (
          <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-orange/30 bg-cream p-4 text-sm leading-6 text-ink/75">
            <CircleAlert size={19} className="mt-0.5 shrink-0 text-[#A35720]" aria-hidden="true" />
            <p className="min-w-0 flex-1">{pantry.selectionNotice}</p>
            <button type="button" onClick={pantry.dismissNotice} aria-label="Đóng thông báo về nguyên liệu" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink/55 hover:bg-orange/10"><X size={17} aria-hidden="true" /></button>
          </div>
        )}

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
          <aside className="min-w-0 lg:order-last lg:sticky lg:top-28" aria-label="Tóm tắt nguyên liệu và tìm món">
            <SelectedIngredients ingredients={pantry.selectedIngredients} servings={pantry.servings} onRemove={pantry.removeIngredient} onClear={pantry.clearSelection} onServingsChange={pantry.setServings} onFind={findRecipes} disabled={!pantry.isReady} loading={pantry.loading} />
          </aside>
          <section className="min-w-0" aria-label="Lựa chọn nguyên liệu có sẵn">
            <IngredientSearch value={search} onChange={setSearch} disabled={!pantry.isReady} />
            <div className="mt-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark-green"><SlidersHorizontal size={16} aria-hidden="true" /> Nhóm nguyên liệu</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo nhóm nguyên liệu">
                <button type="button" onClick={() => setGroup('')} disabled={!pantry.isReady} aria-pressed={!activeGroup} className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${!activeGroup ? 'border-forest bg-forest text-white' : 'border-stone-200 bg-white text-ink/65 hover:border-forest'}`}>Tất cả</button>
                {pantry.groups.map((category) => (
                  <button type="button" key={category} onClick={() => setGroup(category)} disabled={!pantry.isReady} aria-pressed={activeGroup === category} className={`min-h-11 max-w-full rounded-full border px-4 py-2 text-left text-sm transition-colors [overflow-wrap:anywhere] disabled:opacity-50 ${activeGroup === category ? 'border-forest bg-forest text-white' : 'border-stone-200 bg-white text-ink/65 hover:border-forest'}`}>{category}</button>
                ))}
              </div>
            </div>

            <div className="my-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink/60" aria-live="polite" aria-atomic="true">{pantry.loading ? 'Đang mở tủ nguyên liệu…' : pantry.error ? 'Danh sách nguyên liệu chưa sẵn sàng.' : `${visibleIngredients.length} nguyên liệu${hasFilters ? ' phù hợp' : ' để bạn lựa chọn'}`}</p>
              {hasFilters && <button type="button" onClick={resetFilters} className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline"><X size={14} aria-hidden="true" />Xóa bộ lọc</button>}
              {pantry.selectedIds.length > 0 && <a href="#nguyen-lieu-cua-ban" className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline lg:hidden">Đã chọn {pantry.selectedIds.length} <ArrowDown size={15} className="rotate-180" aria-hidden="true" /></a>}
            </div>

            {pantry.loading ? <IngredientSkeleton /> : pantry.error ? (
              <ErrorState title="Chưa thể tải nguyên liệu" error={pantry.error} onRetry={pantry.retry} />
            ) : visibleIngredients.length === 0 ? (
              <EmptyState
                title={pantry.catalog.length === 0 ? 'Tủ nguyên liệu đang được cập nhật' : 'Chưa tìm thấy nguyên liệu này'}
                description={pantry.catalog.length === 0 ? 'Danh sách hiện chưa có nguyên liệu. Bạn thử tải lại sau một chút nhé.' : 'Thử từ khóa có dấu khác hoặc chọn nhóm “Tất cả” để tìm thêm nguyên liệu.'}
                action={pantry.catalog.length === 0 ? <button type="button" className="button-secondary" onClick={pantry.retry}>Tải lại nguyên liệu</button> : <button type="button" className="button-secondary" onClick={resetFilters}>Xóa bộ lọc</button>}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {visibleIngredients.map((ingredient) => <IngredientCard key={ingredient.ingredientId} ingredient={ingredient} selected={selectedSet.has(ingredient.ingredientId)} disabled={!pantry.isReady || (!selectedSet.has(ingredient.ingredientId) && pantry.selectedIds.length >= 100)} onToggle={pantry.toggleIngredient} />)}
              </div>
            )}
            {pantry.selectedIds.length >= 100 && <p className="mt-4 text-sm text-ink/65" role="status">Bạn đã chọn tối đa 100 nguyên liệu. Bỏ bớt một nguyên liệu để chọn loại khác.</p>}
          </section>

        </div>
      </div>
    </>
  )
}
