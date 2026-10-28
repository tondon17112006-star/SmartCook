import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ShoppingBasket } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import ConfirmDialog from '../components/admin/ConfirmDialog.jsx'
import AddMealDialog from '../components/meal-planner/AddMealDialog.jsx'
import EditMealDialog from '../components/meal-planner/EditMealDialog.jsx'
import WeeklyCalendar from '../components/meal-planner/WeeklyCalendar.jsx'
import ShoppingList from '../components/meal-planner/ShoppingList.jsx'
import useMealMutation from '../components/meal-planner/useMealMutation.js'
import { deleteMealPlanItem, getMealPlan } from '../services/mealPlannerService.js'
import { formatMealDate, formatWeekRange, isWeekStart, shiftWeek, startOfWeek, todayInVietnam } from '../utilities/mealPlannerDates.js'

function MealPlannerBody() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [today, setToday] = useState(todayInVietnam), [revision, setRevision] = useState(0), [retry, setRetry] = useState(0)
  const [result, setResult] = useState({ loading: true, error: null, data: null, weekStart: null })
  const [adding, setAdding] = useState(null), [editing, setEditing] = useState(null), [deleting, setDeleting] = useState(null), [success, setSuccess] = useState('')
  const { pending, error, setError, run } = useMealMutation()
  const requested = searchParams.get('weekStart'), currentWeek = startOfWeek(today)
  const weekStart = requested && isWeekStart(requested) ? requested : currentWeek
  const invalidWeek = requested !== null && !isWeekStart(requested)
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInVietnam()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const controller = new AbortController(); let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setResult({ loading: true, error: null, data: null, weekStart })
      try {
        const data = await getMealPlan(weekStart, { signal: controller.signal })
        if (active) setResult({ loading: false, error: null, data, weekStart })
      } catch (failure) { if (active && !controller.signal.aborted) setResult({ loading: false, error: failure, data: null, weekStart }) }
    })
    return () => { active = false; controller.abort() }
  }, [weekStart, revision, retry])
  const loading = result.loading || result.weekStart !== weekStart
  function goToWeek(date) {
    if (!date) return
    setSuccess(''); setSearchParams({ weekStart: date }); setAdding(null); setEditing(null); setDeleting(null)
  }
  function goToCurrentWeek() {
    const currentDate = todayInVietnam()
    setToday(currentDate)
    goToWeek(startOfWeek(currentDate))
  }
  function saved(message) { setAdding(null); setEditing(null); setDeleting(null); setSuccess(message); setRevision((value) => value + 1) }
  function remove() { void run((options) => deleteMealPlanItem(deleting.mealPlanItemId, options), () => saved('Đã xóa món khỏi lịch nấu ăn.')) }
  return <section className="container-shell min-w-0 py-10 sm:py-14">
    <header className="mb-7 flex items-start gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-forest/8 text-forest"><CalendarDays size={26} aria-hidden="true" /></span><div className="min-w-0"><p className="eyebrow">Một tuần ngon miệng</p><h1 className="mt-2 text-3xl font-bold text-dark-green sm:text-4xl">Lịch nấu ăn của tôi</h1><p className="mt-3 text-sm leading-7 text-ink/65">Lên thực đơn cho cả tuần, chuẩn bị nguyên liệu và nấu ăn dễ dàng hơn.</p></div></header>
    <div className="mb-7 rounded-2xl border border-forest/15 bg-cream p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-bold tabular-nums text-dark-green" aria-live="polite">{formatWeekRange(weekStart)}</h2><div className="flex flex-wrap gap-2"><button type="button" className="button-secondary px-3" disabled={!shiftWeek(weekStart, -1)} onClick={() => goToWeek(shiftWeek(weekStart, -1))}><ChevronLeft size={16} aria-hidden="true" />Tuần trước</button><button type="button" className="button-secondary px-3" onClick={goToCurrentWeek}>Tuần này</button><button type="button" className="button-secondary px-3" disabled={!shiftWeek(weekStart, 1)} onClick={() => goToWeek(shiftWeek(weekStart, 1))}>Tuần sau<ChevronRight size={16} aria-hidden="true" /></button></div></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" className="button-primary" onClick={() => { setSuccess(''); setAdding({ mealDate: weekStart === currentWeek ? today : weekStart, mealType: 'Lunch' }) }}><Plus size={18} aria-hidden="true" />Thêm món vào lịch</button><a href="#shopping-list" className="button-secondary"><ShoppingBasket size={18} aria-hidden="true" />Xem danh sách đi chợ</a></div></div>
    {invalidWeek && <p role="alert" className="mb-5 rounded-xl bg-orange/10 p-4 text-sm">Tham số tuần không hợp lệ. Đang hiển thị tuần hiện tại; chọn tuần từ các nút điều hướng.</p>}
    {success && <p role="status" className="mb-5 rounded-xl bg-forest/8 p-4 text-sm font-semibold text-forest">{success}</p>}
    {loading ? <p role="status" className="py-12 text-center">Đang tải lịch nấu ăn…</p> : result.error ? <ErrorState title="Chưa thể tải lịch nấu ăn" error={result.error} onRetry={() => setRetry((value) => value + 1)} /> : <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Thống kê tuần">{[[result.data.summary.itemCount, 'Món đã lên kế hoạch'], [result.data.summary.mealCount, 'Bữa đã có món'], [result.data.summary.dayCount, 'Ngày có kế hoạch'], [result.data.summary.ingredientCount, 'Loại nguyên liệu bắt buộc']].map(([count, label]) => <div key={label} className="rounded-2xl border border-forest/10 bg-white p-4"><p className="text-2xl font-bold text-dark-green">{count}</p><p className="mt-1 text-sm text-ink/60">{label}</p></div>)}</div>
      {!result.data.summary.itemCount && <div className="mb-6"><EmptyState title="Bạn chưa lên lịch nấu ăn cho tuần này." description="Bắt đầu từ món bạn muốn nấu. Mỗi bữa có thể có nhiều món cho cả gia đình." action={<button type="button" className="button-primary" onClick={() => setAdding({ mealDate: weekStart === currentWeek ? today : weekStart, mealType: 'Lunch' })}>Bắt đầu lên thực đơn</button>} /></div>}
      <WeeklyCalendar days={result.data.days} today={today} onAdd={(value) => { setAdding(value); setSuccess('') }} onEdit={(item) => { setEditing(item); setSuccess('') }} onDelete={(item) => { setDeleting(item); setError(null); setSuccess('') }} />
    </>}
    <ShoppingList key={`${weekStart}:${revision}`} weekStart={weekStart} revision={revision} />
    {adding && <AddMealDialog {...adding} onClose={() => setAdding(null)} onSaved={() => saved('Đã thêm món vào lịch nấu ăn.')} />}
    {editing && <EditMealDialog item={editing} onClose={() => setEditing(null)} onSaved={() => saved('Đã cập nhật món trong lịch nấu ăn.')} />}
    {deleting && <ConfirmDialog title="Xóa món khỏi lịch?" description={`Xóa ${deleting.recipeName} ngày ${formatMealDate(deleting.mealDate)} khỏi lịch? Công thức gốc, món yêu thích và đánh giá được giữ nguyên.`} pending={pending} error={error} onCancel={() => setDeleting(null)} onConfirm={remove} />}
  </section>
}
export default function MealPlanner() {
  const { currentUser, isAuthenticated, sessionGeneration } = useAuth()
  if (!isAuthenticated || !currentUser) return null
  return <MealPlannerBody key={`${currentUser.userId}:${sessionGeneration}`} />
}
