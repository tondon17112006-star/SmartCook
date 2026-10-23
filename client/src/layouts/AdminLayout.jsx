import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, PanelLeftClose, PanelLeftOpen, ChevronRight } from 'lucide-react'
import useAuth from '../hooks/useAuth.js'
import UserAvatar from '../components/UserAvatar.jsx'
import AdminSidebar from '../components/admin/AdminSidebar.jsx'
import { adminNavigation } from '../components/admin/adminNavigation.js'
import AdminDialog from '../components/admin/AdminDialog.jsx'

function AdminShell() {
  const { currentUser, logout, error } = useAuth()
  const location = useLocation(), navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false), [collapsed, setCollapsed] = useState(false), [pending, setPending] = useState(false)
  const page = adminNavigation.slice(1).find((item) => location.pathname.startsWith(item.to)) || adminNavigation[0]
  const title = location.pathname.endsWith('/new') ? 'Thêm món ăn' : /\/recipes\/[^/]+\/edit$/u.test(location.pathname) ? 'Chỉnh sửa món ăn' : page.label
  useEffect(() => {
    const previous = document.title
    document.title = `${title} · Quản trị SmartCook`
    return () => { document.title = previous }
  }, [title])
  async function handleLogout() {
    if (pending) return
    setPending(true)
    try { await logout({ onSuccess: () => navigate('/', { replace: true }) }) } catch { setPending(false) }
  }
  return <div className="flex min-h-dvh max-w-full bg-cream">
    <a className="skip-link" href="#admin-content">Đến nội dung quản trị</a>
    <aside className={`sticky top-0 hidden h-dvh shrink-0 bg-dark-green p-4 md:block ${collapsed ? 'w-20' : 'w-20 lg:w-64'}`}><AdminSidebar collapsed={collapsed} compactAtTablet onLogout={handleLogout} pending={pending} /></aside>
    {mobileOpen && <AdminDialog title="Menu quản trị" side onClose={() => setMobileOpen(false)} pending={pending}>{error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}<div className="min-h-[70dvh] rounded-xl bg-dark-green p-4"><AdminSidebar onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} pending={pending} /></div></AdminDialog>}
    <div className="min-w-0 flex-1">
      <header className="border-b border-forest/10 bg-white px-4 py-5 sm:px-7"><div className="flex min-w-0 items-center gap-3"><button type="button" className="shrink-0 rounded-lg p-2 text-forest md:hidden" aria-label="Mở menu quản trị" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={24} aria-hidden="true" /></button><button type="button" className="hidden shrink-0 rounded-lg p-2 text-forest lg:block" aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={22} aria-hidden="true" /> : <PanelLeftClose size={22} aria-hidden="true" />}</button><div className="min-w-0 flex-1"><nav aria-label="Đường dẫn quản trị" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-ink/55"><Link to="/admin">Quản trị</Link><ChevronRight size={12} aria-hidden="true" /><span>{title}</span></nav><h1 className="text-xl font-bold text-dark-green sm:text-2xl">{title}</h1></div><Link to="/profile" className="flex min-w-0 items-center gap-2 rounded-xl p-1" aria-label={`Hồ sơ của ${currentUser.fullName}`}><UserAvatar user={currentUser} /><span className="hidden max-w-40 truncate text-sm font-semibold text-dark-green sm:block">{currentUser.fullName}<span className="block text-xs font-normal text-ink/55">Quản trị viên</span></span></Link></div></header>
      <main id="admin-content" className="mx-auto w-full min-w-0 max-w-[1600px] p-4 sm:p-7 lg:p-8">{error && !mobileOpen && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}<Outlet /></main>
    </div>
  </div>
}
export default function AdminLayout() {
  const { currentUser, sessionGeneration } = useAuth()
  // A different session cannot inherit private rows, drafts or pending writes.
  return <AdminShell key={`${currentUser.userId}:${sessionGeneration}`} />
}
