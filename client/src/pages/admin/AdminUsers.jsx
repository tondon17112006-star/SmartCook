import { useCallback, useState } from 'react'
import { Eye, Search } from 'lucide-react'
import { getAdmin, listAdmin } from '../../services/adminService.js'
import useAdminData from '../../components/admin/useAdminData.js'
import AdminDialog from '../../components/admin/AdminDialog.jsx'
import DataTable from '../../components/admin/DataTable.jsx'
import { formatAdminDate } from '../../components/admin/adminValidation.js'
import ErrorState from '../../components/ErrorState.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import Pagination from '../../components/Pagination.jsx'
import UserAvatar from '../../components/UserAvatar.jsx'

function UserDetail({ id, onClose }) {
  const load = useCallback((options) => getAdmin('users', id, options), [id])
  const { data, loading, error, reload } = useAdminData(load)
  return <AdminDialog title="Thông tin tài khoản" onClose={onClose}>{loading ? <LoadingSpinner /> : error ? <ErrorState error={error} onRetry={reload} /> : <><div className="mb-5 flex items-center gap-3"><UserAvatar user={data} /><p className="font-bold text-dark-green">{data.fullName}</p></div><dl className="space-y-4 text-sm">{[['Mã tài khoản', data.userId], ['Email', data.email], ['Số điện thoại', data.phone || 'Chưa cập nhật'], ['Vai trò', data.role], ['Ngày tạo', formatAdminDate(data.createdAt)]].map(([label, value]) => <div key={label} className="grid min-w-0 gap-1 border-b border-forest/8 pb-3 sm:grid-cols-[130px_minmax(0,1fr)]"><dt className="text-ink/60">{label}</dt><dd className="break-words font-medium text-ink">{value}</dd></div>)}</dl><p className="mt-5 text-xs leading-6 text-ink/55">Khu vực này chỉ hỗ trợ xem hồ sơ cơ bản.</p></>}</AdminDialog>
}
export default function AdminUsers() {
  const [query, setQuery] = useState({ search: '', role: '', page: 1, limit: 10 })
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(null)
  const load = useCallback((options) => listAdmin('users', { ...query, search: query.search || undefined, role: query.role || undefined }, options), [query])
  const { data, loading, error, reload } = useAdminData(load)
  const columns = [
    { key: 'fullName', label: 'Họ và tên', render: (row) => <div className="flex items-center gap-3"><UserAvatar user={row} /><span className="font-semibold text-dark-green">{row.fullName}</span></div> },
    { key: 'email', label: 'Email' }, { key: 'role', label: 'Vai trò' },
    { key: 'createdAt', label: 'Ngày tạo', render: (row) => formatAdminDate(row.createdAt) },
    { key: 'actions', label: 'Thao tác', render: (row) => <button type="button" className="button-ghost" aria-label={`Xem hồ sơ ${row.fullName}`} onClick={() => setSelected(row.userId)}><Eye size={18} aria-hidden="true" />Xem</button> },
  ]
  return <div className="space-y-6"><p className="text-sm leading-7 text-ink/65">Tra cứu tài khoản và hồ sơ cơ bản. Việc cấp quyền được thực hiện qua công cụ quản trị cục bộ theo quy trình riêng.</p><form role="search" className="surface-card flex flex-wrap items-end gap-3 p-4" onSubmit={(event) => { event.preventDefault(); setQuery({ ...query, search: search.trim(), page: 1 }) }}><div className="min-w-0 flex-1 basis-56"><label htmlFor="admin-users-search" className="mb-2 block text-sm font-semibold text-dark-green">Tên hoặc email</label><input id="admin-users-search" name="search" type="search" className="field" maxLength={150} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc email" /></div><div className="min-w-0 basis-40"><label htmlFor="admin-users-role" className="mb-2 block text-sm font-semibold text-dark-green">Vai trò</label><select id="admin-users-role" className="field" value={query.role} onChange={(event) => setQuery({ ...query, role: event.target.value, page: 1 })}><option value="">Tất cả vai trò</option><option value="User">User</option><option value="Admin">Admin</option></select></div><button type="submit" className="button-primary"><Search size={17} aria-hidden="true" />Tìm kiếm</button></form><DataTable columns={columns} rows={data?.data} rowKey="userId" caption="Danh sách tài khoản" loading={loading} error={error} onRetry={reload} emptyTitle="Chưa có tài khoản phù hợp" />{!loading && !error && <div><p className="text-sm text-ink/60">Tổng cộng {data.pagination.total} tài khoản</p><Pagination pagination={data.pagination} onPageChange={(page) => setQuery({ ...query, page })} label="Phân trang tài khoản" /></div>}{selected && <UserDetail id={selected} onClose={() => setSelected(null)} />}</div>
}
