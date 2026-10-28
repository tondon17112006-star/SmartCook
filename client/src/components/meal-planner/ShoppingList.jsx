import { useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, ShoppingBasket } from 'lucide-react'
import ErrorState from '../ErrorState.jsx'
import EmptyState from '../EmptyState.jsx'
import { getShoppingList } from '../../services/mealPlannerService.js'
import { formatWeekRange } from '../../utilities/mealPlannerDates.js'
import { formatShoppingQuantity } from '../../utilities/mealPlanner.js'
const itemKey = (item) => JSON.stringify([item.ingredientId, item.unit])
export function ShoppingItem({ item, checked, onChange }) {
  const id = useId()
  return <li className="min-w-0 rounded-xl border border-forest/10 bg-white p-4">
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3"><input id={id} type="checkbox" className="mt-1 size-5 shrink-0 accent-forest" checked={checked} onChange={onChange} /><span className="min-w-0 flex-1"><span className={`block font-semibold [overflow-wrap:anywhere] ${checked ? 'text-ink/50 line-through' : 'text-dark-green'}`}>{item.ingredientName}</span><span className="mt-1 block text-sm text-ink/65">{formatShoppingQuantity(item.totalQuantity)} {item.unit} · {item.ingredientCategory || 'Chưa phân nhóm'}</span><span className="mt-2 block text-xs leading-6 text-ink/55 [overflow-wrap:anywhere]">{item.recipes.map((recipe) => recipe.recipeName).join(', ')}</span><span className="sr-only">{checked ? 'Đã mua' : 'Chưa mua'}</span></span>{checked && <Check size={18} className="shrink-0 text-forest" aria-hidden="true" />}</label>
  </li>
}
export default function ShoppingList({ weekStart, revision = 0 }) {
  const [result, setResult] = useState({ items: [], loading: true, error: null, key: '' }), [retry, setRetry] = useState(0)
  const [checked, setChecked] = useState(new Set()), [copyStatus, setCopyStatus] = useState(''), [fallback, setFallback] = useState(false), [copyPending, setCopyPending] = useState(false)
  const alive = useRef(false), copyBusy = useRef(false), textRef = useRef(null)
  const scope = `${weekStart}:${revision}`
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController(); let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setChecked(new Set()); setCopyStatus(''); setFallback(false)
      setResult({ items: [], loading: true, error: null, key: scope })
      try {
        const response = await getShoppingList(weekStart, { signal: controller.signal })
        if (active) setResult({ ...response, loading: false, error: null, key: scope })
      } catch (failure) { if (active && !controller.signal.aborted) setResult({ items: [], loading: false, error: failure, key: scope }) }
    })
    return () => { active = false; controller.abort() }
  }, [weekStart, revision, scope, retry])
  useEffect(() => { if (fallback) { textRef.current?.focus(); textRef.current?.select() } }, [fallback])
  const loading = result.loading || result.key !== scope
  const copyText = `Danh sách đi chợ SmartCook\n${formatWeekRange(weekStart)}\nNguyên liệu bắt buộc\n${result.items.map((item) => `${checked.has(itemKey(item)) ? '[x]' : '[ ]'} ${item.ingredientName}: ${formatShoppingQuantity(item.totalQuantity)} ${item.unit}`).join('\n')}`
  async function copy() {
    if (copyBusy.current) return
    copyBusy.current = true; setCopyPending(true); setCopyStatus(''); setFallback(false)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(copyText)
      if (alive.current) setCopyStatus('Đã sao chép danh sách đi chợ.')
    } catch {
      if (alive.current) { setCopyStatus('Chưa thể sao chép tự động. Chọn nội dung bên dưới và sao chép thủ công.'); setFallback(true) }
    } finally { copyBusy.current = false; if (alive.current) setCopyPending(false) }
  }
  return <section id="shopping-list" aria-labelledby="shopping-heading" className="mt-10 scroll-mt-28 rounded-3xl border border-forest/15 bg-cream p-5 sm:p-7">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><h2 id="shopping-heading" className="flex items-center gap-2 text-2xl font-bold text-dark-green"><ShoppingBasket size={24} aria-hidden="true" />Danh sách đi chợ</h2><p className="mt-2 text-sm text-ink/65">{formatWeekRange(weekStart)}</p></div><button type="button" className="button-secondary" disabled={loading || Boolean(result.error) || !result.items.length || copyPending} onClick={copy}><Copy size={16} aria-hidden="true" />{copyPending ? 'Đang sao chép…' : 'Sao chép danh sách'}</button></div>
    <p className="mb-3 text-sm leading-7 text-ink/70">Chỉ gồm nguyên liệu bắt buộc, đã tính theo khẩu phần của từng món. Cùng nguyên liệu và cùng đơn vị được cộng chung; đơn vị khác được giữ thành dòng riêng. Chưa trừ nguyên liệu đang có ở nhà.</p>
    <p className="mb-5 text-xs leading-6 text-ink/60">Dấu “Đã mua” chỉ lưu tạm trong trang này và được đặt lại khi đổi tuần, cập nhật lịch, tải lại trang hoặc đổi phiên đăng nhập.</p>
    {copyStatus && <p role="status" className="mb-4 rounded-xl bg-white p-3 text-sm text-forest">{copyStatus}</p>}
    {fallback && <label className="mb-5 grid gap-2 text-sm font-semibold">Nội dung danh sách để sao chép<textarea ref={textRef} className="field min-h-44" readOnly value={copyText} /></label>}
    {loading ? <p role="status" className="py-5">Đang tính danh sách đi chợ…</p> : result.error ? <ErrorState title="Chưa thể tải danh sách đi chợ" error={result.error} onRetry={() => setRetry((value) => value + 1)} /> : result.items.length === 0 ? <EmptyState title="Danh sách đi chợ đang trống" description="Thêm món vào lịch để tổng hợp nguyên liệu bắt buộc của tuần." /> : <><p className="mb-4 text-sm font-semibold text-forest">Đã mua {checked.size}/{result.items.length} dòng nguyên liệu</p><ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{result.items.map((item) => <ShoppingItem key={itemKey(item)} item={item} checked={checked.has(itemKey(item))} onChange={() => setChecked((previous) => { const next = new Set(previous), key = itemKey(item); if (next.has(key)) next.delete(key); else next.add(key); return next })} />)}</ul></>}
  </section>
}
