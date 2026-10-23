import { useCallback, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { listAdmin, createAdmin, updateAdmin, deleteAdmin } from '../../services/adminService.js'
import useAdminData from './useAdminData.js'
import useAdminMutation from './useAdminMutation.js'
import AdminDialog from './AdminDialog.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import AdminFormField from './AdminFormField.jsx'
import DataTable from './DataTable.jsx'
import Pagination from '../Pagination.jsx'
import { isAdminImageUrl } from './adminValidation.js'

function CatalogForm({ fields, item, pending, error, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map((field) => [field.name, item?.[field.name] ?? ''])))
  const [errors, setErrors] = useState({})
  const form = useRef(null)
  function submit(event) {
    event.preventDefault()
    if (pending) return
    const cleaned = Object.fromEntries(fields.map((field) => [field.name, draft[field.name].trim()]))
    const next = {}
    for (const field of fields) {
      const value = cleaned[field.name]
      if (field.required && !value) next[field.name] = `Vui lòng nhập ${field.label.toLocaleLowerCase('vi-VN')}.`
      else if (value.length > field.maxLength) next[field.name] = `Tối đa ${field.maxLength} ký tự.`
      else if (field.name === 'imageUrl' && !isAdminImageUrl(value)) next[field.name] = 'Dùng URL http/https hoặc đường dẫn bắt đầu bằng /.'
    }
    setErrors(next)
    if (Object.keys(next).length) { form.current.elements.namedItem(Object.keys(next)[0])?.focus(); return }
    for (const field of fields) if (!field.required && !cleaned[field.name]) cleaned[field.name] = null
    onSubmit(cleaned)
  }
  return <form ref={form} onSubmit={submit} noValidate className="space-y-4">
    <p className="text-xs text-ink/55">Dấu * là thông tin bắt buộc. Ảnh sử dụng URL; chưa hỗ trợ tải tệp.</p>
    {fields.map((field) => <AdminFormField key={field.name} {...field} error={errors[field.name]} disabled={pending} value={draft[field.name]} onChange={(event) => { setDraft({ ...draft, [field.name]: event.target.value }); setErrors({ ...errors, [field.name]: undefined }) }} />)}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3 pt-3"><button type="button" disabled={pending} className="button-secondary" onClick={onCancel}>Hủy</button><button type="submit" disabled={pending} className="button-primary">{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
  </form>
}

export default function AdminCatalog({ resource, singular, plural, idField, nameField, fields, columns, description, deleteDescription, groupFilter = false }) {
  const [query, setQuery] = useState({ search: '', ingredientCategory: '', page: 1, limit: 10 })
  const [search, setSearch] = useState(''), [group, setGroup] = useState('')
  const [editing, setEditing] = useState(null), [deleting, setDeleting] = useState(null), [success, setSuccess] = useState(null)
  const mutation = useAdminMutation()
  const load = useCallback((options) => listAdmin(resource, { search: query.search || undefined, ingredientCategory: groupFilter ? query.ingredientCategory || undefined : undefined, page: query.page, limit: query.limit }, options), [resource, groupFilter, query])
  const { data, loading, error, reload } = useAdminData(load)
  function open(item) { mutation.reset(); setSuccess(null); setEditing(item || {}) }
  function close() { if (!mutation.pending) { setEditing(null); mutation.reset() } }
  function save(payload) {
    const isEdit = Boolean(editing[idField])
    void mutation.run((options) => isEdit ? updateAdmin(resource, editing[idField], payload, options) : createAdmin(resource, payload, options), () => {
      setEditing(null); setSuccess(isEdit ? `Đã cập nhật ${singular}.` : `Đã thêm ${singular}.`)
      if (!isEdit && query.page !== 1) setQuery({ ...query, page: 1 })
      else reload()
    })
  }
  function remove() {
    void mutation.run((options) => deleteAdmin(resource, deleting[idField], options), () => {
      setDeleting(null); setSuccess(`Đã xóa ${singular}.`)
      if (query.page > 1 && data.data.length === 1) setQuery({ ...query, page: query.page - 1 })
      else reload()
    })
  }
  const tableColumns = [...columns, { key: 'actions', label: 'Thao tác', render: (row) => <div className="flex gap-2"><button type="button" className="rounded-lg p-2 text-forest hover:bg-forest/8 disabled:opacity-40" disabled={mutation.pending} aria-label={`Sửa ${row[nameField]}`} onClick={() => open(row)}><Pencil size={18} aria-hidden="true" /></button><button type="button" className="rounded-lg p-2 text-red-800 hover:bg-red-50 disabled:opacity-40" disabled={mutation.pending} aria-label={`Xóa ${row[nameField]}`} onClick={() => { mutation.reset(); setSuccess(null); setDeleting(row) }}><Trash2 size={18} aria-hidden="true" /></button></div> }]
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-2xl text-sm leading-7 text-ink/65">{description}</p><button type="button" className="button-primary" disabled={mutation.pending} onClick={() => open()}><Plus size={18} aria-hidden="true" />Thêm {singular}</button></div>
    {success && <p role="status" className="rounded-xl bg-forest/8 p-4 text-sm font-semibold text-forest">{success}</p>}
    <form role="search" className="surface-card flex flex-wrap items-end gap-3 p-4" onSubmit={(event) => { event.preventDefault(); setSuccess(null); setQuery({ ...query, search: search.trim(), ingredientCategory: group.trim(), page: 1 }) }}><div className="min-w-0 flex-1 basis-52"><label htmlFor={`search-${resource}`} className="mb-2 block text-sm font-semibold text-dark-green">Tìm {singular}</label><input id={`search-${resource}`} name="search" type="search" maxLength={150} className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Nhập tên ${singular}`} /></div>{groupFilter && <div className="min-w-0 flex-1 basis-40"><label htmlFor="filter-ingredientCategory" className="mb-2 block text-sm font-semibold text-dark-green">Nhóm nguyên liệu</label><input id="filter-ingredientCategory" name="ingredientCategory" className="field" maxLength={100} value={group} onChange={(event) => setGroup(event.target.value)} placeholder="Tất cả nhóm" /></div>}<button type="submit" className="button-primary"><Search size={17} aria-hidden="true" />Tìm kiếm</button>{(query.search || query.ingredientCategory) && <button type="button" className="button-secondary" onClick={() => { setSearch(''); setGroup(''); setQuery({ ...query, search: '', ingredientCategory: '', page: 1 }) }}>Xóa bộ lọc</button>}</form>
    <DataTable columns={tableColumns} rows={data?.data} rowKey={idField} caption={`Danh sách ${plural}`} loading={loading} error={error} onRetry={reload} emptyTitle={`Chưa có ${singular} phù hợp`} />
    {!loading && !error && <div><p className="text-sm text-ink/60">Tổng cộng {data.pagination.total} {singular}</p><Pagination pagination={data.pagination} onPageChange={(page) => setQuery({ ...query, page })} label={`Phân trang ${plural}`} /></div>}
    {editing && <AdminDialog title={`${editing[idField] ? 'Chỉnh sửa' : 'Thêm'} ${singular}`} onClose={close} pending={mutation.pending}><CatalogForm key={editing[idField] || 'new'} fields={fields} item={editing} pending={mutation.pending} error={mutation.error} onSubmit={save} onCancel={close} /></AdminDialog>}
    {deleting && <ConfirmDialog title={`Xóa ${deleting[nameField]}?`} description={deleteDescription} pending={mutation.pending} error={mutation.error} onCancel={() => { setDeleting(null); mutation.reset() }} onConfirm={remove} />}
  </div>
}
