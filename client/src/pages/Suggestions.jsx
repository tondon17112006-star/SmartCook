import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Info, ShoppingBasket, UsersRound, X } from 'lucide-react'
import usePantry from '../hooks/usePantry.js'
import useSuggestions from '../hooks/useSuggestions.js'
import SuggestionCard from '../components/SuggestionCard.jsx'
import SuggestionSkeleton from '../components/SuggestionSkeleton.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Pagination from '../components/Pagination.jsx'
import { SUGGESTION_FILTERS, SuggestionCollectionError } from '../utilities/suggestions.js'

function SuggestionResults({ pantry }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const { data: response, loading, error, retry } = useSuggestions({ ingredientIds: pantry.selectedIds, servings: pantry.servings, page, status })
  const pagination = response?.pagination

  function changeStatus(nextStatus) {
    setStatus(nextStatus)
    setPage(1)
  }

  function changePage(nextPage) {
    if (!pagination || nextPage < 1 || nextPage > pagination.totalPages) return
    setPage(nextPage)
    document.getElementById('suggestion-results')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <>
      <section aria-labelledby="pantry-summary" className="rounded-2xl border border-forest/15 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 id="pantry-summary" className="flex items-center gap-2 text-lg font-bold text-dark-green"><ShoppingBasket size={21} aria-hidden="true" /> Nguyên liệu của bạn</h2><p className="mt-1 text-sm text-ink/65">{pantry.selectedIds.length} nguyên liệu đã chọn</p></div>
          <Link to="/ingredients" className="button-secondary"><ArrowLeft size={17} aria-hidden="true" /> Thay đổi nguyên liệu</Link>
        </div>
        <ul aria-label="Nguyên liệu đã chọn" className="mt-5 flex flex-wrap gap-2">
          {pantry.selectedIngredients.map((ingredient) => <li key={ingredient.ingredientId} className="max-w-full rounded-full bg-forest/8 px-3 py-1.5 text-sm font-medium text-dark-green [overflow-wrap:anywhere]">{ingredient.ingredientName}</li>)}
        </ul>
        <p className="mt-5 flex items-center gap-2 border-t border-stone-100 pt-4 text-sm font-semibold text-dark-green"><UsersRound size={18} aria-hidden="true" /> Định lượng cho {pantry.servings} người ăn</p>
      </section>

      <section id="suggestion-results" aria-labelledby="suggestion-results-heading" className="scroll-mt-28 pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div aria-live="polite"><h2 id="suggestion-results-heading" className="text-2xl font-bold text-dark-green">{loading ? 'Đang tìm món ngon…' : error ? 'Chưa thể tải gợi ý' : `${pagination?.total ?? 0} món ${status === 'ready' ? 'đủ loại nguyên liệu bắt buộc' : status === 'missing' ? 'còn thiếu nguyên liệu' : 'phù hợp'}`}</h2><p className="mt-2 text-sm leading-6 text-ink/65">{status === 'all' ? 'Sắp xếp theo mức độ phù hợp và số nguyên liệu cần thêm.' : response ? `Đã lọc trên toàn bộ ${response.unfilteredTotal} món phù hợp.` : 'Đang tải đủ kết quả để lọc chính xác.'}</p></div>
        </div>
        <fieldset className="mb-5"><legend className="sr-only">Lọc món theo nguyên liệu bắt buộc</legend><div className="flex flex-wrap gap-2">{SUGGESTION_FILTERS.map((option) => <label key={option.value} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors ${status === option.value ? 'border-forest bg-forest/10 font-semibold text-dark-green' : 'border-stone-200 bg-white text-ink/70 hover:border-forest/50'}`}><input type="radio" name="suggestion-status" value={option.value} checked={status === option.value} onChange={() => changeStatus(option.value)} className="size-4 accent-forest" />{option.label}</label>)}</div></fieldset>
        <p className="mb-7 flex items-start gap-2 rounded-xl bg-cream px-4 py-3 text-xs leading-6 text-ink/70"><Info size={16} className="mt-1 shrink-0 text-forest" aria-hidden="true" /> Tỷ lệ phản ánh số loại nguyên liệu bắt buộc đã chọn. Bạn vẫn cần kiểm tra lượng thực tế theo định lượng của món.</p>
        {loading ? <SuggestionSkeleton count={6} /> : error instanceof SuggestionCollectionError ? (
          <EmptyState title={error.code === 'FILTER_LIMIT' ? 'Chưa hỗ trợ lọc tập kết quả lớn' : 'Kết quả cần được cập nhật'} description={error.message} action={<div className="flex flex-wrap justify-center gap-3"><button type="button" className="button-primary" onClick={retry}>Thử lại</button>{status !== 'all' && <button type="button" className="button-secondary" onClick={() => changeStatus('all')}>Xem tất cả món phù hợp</button>}</div>} />
        ) : error ? (
          <><ErrorState title="Chưa tải được món phù hợp" error={error} onRetry={retry} />{error.response?.status === 400 && <div className="mt-4 text-center"><p className="text-sm text-ink/65">Nguyên liệu có thể đã thay đổi sau khi bạn chọn.</p><button type="button" onClick={pantry.retry} className="button-secondary mt-3">Cập nhật danh sách nguyên liệu</button></div>}</>
        ) : response?.data.length ? (
          <><div className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-3">{response.data.map((recipe) => <SuggestionCard key={recipe.recipeId} recipe={recipe} />)}</div><Pagination pagination={pagination} onPageChange={changePage} /></>
        ) : (
          <EmptyState title={status === 'all' ? 'Chưa tìm thấy món phù hợp' : status === 'ready' ? 'Chưa có món đủ loại nguyên liệu bắt buộc' : 'Không có món còn thiếu nguyên liệu'} description={status === 'all' ? 'Thử chọn thêm nguyên liệu trong bếp để SmartCook tìm được nhiều công thức hơn.' : 'Bạn có thể xem tất cả món phù hợp hoặc thay đổi nguyên liệu đã chọn.'} action={status === 'all' ? <Link to="/ingredients" className="button-primary">Chọn thêm nguyên liệu <ArrowRight size={17} aria-hidden="true" /></Link> : <button type="button" className="button-primary" onClick={() => changeStatus('all')}>Xem tất cả món phù hợp</button>} />
        )}
      </section>
    </>
  )
}

export default function Suggestions() {
  const pantry = usePantry()
  const selectionKey = JSON.stringify({ ids: [...pantry.selectedIds].sort((a, b) => a - b), servings: pantry.servings })

  return (
    <>
      <section className="border-b border-forest/10 bg-cream py-10 sm:py-14"><div className="container-shell"><p className="eyebrow mb-3">Từ căn bếp của bạn</p><h1 className="text-3xl font-bold tracking-tight text-dark-green sm:text-5xl">Món ngon dành cho bạn</h1><p className="mt-4 max-w-2xl leading-7 text-ink/65">Khám phá những món ăn phù hợp với nguyên liệu có sẵn.</p></div></section>
      <div className="container-shell py-8 sm:py-10">
        {pantry.selectionNotice && <div role="status" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-orange/30 bg-cream p-4 text-sm leading-6 text-ink"><span>{pantry.selectionNotice}</span><button type="button" onClick={pantry.dismissNotice} aria-label="Đóng thông báo lựa chọn" className="shrink-0 rounded p-1"><X size={18} aria-hidden="true" /></button></div>}
        {pantry.loading ? <div className="flex min-h-64 items-center justify-center"><LoadingSpinner label="Đang kiểm tra nguyên liệu đã chọn…" /></div> : pantry.error ? <ErrorState title="Chưa kiểm tra được nguyên liệu" error={pantry.error} onRetry={pantry.retry} /> : !pantry.selectedIds.length ? <EmptyState title="Căn bếp của bạn có những gì?" description="Hãy chọn ít nhất một nguyên liệu để SmartCook tìm những món phù hợp. Lựa chọn sẽ được giữ trong phiên khi bạn quay lại." action={<Link to="/ingredients" className="button-primary"><ShoppingBasket size={18} aria-hidden="true" /> Chọn nguyên liệu</Link>} /> : pantry.isReady ? <SuggestionResults key={selectionKey} pantry={pantry} /> : null}
      </div>
    </>
  )
}
