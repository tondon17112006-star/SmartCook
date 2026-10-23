import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import { getMyReview, getReviews } from '../services/reviewService.js'
import ErrorState from './ErrorState.jsx'
import Pagination from './Pagination.jsx'
import ReviewCard from './ReviewCard.jsx'
import ReviewForm from './ReviewForm.jsx'
import StarRating from './StarRating.jsx'

function ReviewContent({ recipeId, isAuthenticated, sessionStatus, refreshSession }) {
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [list, setList] = useState({ loading: true, error: null, data: [], pagination: null, summary: null })
  const [mine, setMine] = useState({ loading: isAuthenticated, error: null, review: null })
  const [mineRetry, setMineRetry] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (!active) return
      setList((previous) => ({ ...previous, loading: true, error: null }))
      try {
        const result = await getReviews(recipeId, { page, limit: 6, signal: controller.signal })
        if (!active) return
        if (page > 1 && result.data.length === 0) { setPage(Math.max(1, result.pagination.totalPages)); return }
        setList({ ...result, loading: false, error: null })
      } catch (error) {
        if (active && !controller.signal.aborted) setList((previous) => ({ ...previous, loading: false, error }))
      }
    })
    return () => { active = false; controller.abort() }
  }, [recipeId, page, revision])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let active = true
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (!active) return
      setMine((previous) => ({ ...previous, loading: true, error: null }))
      try {
        const review = await getMyReview(recipeId, { signal: controller.signal })
        if (active) setMine({ loading: false, error: null, review })
      } catch (error) {
        if (active && !controller.signal.aborted) setMine({ loading: false, error, review: null })
      }
    })
    return () => { active = false; controller.abort() }
  }, [recipeId, isAuthenticated, mineRetry])

  function refreshPublic() { setRevision((value) => value + 1) }

  return <section aria-labelledby={`recipe-reviews-${recipeId}`} className="mt-10 scroll-mt-28 border-t border-forest/10 pt-8 sm:mt-14 sm:pt-10">
    <h2 id={`recipe-reviews-${recipeId}`} className="text-2xl font-bold text-dark-green">Đánh giá món ăn</h2>
    {list.summary && <div className="mt-4 flex flex-wrap items-center gap-3"><strong className="text-2xl text-dark-green">{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(list.summary.averageRating ?? 0)}/5</strong><StarRating value={list.summary.averageRating ?? 0} /><span className="text-sm text-ink/60">{list.summary.reviewCount} lượt đánh giá</span></div>}
    <div className="mt-6">
      {sessionStatus === 'loading' ? <p role="status" className="text-sm text-ink/60">Đang kiểm tra phiên đăng nhập…</p>
        : sessionStatus === 'unknown' ? <ErrorState title="Chưa thể kiểm tra phiên đăng nhập" onRetry={refreshSession} />
          : !isAuthenticated ? <div className="rounded-2xl bg-cream p-5"><p className="mb-3 text-sm leading-6 text-ink/65">Bạn đã nấu món này? Chia sẻ trải nghiệm với cộng đồng SmartCook.</p><Link to="/login" state={{ from: `${location.pathname}${location.search}` }} className="button-secondary">Đăng nhập để đánh giá</Link></div>
            : mine.loading ? <p role="status" className="text-sm text-ink/60">Đang tải đánh giá của bạn…</p>
              : mine.error ? <ErrorState title="Chưa thể tải đánh giá của bạn" error={mine.error} onRetry={() => setMineRetry((value) => value + 1)} />
                : <ReviewForm recipeId={recipeId} review={mine.review} onSaved={(review) => { setMine({ loading: false, error: null, review }); refreshPublic() }} onDeleted={() => { setMine({ loading: false, error: null, review: null }); refreshPublic() }} />}
    </div>
    <div className="mt-7">
      {list.loading ? <div role="status" className="space-y-3"><p className="sr-only">Đang tải đánh giá…</p>{[1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="h-28 rounded-2xl bg-forest/5 motion-safe:animate-pulse" />)}</div>
        : list.error ? <ErrorState title="Chưa thể tải đánh giá" error={list.error} onRetry={refreshPublic} />
          : list.data.length === 0 ? <p role="status" className="rounded-2xl border border-dashed border-forest/20 px-5 py-8 text-center text-sm leading-7 text-ink/65">Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận!</p>
            : <><div className="space-y-4">{list.data.map((review) => <ReviewCard key={review.reviewId} review={review} />)}</div><Pagination pagination={list.pagination} onPageChange={setPage} label="Phân trang đánh giá" /></>}
    </div>
  </section>
}

export default function ReviewList({ recipeId }) {
  const { isAuthenticated, currentUser, sessionGeneration, sessionStatus, refreshSession } = useAuth()
  const key = `${recipeId}:${isAuthenticated ? `${currentUser.userId}:${sessionGeneration}` : 'guest'}`
  return <ReviewContent key={key} recipeId={recipeId} isAuthenticated={isAuthenticated} sessionStatus={sessionStatus} refreshSession={refreshSession} />
}
