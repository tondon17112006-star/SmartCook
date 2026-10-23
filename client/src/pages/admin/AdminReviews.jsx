import { useCallback, useState } from 'react'
import { Search, Star, Trash2 } from 'lucide-react'
import { listAdmin, deleteAdmin } from '../../services/adminService.js'
import useAdminData from '../../components/admin/useAdminData.js'
import useAdminMutation from '../../components/admin/useAdminMutation.js'
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx'
import DataTable from '../../components/admin/DataTable.jsx'
import { formatAdminDate } from '../../components/admin/adminValidation.js'
import Pagination from '../../components/Pagination.jsx'

async function recipeOptions(options) {
  const first = await listAdmin('recipes', { page: 1, limit: 100 }, options)
  const rows = [...first.data]
  for (let page = 2; page <= first.pagination.totalPages; page += 1) rows.push(...(await listAdmin('recipes', { page, limit: 100 }, options)).data)
  return rows
}
export default function AdminReviews() {
  const [query, setQuery] = useState({ search: '', recipeId: '', rating: '', page: 1, limit: 10 })
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(null), [success, setSuccess] = useState(null)
  const load = useCallback((options) => listAdmin('reviews', { ...query, search: query.search || undefined, recipeId: query.recipeId || undefined, rating: query.rating || undefined }, options), [query])
  const loadRecipes = useCallback((options) => recipeOptions(options), [])
  const { data, loading, error, reload } = useAdminData(load)
  const recipes = useAdminData(loadRecipes)
  const mutation = useAdminMutation()
  function remove() {
    void mutation.run((options) => deleteAdmin('reviews', selected.reviewId, options), () => {
      setSelected(null); setSuccess('Đã xóa đánh giá.')
      if (query.page > 1 && data.data.length === 1) setQuery({ ...query, page: query.page - 1 })
      else reload()
    })
  }
  const columns = [
    { key: 'recipeName', label: 'Món ăn', render: (row) => <span className="font-semibold text-dark-green">{row.recipeName}</span> },
    { key: 'fullName', label: 'Người đánh giá' },
    { key: 'rating', label: 'Số sao', render: (row) => <span className="inline-flex items-center gap-1 whitespace-nowrap"><Star size={15} className="fill-orange text-orange" aria-hidden="true" />{row.rating}/5</span> },
    { key: 'comment', label: 'Bình luận', render: (row) => <p className="max-w-md whitespace-pre-wrap break-words leading-6">{row.comment || 'Chưa có bình luận'}</p> },
    { key: 'createdAt', label: 'Ngày tạo', render: (row) => formatAdminDate(row.createdAt) },
    { key: 'actions', label: 'Thao tác', render: (row) => <button type="button" disabled={mutation.pending} className="rounded-lg p-2 text-red-800 hover:bg-red-50 disabled:opacity-40" aria-label={`Xóa đánh giá của ${row.fullName} về ${row.recipeName}`} onClick={() => { mutation.reset(); setSuccess(null); setSelected(row) }}><Trash2 size={18} aria-hidden="true" /></button> },
  ]
  return <div className="space-y-6"><p className="text-sm leading-7 text-ink/65">Theo dõi phản hồi của cộng đồng và xóa đánh giá vi phạm sau khi xác nhận.</p>{success && <p role="status" className="rounded-xl bg-forest/8 p-4 text-sm font-semibold text-forest">{success}</p>}<form role="search" className="surface-card flex flex-wrap items-end gap-3 p-4" onSubmit={(event) => { event.preventDefault(); setQuery({ ...query, search: search.trim(), page: 1 }) }}><div className="min-w-0 flex-1 basis-48"><label htmlFor="admin-reviews-search" className="mb-2 block text-sm font-semibold text-dark-green">Tìm đánh giá</label><input id="admin-reviews-search" name="search" type="search" maxLength={150} className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên món, người đánh giá, bình luận" /></div><div className="min-w-0 flex-1 basis-44"><label htmlFor="admin-reviews-recipe" className="mb-2 block text-sm font-semibold text-dark-green">Món ăn</label><select id="admin-reviews-recipe" className="field" value={query.recipeId} disabled={recipes.loading} onChange={(event) => setQuery({ ...query, recipeId: event.target.value, page: 1 })}><option value="">Tất cả món ăn</option>{recipes.data?.map((row) => <option key={row.recipeId} value={row.recipeId}>{row.recipeName}</option>)}</select>{recipes.error && <p role="alert" className="mt-2 text-xs text-red-800">Chưa tải được bộ lọc món. <button type="button" onClick={recipes.reload} className="underline">Tải lại bộ lọc</button></p>}</div><div className="basis-32"><label htmlFor="admin-reviews-rating" className="mb-2 block text-sm font-semibold text-dark-green">Số sao</label><select id="admin-reviews-rating" className="field" value={query.rating} onChange={(event) => setQuery({ ...query, rating: event.target.value, page: 1 })}><option value="">Tất cả</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}</select></div><button type="submit" className="button-primary"><Search size={17} aria-hidden="true" />Tìm kiếm</button></form><DataTable columns={columns} rows={data?.data} rowKey="reviewId" caption="Danh sách đánh giá" loading={loading} error={error} onRetry={reload} emptyTitle="Chưa có đánh giá phù hợp" />{!loading && !error && <div><p className="text-sm text-ink/60">Tổng cộng {data.pagination.total} đánh giá</p><Pagination pagination={data.pagination} onPageChange={(page) => setQuery({ ...query, page })} label="Phân trang đánh giá" /></div>}{selected && <ConfirmDialog title="Xóa đánh giá?" description={`Xóa đánh giá của ${selected.fullName} về “${selected.recipeName}”? Thao tác này không thể hoàn tác.`} pending={mutation.pending} error={mutation.error} onCancel={() => { setSelected(null); mutation.reset() }} onConfirm={remove} />}</div>
}
