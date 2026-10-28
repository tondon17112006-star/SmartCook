import { useEffect, useId, useState } from 'react'
import AdminDialog from '../admin/AdminDialog.jsx'
import RecipeImage from '../RecipeImage.jsx'
import Pagination from '../Pagination.jsx'
import ErrorState from '../ErrorState.jsx'
import useAuth from '../../hooks/useAuth.js'
import { getCategories, getRecipes } from '../../services/catalogService.js'
import { getFavorites } from '../../services/favoriteService.js'
import { addMealPlanItem } from '../../services/mealPlannerService.js'
import { todayInVietnam } from '../../utilities/mealPlannerDates.js'
import MealFields from './MealFields.jsx'
import { validateMealFields } from '../../utilities/mealPlanner.js'
import useMealMutation from './useMealMutation.js'

function AddMealBody({ recipe, initialServings, mealDate = todayInVietnam(), mealType = 'Lunch', onClose, onSaved }) {
  const id = useId()
  const [values, setValues] = useState({ mealDate, mealType, servings: initialServings ?? (recipe?.servings <= 20 ? recipe.servings : 2) ?? 2 })
  const [selected, setSelected] = useState(recipe || null)
  const [draft, setDraft] = useState(''), [search, setSearch] = useState(''), [categoryId, setCategoryId] = useState(''), [source, setSource] = useState('all'), [page, setPage] = useState(1), [retry, setRetry] = useState(0)
  const [catalog, setCatalog] = useState({ data: [], loading: true, error: null })
  const [categories, setCategories] = useState([]), [categoriesError, setCategoriesError] = useState(false), [categoryRetry, setCategoryRetry] = useState(0)
  const { pending, error, setError, run } = useMealMutation()
  useEffect(() => {
    if (recipe) return undefined
    const controller = new AbortController(); let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setCatalog({ data: [], loading: true, error: null })
      try {
        const result = source === 'favorites' ? await getFavorites({ page, limit: 6, signal: controller.signal }) : await getRecipes({ page, limit: 6, search: search || undefined, categoryId: categoryId || undefined }, { signal: controller.signal })
        if (active) setCatalog({ ...result, loading: false, error: null })
      } catch (failure) { if (active && !controller.signal.aborted) setCatalog({ data: [], loading: false, error: failure }) }
    })
    return () => { active = false; controller.abort() }
  }, [recipe, source, page, search, categoryId, retry])
  useEffect(() => {
    if (recipe) return undefined
    const controller = new AbortController(); let active = true
    getCategories({ signal: controller.signal }).then((result) => { if (active) { setCategories(result.data); setCategoriesError(false) } }).catch(() => { if (active) setCategoriesError(true) })
    return () => { active = false; controller.abort() }
  }, [recipe, categoryRetry])
  function submit(event) {
    event.preventDefault()
    const failure = validateMealFields(values) || (!selected ? 'Chọn một công thức để thêm vào lịch.' : null)
    if (failure) { setError(failure); return }
    void run((options) => addMealPlanItem({ mealDate: values.mealDate, mealType: values.mealType, recipeId: selected.recipeId, servings: Number(values.servings) }, options), onSaved)
  }
  function select(item) {
    setSelected(item); setError(null)
    if (!initialServings && !selected) setValues((previous) => ({ ...previous, servings: Number.isInteger(item.servings) && item.servings >= 1 && item.servings <= 20 ? item.servings : previous.servings }))
  }
  return <AdminDialog title="Thêm món vào thực đơn" description="Chọn công thức, ngày nấu và số người ăn. Lịch được lưu riêng theo tài khoản." onClose={onClose} pending={pending}>
    {!recipe && <div className="mb-6 space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Nguồn công thức"><button type="button" className={source === 'all' ? 'button-primary' : 'button-secondary'} aria-pressed={source === 'all'} disabled={pending} onClick={() => { setSource('all'); setPage(1) }}>Tất cả công thức</button><button type="button" className={source === 'favorites' ? 'button-primary' : 'button-secondary'} aria-pressed={source === 'favorites'} disabled={pending} onClick={() => { setSource('favorites'); setPage(1) }}>Món yêu thích</button></div>
      {source === 'all' && <form onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); setPage(1) }} className="grid gap-3">
        <label htmlFor={`${id}-search`} className="grid gap-2 text-sm font-semibold">Tìm công thức<input data-autofocus id={`${id}-search`} type="search" name="search" maxLength={100} className="field" value={draft} disabled={pending} onChange={(event) => setDraft(event.target.value)} /></label>
        <div className="flex flex-wrap items-end gap-3"><label htmlFor={`${id}-category`} className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">Danh mục<select id={`${id}-category`} className="field" value={categoryId} disabled={pending} onChange={(event) => { setCategoryId(event.target.value); setPage(1) }}><option value="">Tất cả danh mục</option>{categories.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.categoryName}</option>)}</select></label><button type="submit" disabled={pending} className="button-secondary">Tìm món</button></div>
        {categoriesError && <p role="alert" className="text-sm text-red-800">Chưa tải được danh mục. <button type="button" className="underline" onClick={() => setCategoryRetry((value) => value + 1)}>Tải lại danh mục</button></p>}
      </form>}
      {catalog.loading ? <p role="status">Đang tải công thức…</p> : catalog.error ? <ErrorState title="Chưa thể tải công thức" error={catalog.error} onRetry={() => setRetry((value) => value + 1)} /> : catalog.data.length === 0 ? <p role="status" className="rounded-xl bg-cream p-4">{source === 'favorites' ? 'Bạn chưa lưu món yêu thích nào ở trang này.' : 'Không tìm thấy công thức. Bạn thử từ khóa khác nhé.'}</p> : <>
        <div className="grid gap-2" role="group" aria-label="Chọn công thức">{catalog.data.map((item) => <button key={item.recipeId} type="button" aria-pressed={selected?.recipeId === item.recipeId} disabled={pending} className={`flex min-w-0 items-center gap-3 rounded-xl border p-2 text-left ${selected?.recipeId === item.recipeId ? 'border-forest bg-forest/8' : 'border-forest/15 bg-white'}`} onClick={() => select(item)}><RecipeImage src={item.imageUrl} alt={item.recipeName} className="size-14 shrink-0 rounded-lg" /><span className="min-w-0"><span className="block font-semibold [overflow-wrap:anywhere]">{item.recipeName}</span><span className="text-xs text-ink/65">{item.totalTime ?? item.prepTime + item.cookTime} phút{selected?.recipeId === item.recipeId ? ' · Đã chọn' : ''}</span></span></button>)}</div>
        <Pagination pagination={catalog.pagination} onPageChange={setPage} label="Phân trang chọn công thức" />
      </>}
    </div>}
    {selected && <p className="mb-5 rounded-xl bg-cream p-3 text-sm">Món đã chọn: <strong>{selected.recipeName}</strong></p>}
    <form onSubmit={submit} noValidate className="space-y-5">
      <MealFields values={values} onChange={setValues} pending={pending} />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={pending} className="button-secondary" onClick={onClose}>Hủy</button><button type="submit" className="button-primary" disabled={pending || !selected}>{pending ? 'Đang thêm…' : 'Thêm vào lịch'}</button></div>
    </form>
  </AdminDialog>
}
export default function AddMealDialog(props) {
  const { currentUser, isAuthenticated, sessionGeneration } = useAuth()
  if (!isAuthenticated || !currentUser) return null
  return <AddMealBody key={`${currentUser.userId}:${sessionGeneration}`} {...props} />
}
