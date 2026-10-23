import { useId, useRef, useState } from 'react'
import { Heart, LoaderCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import useFavorites from '../hooks/useFavorites.js'

export default function FavoriteButton({ recipeId, recipeName, className = '', confirmRemoval = false }) {
  const { isAuthenticated, isLoading: authLoading, sessionStatus, refreshSession } = useAuth()
  const { key: accountKey, isFavorite, isReady, isLoading, pendingIds, error: loadError, reload, toggleFavorite } = useFavorites()
  const location = useLocation()
  const navigate = useNavigate()
  const messageId = useId()
  const clicked = useRef(false)
  const [message, setMessage] = useState(null)
  const [confirmingKey, setConfirmingKey] = useState(null)
  const confirming = accountKey !== null && confirmingKey === accountKey
  const visibleMessage = message?.accountKey === accountKey ? message : null
  const saved = isAuthenticated && isReady && isFavorite(recipeId)
  const busy = pendingIds.has(recipeId)
  const label = `${saved ? 'Bỏ yêu thích' : 'Yêu thích'} ${recipeName}`

  async function changeFavorite() {
    if (clicked.current) return
    clicked.current = true
    setMessage(null)
    try {
      const result = await toggleFavorite(recipeId)
      if (result !== null) setMessage({ accountKey, type: 'status', text: result ? 'Đã lưu món ăn yêu thích.' : 'Đã bỏ món ăn khỏi yêu thích.' })
      setConfirmingKey(null)
    } catch (error) {
      setMessage({ accountKey, type: 'alert', text: typeof error?.response?.data?.message === 'string' ? error.response.data.message : error.message || 'Chưa thể cập nhật yêu thích. Bạn vui lòng thử lại.' })
    } finally {
      clicked.current = false
    }
  }

  async function handleClick() {
    if (sessionStatus === 'unknown') { await refreshSession(); return }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
      return
    }
    if (!isReady) { await reload(); return }
    if (saved && confirmRemoval) { setConfirmingKey(accountKey); return }
    await changeFavorite()
  }

  return (
    <div className={className}>
      <button type="button" aria-label={label} aria-pressed={saved} aria-describedby={visibleMessage ? messageId : undefined}
        disabled={authLoading || busy || (isAuthenticated && isLoading)} onClick={handleClick}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-wait disabled:opacity-60 ${saved ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-stone-200 bg-white text-forest hover:border-forest/40 hover:bg-cream'}`}>
        {busy ? <LoaderCircle size={19} className="motion-safe:animate-spin" aria-hidden="true" /> : <Heart size={19} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />}
        <span className="sr-only">{label}</span>
      </button>
      {loadError && isAuthenticated && !isReady && <p className="mt-2 max-w-56 rounded-lg bg-white p-2 text-xs text-red-800" role="alert">Chưa tải được yêu thích. Nhấn trái tim để thử lại.</p>}
      {visibleMessage && <p id={messageId} role={visibleMessage.type} className={`mt-2 max-w-56 rounded-lg bg-white p-2 text-xs ${visibleMessage.type === 'alert' ? 'text-red-800' : 'text-forest'}`}>{visibleMessage.text}</p>}
      {confirming && <div className="mt-2 max-w-64 rounded-xl border border-forest/15 bg-white p-3 shadow-lg" role="group" aria-label={`Xác nhận bỏ yêu thích ${recipeName}`}>
        <p className="text-sm text-ink">Bỏ “{recipeName}” khỏi món yêu thích?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={changeFavorite} className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{busy ? 'Đang bỏ…' : 'Bỏ yêu thích'}</button>
          <button type="button" disabled={busy} onClick={() => setConfirmingKey(null)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Giữ lại</button>
        </div>
      </div>}
    </div>
  )
}
