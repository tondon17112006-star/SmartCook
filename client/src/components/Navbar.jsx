import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, ChefHat, LoaderCircle, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import useAuth from '../hooks/useAuth.js'
import UserAvatar from './UserAvatar.jsx'

const links = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/recipes', label: 'Khám phá món ăn' },
  { to: '/ingredients', label: 'Tìm món từ nguyên liệu' },
  { to: '/favorites', label: 'Món yêu thích' },
  { to: '/meal-planner', label: 'Lịch nấu ăn' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState(null)
  const toggleRef = useRef(null)
  const navigate = useNavigate()
  const { currentUser, isAuthenticated, isLoading, sessionStatus, logout, refreshSession } = useAuth()
  const accountLinks = isAuthenticated && currentUser?.role === 'Admin'
    ? [...links, { to: '/admin', label: 'Quản trị' }]
    : links

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await logout({ onSuccess: () => {
        setOpen(false)
        navigate('/', { replace: true })
      } })
    } catch (error) {
      setLogoutError(error?.response?.data?.message || 'Chưa thể đăng xuất. Phiên đăng nhập vẫn được giữ, bạn vui lòng thử lại.')
    } finally {
      setLoggingOut(false)
    }
  }

  const loginLink = <Link to="/login" onClick={() => setOpen(false)} className="button-ghost whitespace-nowrap">Đăng nhập</Link>
  const sessionStatusControl = isLoading
    ? <span className="flex items-center gap-2 text-xs text-ink/60" role="status"><LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" /><span>Kiểm tra phiên…</span></span>
    : <button type="button" onClick={() => void refreshSession()} className="button-ghost text-xs">Thử lại phiên</button>

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/95 backdrop-blur-md">
      <div className="container-shell flex min-h-20 items-center justify-between gap-3 xl:gap-5">
        <Link to="/" onClick={() => setOpen(false)} aria-label="SmartCook — Trang chủ" className="flex shrink-0 items-center gap-2.5 text-2xl font-bold tracking-tight text-dark-green">
          <span className="flex size-10 items-center justify-center rounded-xl bg-forest text-white"><ChefHat size={25} aria-hidden="true" /></span>
          <span>Smart<span className="text-forest">Cook</span></span>
        </Link>
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-4 xl:flex">
          {accountLinks.map(({ to, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `relative inline-flex items-center gap-1.5 whitespace-nowrap py-7 text-sm font-medium transition-colors hover:text-forest ${isActive ? 'text-forest after:absolute after:inset-x-0 after:bottom-4 after:h-0.5 after:rounded-full after:bg-forest' : 'text-ink/75'}`}>{to === '/meal-planner' && <CalendarDays size={17} aria-hidden="true" />}{label}</NavLink>)}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/ingredients" onClick={() => setOpen(false)} className="button-primary hidden whitespace-nowrap px-4 sm:inline-flex">Tìm món ngay <ArrowUpRight size={17} aria-hidden="true" /></Link>
          <div className="hidden items-center gap-1 xl:flex">
            {isAuthenticated ? <>
              <Link to="/profile" className="flex min-w-0 items-center gap-2 rounded-xl p-1.5 hover:bg-cream" aria-label={`Hồ sơ của ${currentUser.fullName}`}>
                <UserAvatar user={currentUser} className="size-8" />
                <span className="max-w-24 truncate text-sm font-semibold text-dark-green">{currentUser.fullName}</span>
              </Link>
              <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} aria-label={loggingOut ? 'Đang đăng xuất' : 'Đăng xuất'} title="Đăng xuất" className="flex size-10 items-center justify-center rounded-xl text-ink/65 hover:bg-cream disabled:opacity-50">
                {loggingOut ? <LoaderCircle size={18} className="motion-safe:animate-spin" aria-hidden="true" /> : <LogOut size={18} aria-hidden="true" />}
              </button>
            </> : isLoading || sessionStatus === 'unknown' ? sessionStatusControl : loginLink}
          </div>
          <button ref={toggleRef} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Đóng menu' : 'Mở menu'} className="flex size-11 items-center justify-center rounded-xl border border-stone-200 text-dark-green hover:bg-cream xl:hidden">
            {open ? <X size={23} aria-hidden="true" /> : <Menu size={23} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="mobile-menu" aria-label="Điều hướng trên di động" hidden={!open} className="border-t border-stone-100 bg-white xl:hidden">
        <div className="container-shell flex flex-col gap-1 py-4">
          {accountLinks.map(({ to, label, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-forest/10 text-dark-green' : 'text-ink/75 hover:bg-cream'}`}>{to === '/admin' && <ShieldCheck size={17} aria-hidden="true" />}{to === '/meal-planner' && <CalendarDays size={17} aria-hidden="true" />}{label}</NavLink>)}
          <div className="mt-2 border-t border-stone-100 pt-3">
            {isAuthenticated ? <>
              <Link to="/profile" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 hover:bg-cream">
                <UserAvatar user={currentUser} />
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-dark-green">{currentUser.fullName}</span><span className="text-xs text-ink/60">Hồ sơ cá nhân</span></span>
              </Link>
              <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="button-ghost mt-2 w-full justify-start px-4 disabled:opacity-50">
                {loggingOut ? <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : <LogOut size={17} aria-hidden="true" />}{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
              </button>
            </> : isLoading || sessionStatus === 'unknown' ? sessionStatusControl : loginLink}
          </div>
          <Link to="/ingredients" onClick={() => setOpen(false)} className="button-primary mt-2 sm:hidden">Tìm món ngay <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </nav>
      {logoutError && <div className="container-shell flex items-start justify-between gap-4 pb-3 text-sm text-[#A35720]" role="alert"><p>{logoutError}</p><button type="button" onClick={() => setLogoutError(null)} aria-label="Đóng thông báo đăng xuất" className="rounded p-1"><X size={17} aria-hidden="true" /></button></div>}
    </header>
  )
}
