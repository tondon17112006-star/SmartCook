import { useEffect, useRef, useState } from 'react'
import { Archive, ChefHat } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import usePantry from '../hooks/usePantry.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import PantryForm from '../components/PantryForm.jsx'
import ServingsSelector from '../components/ServingsSelector.jsx'
import { getPantry, createPantryItem, updatePantryItem, deletePantryItem } from '../services/pantryService.js'
import { eligiblePantryIds, expiryStatus, summarizePantry, todayInVietnam } from '../utilities/myPantry.js'

function messageFor(error) {
  return typeof error?.response?.data?.message === 'string' ? error.response.data.message : error?.message || 'Chưa thể lưu thay đổi. Bạn vui lòng thử lại.'
}
const expiryLabels = { expired: 'Đã hết hạn', soon: 'Sắp hết hạn', unknown: 'Chưa ghi hạn sử dụng', fresh: 'Còn hạn', invalid: 'Ngày chưa hợp lệ' }

function MyPantryBody() {
  const { catalog, loading: catalogLoading, error: catalogError, retry: retryCatalog, servings, setServings, replaceSelection } = usePantry()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(null)
  const [formVersion, setFormVersion] = useState(0)
  const [deleteId, setDeleteId] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [today, setToday] = useState(todayInVietnam)
  const mounted = useRef(false), busy = useRef(false), request = useRef(null)
  useEffect(() => {
    mounted.current = true
    const timer = setInterval(() => setToday(todayInVietnam()), 30000)
    return () => { mounted.current = false; request.current?.abort(); clearInterval(timer) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true); setLoadError(null)
      try {
        const result = await getPantry({ signal: controller.signal })
        if (active && !controller.signal.aborted) { setItems(result); setLoading(false) }
      } catch (failure) {
        if (active && !controller.signal.aborted) { setItems([]); setLoadError(failure); setLoading(false) }
      }
    })
    return () => { active = false; controller.abort() }
  }, [attempt])
  async function perform(action, data) {
    if (busy.current) return
    busy.current = true
    const controller = new AbortController()
    request.current = controller
    setPending(true); setError(null); setSuccess(null)
    try {
      const result = action === 'delete' ? await deletePantryItem(deleteId, { signal: controller.signal })
        : editing ? await updatePantryItem(editing.userIngredientId, data, { signal: controller.signal })
          : await createPantryItem(data, { signal: controller.signal })
      if (!mounted.current || controller.signal.aborted) return
      if (action === 'delete') {
        setItems((previous) => previous.filter((item) => item.userIngredientId !== deleteId))
        if (editing?.userIngredientId === deleteId) { setEditing(null); setFormVersion((value) => value + 1) }
        setDeleteId(null); setSuccess('Đã xóa nguyên liệu khỏi tủ.')
      } else {
        setItems((previous) => editing ? previous.map((item) => item.userIngredientId === result.userIngredientId ? result : item) : [...previous, result])
        setSuccess(editing ? 'Đã cập nhật nguyên liệu.' : 'Đã thêm nguyên liệu vào tủ.')
        setEditing(null); setFormVersion((value) => value + 1)
      }
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(messageFor(failure))
    } finally {
      busy.current = false
      if (mounted.current && !controller.signal.aborted) setPending(false)
    }
  }
  function cook() {
    if (busy.current || pending || loading || loadError || catalogLoading || catalogError) return
    setError(null); setSuccess(null)
    try {
      // Recheck the calendar at the click, including a midnight boundary before
      // the periodic visual badges have refreshed.
      const ids = eligiblePantryIds(items, todayInVietnam())
      if (!replaceSelection(ids)) throw new Error('Danh mục nguyên liệu đã thay đổi. Vui lòng tải lại danh mục trước khi tìm món.')
      navigate('/suggestions')
    } catch (failure) { setError(messageFor(failure)) }
  }
  const counts = summarizePantry(items, today)
  const deleteItem = items.find((item) => item.userIngredientId === deleteId)
  return <section className="container-shell py-10 sm:py-14">
    <div className="mb-8 flex items-start gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-forest/8 text-forest"><Archive size={26} aria-hidden="true" /></span><div><p className="eyebrow">Gọn gian bếp, dễ lên thực đơn</p><h1 className="mt-2 text-3xl font-bold text-dark-green sm:text-4xl">Tủ nguyên liệu của tôi</h1><p className="mt-3 text-sm leading-7 text-ink/65">Lưu nguyên liệu riêng theo tài khoản và theo dõi hạn sử dụng, kể cả sau khi đổi thiết bị.</p></div></div>
    {success && <p role="status" className="mb-5 rounded-xl bg-forest/8 p-4 text-sm font-semibold text-forest">{success}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800">{error}</p>}
    {loadError ? <ErrorState title="Chưa thể tải tủ nguyên liệu" error={loadError} onRetry={() => setAttempt((value) => value + 1)} />
      : loading ? <p role="status" className="py-10 text-center text-ink/65">Đang tải tủ nguyên liệu…</p>
        : <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[[counts.total, 'Loại nguyên liệu'], [counts.soon, 'Sắp hết hạn'], [counts.expired, 'Đã hết hạn'], [counts.unknown, 'Chưa ghi hạn']].map(([value, label]) => <div key={label} className="rounded-2xl border border-forest/10 bg-white p-4"><p className="text-2xl font-bold text-dark-green">{value}</p><p className="mt-1 text-sm text-ink/60">{label}</p></div>)}</div>
          <div className="mb-7 rounded-2xl border border-forest/15 bg-cream p-5"><div className="mb-5"><ServingsSelector variant="stepper" value={servings} onChange={setServings} disabled={pending} /></div><button type="button" disabled={pending || catalogLoading || Boolean(catalogError) || !items.length} className="button-primary" onClick={cook}><ChefHat size={18} aria-hidden="true" />Nấu ăn từ tủ nguyên liệu</button><p className="mt-3 text-sm leading-7 text-ink/65">Tìm món cho {servings} người từ tất cả loại nguyên liệu chưa hết hạn, giữ nguyên khẩu phần đang chọn. Ngày hôm nay và 3 ngày tới được đánh dấu sắp hết hạn, theo giờ Việt Nam. Nguyên liệu chưa ghi hạn vẫn được chọn; bạn cần tự kiểm tra chất lượng trước khi nấu.</p><p className="mt-2 text-xs leading-6 text-ink/60">Gợi ý dựa trên loại nguyên liệu, chưa tính đủ số lượng, không quy đổi đơn vị và không tự trừ nguyên liệu sau khi nấu.</p></div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"><div>{catalogError ? <ErrorState title="Chưa thể tải danh mục nguyên liệu" error={catalogError} onRetry={retryCatalog} /> : catalogLoading ? <p role="status">Đang tải danh mục nguyên liệu…</p> : <PantryForm key={`${editing?.userIngredientId ?? 'new'}:${formVersion}`} catalog={catalog} item={editing} pending={pending} onSubmit={(data) => perform('save', data)} onCancel={editing ? () => { setEditing(null); setError(null) } : undefined} />}</div>
            <div className="space-y-4">{items.length === 0 ? <EmptyState title="Tủ nguyên liệu đang trống" description="Chọn một nguyên liệu trong danh mục để bắt đầu sắp xếp gian bếp của bạn." /> : items.map((item) => {
              const status = expiryStatus(item.expiryDate, today)
              return <article key={item.userIngredientId} className="rounded-2xl border border-forest/15 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-dark-green">{item.ingredientName}</h2><p className="mt-1 text-sm text-ink/60">{item.ingredientCategory} · {item.quantity === null ? 'Chưa ghi số lượng' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'expired' ? 'bg-red-50 text-red-800' : status === 'soon' ? 'bg-orange/15 text-[#854314]' : 'bg-forest/8 text-forest'}`}>{expiryLabels[status]}</span></div><p className="mt-3 text-sm text-ink/60">{item.expiryDate ? `Hạn sử dụng: ${item.expiryDate.split('-').reverse().join('/')}` : 'Chưa ghi hạn sử dụng; hãy kiểm tra chất lượng thực tế.'}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={pending} className="button-secondary" onClick={() => { setEditing(item); setDeleteId(null); setError(null); setSuccess(null) }} aria-label={`Sửa ${item.ingredientName}`}>Chỉnh sửa</button><button type="button" disabled={pending} className="min-h-11 px-3 text-sm font-semibold text-red-800 underline underline-offset-4" onClick={() => { setDeleteId(item.userIngredientId); setError(null); setSuccess(null) }} aria-label={`Xóa ${item.ingredientName}`}>Xóa</button></div>{deleteItem?.userIngredientId === item.userIngredientId && <div role="group" aria-label={`Xác nhận xóa ${item.ingredientName}`} className="mt-4 rounded-xl border border-red-200 p-4"><p className="text-sm">Xóa {item.ingredientName} khỏi tủ của bạn?</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={pending} className="button-primary" onClick={() => perform('delete')}>{pending ? 'Đang xóa…' : 'Xác nhận xóa'}</button><button type="button" disabled={pending} className="button-secondary" onClick={() => setDeleteId(null)}>Giữ nguyên liệu</button></div></div>}</article>
            })}</div>
          </div>
        </>}
  </section>
}

export default function MyPantry() {
  const { currentUser, isAuthenticated, sessionGeneration } = useAuth()
  if (!isAuthenticated || !currentUser) return null
  return <MyPantryBody key={`${currentUser.userId}:${sessionGeneration}`} />
}
