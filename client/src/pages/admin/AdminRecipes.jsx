import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import Pagination from '../../components/Pagination.jsx'
import RecipeImage from '../../components/RecipeImage.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import useApiResource from '../../hooks/useApiResource.js'
import useAuth from '../../hooks/useAuth.js'
import { deleteAdmin, listAdmin } from '../../services/adminService.js'
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx'
import useAdminMutation from '../../components/admin/useAdminMutation.js'
import { loadAllAdminOptions } from './adminRecipeOptions.js'

const sorts = [['newest', 'Mới thêm'], ['name_asc', 'Tên A–Z'], ['name_desc', 'Tên Z–A'], ['time_asc', 'Thời gian tăng dần'], ['time_desc', 'Thời gian giảm dần']]

function formatCreatedAt(value) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : 'Chưa có thông tin'
}

function RecipeSearchForm({ search, onSearch }) {
  const [draft, setDraft] = useState(search)
  return <form className="flex min-w-0 gap-2" onSubmit={(event) => { event.preventDefault(); onSearch(draft.trim()) }} role="search" aria-label="Tìm công thức quản trị">
    <label className="sr-only" htmlFor="admin-recipes-search">Tìm tên món ăn</label><input id="admin-recipes-search" name="search" className="field min-w-0" maxLength={150} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Tìm tên món ăn…" />
    <button type="submit" aria-label="Tìm kiếm công thức" className="button-secondary px-3"><Search size={19} aria-hidden="true" /></button>
  </form>
}

export default function AdminRecipes() {
  const { sessionGeneration } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const categoryId = params.get('categoryId') ?? ''
  const sort = sorts.some(([value]) => value === params.get('sort')) ? params.get('sort') : 'newest'
  const page = /^\d+$/.test(params.get('page') ?? '') ? Math.max(1, Number(params.get('page'))) : 1
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  const [success, setSuccess] = useState(location.state?.recipeSaved ?? '')
  const mutation = useAdminMutation()
  const query = { search: search || undefined, categoryId: categoryId || undefined, sort, page, limit: 12 }
  const recipes = useApiResource((signal) => listAdmin('recipes', query, { signal }), [search, categoryId, sort, page, revision, sessionGeneration])
  const categories = useApiResource((signal) => loadAllAdminOptions('categories', signal), [sessionGeneration])

  function filter(changes) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries({ page: 1, ...changes })) {
      if (value && value !== 1 && !(key === 'sort' && value === 'newest')) next.set(key, String(value))
      else next.delete(key)
    }
    setParams(next)
  }

  function confirmDelete() {
    if (!selected) return
    setSuccess('')
    mutation.run((options) => deleteAdmin('recipes', selected.recipeId, options), () => {
      setSelected(null)
      setSuccess('Đã xóa món ăn.')
      setRevision((value) => value + 1)
    })
  }

  return (
    <section className="min-w-0 space-y-6" aria-labelledby="admin-recipes-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 id="admin-recipes-title" className="text-2xl font-bold text-dark-green">Quản lý công thức</h1><p className="mt-2 text-sm text-ink/65">Cập nhật món ăn, nguyên liệu và hướng dẫn nấu.</p></div>
        <Link to="/admin/recipes/new" className="button-primary"><Plus size={18} aria-hidden="true" />Thêm món ăn</Link>
      </div>
      <div className="surface-card grid gap-4 p-4 md:grid-cols-3">
        <RecipeSearchForm key={search} search={search} onSearch={(value) => filter({ search: value })} />
        <label className="grid gap-1 text-sm" htmlFor="admin-recipes-category">Danh mục<select id="admin-recipes-category" name="categoryId" className="field" value={categoryId} onChange={(event) => filter({ categoryId: event.target.value })}><option value="">Tất cả danh mục</option>{categories.data?.map((row) => <option key={row.categoryId} value={row.categoryId}>{row.categoryName}</option>)}</select></label>
        <label className="grid gap-1 text-sm" htmlFor="admin-recipes-sort">Sắp xếp<select id="admin-recipes-sort" name="sort" className="field" value={sort} onChange={(event) => filter({ sort: event.target.value })}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {categories.error && <p className="text-sm text-red-800" role="alert">Chưa tải được danh mục. <button type="button" className="underline" onClick={categories.retry}>Tải lại danh mục</button></p>}
      </div>
      {success && <p role="status" className="rounded-xl bg-forest/10 p-4 text-dark-green">{success}</p>}
      {recipes.loading ? <p role="status">Đang tải công thức…</p> : recipes.error ? <ErrorState error={recipes.error} onRetry={recipes.retry} /> : recipes.data.data.length === 0 ? <div className="surface-card p-8 text-center"><p>Chưa có công thức phù hợp.</p>{page > 1 && <button type="button" className="button-secondary mt-4" onClick={() => filter({ page: 1 })}>Về trang đầu</button>}</div> : <>
        <p className="text-sm text-ink/65">{recipes.data.pagination.total} món ăn</p>
        <div className="surface-card min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label="Danh sách công thức">
          <table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-cream text-dark-green"><tr>{['Món ăn', 'Danh mục', 'Thời gian', 'Khẩu phần', 'Độ khó', 'Ngày tạo', 'Thao tác'].map((title) => <th key={title} scope="col" className="px-4 py-4">{title}</th>)}</tr></thead>
            <tbody>{recipes.data.data.map((recipe) => <tr key={recipe.recipeId} className="border-t border-stone-100"><th scope="row" className="px-4 py-3"><div className="flex items-center gap-3"><RecipeImage src={recipe.imageUrl} alt={recipe.recipeName} className="size-16 shrink-0 rounded-lg" /><span className="max-w-64 break-words">{recipe.recipeName}</span></div></th><td className="px-4 py-3">{recipe.categoryName}</td><td className="px-4 py-3">{recipe.totalTime ?? recipe.prepTime + recipe.cookTime} phút</td><td className="px-4 py-3">{recipe.servings} người</td><td className="px-4 py-3">{recipe.difficulty}</td><td className="whitespace-nowrap px-4 py-3">{formatCreatedAt(recipe.createdAt)}</td><td className="px-4 py-3"><div className="flex gap-2"><Link to={`/admin/recipes/${recipe.recipeId}/edit`} className="button-ghost" aria-label={`Sửa ${recipe.recipeName}`}><Pencil size={18} aria-hidden="true" /></Link><button type="button" className="button-ghost text-red-700" aria-label={`Xóa ${recipe.recipeName}`} onClick={() => { setSelected(recipe); mutation.reset(); setSuccess('') }}><Trash2 size={18} aria-hidden="true" /></button></div></td></tr>)}</tbody>
          </table>
        </div>
        <Pagination pagination={recipes.data.pagination} onPageChange={(value) => filter({ page: value })} label="Phân trang công thức quản trị" />
      </>}
      {selected && <ConfirmDialog title="Xóa món ăn?" description={`Bạn có chắc muốn xóa “${selected.recipeName}”? Món đã có lượt yêu thích hoặc đánh giá sẽ được giữ lại.`} pending={mutation.pending} error={mutation.error} onCancel={() => setSelected(null)} onConfirm={confirmDelete} />}
    </section>
  )
}
