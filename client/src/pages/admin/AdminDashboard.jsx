import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { CookingPot, Carrot, Tags, Users, MessageSquare, Heart, ArrowUpRight } from 'lucide-react'
import { getAdminDashboard } from '../../services/adminService.js'
import useAdminData from '../../components/admin/useAdminData.js'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'

const metrics = [
  ['recipeCount', 'Món ăn', CookingPot, '/admin/recipes'], ['ingredientCount', 'Nguyên liệu', Carrot, '/admin/ingredients'],
  ['categoryCount', 'Danh mục', Tags, '/admin/categories'], ['userCount', 'Tài khoản', Users, '/admin/users'],
  ['reviewCount', 'Đánh giá', MessageSquare, '/admin/reviews'], ['favoriteCount', 'Lượt yêu thích', Heart],
]
function RecipeRanking({ title, rows, recent = false }) {
  return <section className="surface-card min-w-0 p-5"><h2 className="mb-5 text-base font-bold text-dark-green">{title}</h2>{rows.length ? <ol className="divide-y divide-forest/10">{rows.map((item, index) => <li key={item.recipeId} className="flex items-center gap-3 py-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-forest/8 text-xs font-bold text-forest">{index + 1}</span><Link to={`/admin/recipes/${item.recipeId}/edit`} className="min-w-0 flex-1 break-words text-sm font-semibold text-ink hover:text-forest">{item.recipeName}</Link><span className="shrink-0 text-xs text-ink/55">{recent ? new Intl.DateTimeFormat('vi-VN').format(new Date(item.createdAt)) : `${new Intl.NumberFormat('vi-VN').format(item.count)} lượt`}</span></li>)}</ol> : <p className="py-6 text-sm leading-7 text-ink/60">Chưa có dữ liệu trong nhóm này.</p>}</section>
}
export default function AdminDashboard() {
  const load = useCallback((options) => getAdminDashboard(options), [])
  const { data, loading, error, reload } = useAdminData(load)
  if (loading) return <LoadingSpinner label="Đang tải thống kê quản trị…" />
  if (error) return <ErrorState title="Chưa thể tải thống kê quản trị" error={error} onRetry={reload} />
  return <div className="space-y-7"><div><p className="eyebrow">Góc nhìn tổng thể</p><p className="mt-2 text-sm leading-7 text-ink/65">Theo dõi công thức, nguyên liệu và hoạt động của cộng đồng SmartCook.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([key, label, Icon, to]) => <article key={key} className="surface-card p-5"><div className="flex items-start justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-forest/8 text-forest"><Icon size={23} aria-hidden="true" /></span>{to && <Link to={to} className="rounded-lg p-1 text-ink/45 hover:text-forest" aria-label={`Quản lý ${label.toLocaleLowerCase('vi-VN')}`}><ArrowUpRight size={18} aria-hidden="true" /></Link>}</div><p className="mt-4 text-3xl font-bold tracking-tight text-dark-green">{new Intl.NumberFormat('vi-VN').format(data.totals[key])}</p><h2 className="mt-1 text-sm text-ink/60">{label}</h2></article>)}</div><div className="grid gap-5 xl:grid-cols-3"><RecipeRanking title="Được yêu thích nhiều nhất" rows={data.mostFavorited} /><RecipeRanking title="Được đánh giá nhiều nhất" rows={data.mostReviewed} /><RecipeRanking title="Món ăn mới thêm" rows={data.newestRecipes} recent /></div></div>
}
