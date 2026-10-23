import { useEffect, useId, useRef, useState } from 'react'
import useAuth from '../hooks/useAuth.js'
import { createReview, deleteReview, updateReview } from '../services/reviewService.js'
import ReviewCard from './ReviewCard.jsx'
import StarRating from './StarRating.jsx'

function messageFor(error) {
  return typeof error?.response?.data?.message === 'string' ? error.response.data.message : 'Chưa thể lưu thay đổi. Bạn vui lòng thử lại.'
}

function ReviewFormBody({ recipeId, review, onSaved, onDeleted }) {
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [comment, setComment] = useState(review?.comment ?? '')
  const [editing, setEditing] = useState(!review)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const request = useRef(null)
  const busy = useRef(false)
  const mounted = useRef(false)
  const commentId = useId()
  const errorId = useId()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; request.current?.abort() }
  }, [])

  async function perform(action, operation) {
    if (busy.current) return
    busy.current = true
    const controller = new AbortController()
    request.current = controller
    setPending(true); setError(null); setSuccess(null)
    try {
      const result = await operation(controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      if (action === 'delete') {
        setRating(0); setComment(''); setEditing(true); setConfirmDelete(false)
        setSuccess('Đã xóa đánh giá của bạn.')
        onDeleted?.()
      } else {
        setRating(result.rating); setComment(result.comment ?? '')
        setEditing(false)
        setSuccess(review ? 'Đã cập nhật đánh giá.' : 'Đã gửi đánh giá của bạn.')
        onSaved?.(result)
      }
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(messageFor(failure))
    } finally {
      busy.current = false
      if (mounted.current && !controller.signal.aborted) setPending(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setSuccess(null)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { setError('Bạn vui lòng chọn từ 1 đến 5 sao.'); return }
    if (comment.trim().length > 2000) { setError('Bình luận không được vượt quá 2.000 ký tự.'); return }
    const data = { rating, comment: comment.trim() || null }
    await perform('save', (signal) => review ? updateReview(review.reviewId, data, { signal }) : createReview(recipeId, data, { signal }))
  }

  return <div className="rounded-2xl border border-forest/15 bg-cream/60 p-5 sm:p-6">
    <h3 className="text-lg font-bold text-dark-green">{review ? 'Đánh giá của bạn' : 'Chia sẻ cảm nhận của bạn'}</h3>
    {error && <p id={errorId} role="alert" className="mt-4 rounded-xl border border-red-200 bg-white p-3 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="mt-4 text-sm font-semibold text-forest">{success}</p>}
    {review && !editing ? <div className="mt-4"><ReviewCard review={review} /><div className="mt-4 flex flex-wrap gap-3"><button type="button" className="button-secondary" disabled={pending} onClick={() => { setEditing(true); setSuccess(null); setError(null) }}>Chỉnh sửa đánh giá</button><button type="button" className="min-h-11 px-3 text-sm font-semibold text-red-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest" disabled={pending} onClick={() => setConfirmDelete(true)}>Xóa đánh giá</button></div></div>
      : <form className="mt-4 space-y-4" onSubmit={submit} noValidate aria-describedby={error ? errorId : undefined}>
        <StarRating value={rating} onChange={setRating} disabled={pending} />
        <div><label htmlFor={commentId} className="text-sm font-semibold text-dark-green">Bình luận <span className="font-normal text-ink/55">(không bắt buộc)</span></label><textarea id={commentId} name="comment" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} disabled={pending} className="field mt-2 min-h-28 w-full resize-y" placeholder="Món ăn này có hợp khẩu vị của bạn không?" aria-describedby={`${commentId}-hint`} /><p id={`${commentId}-hint`} className={`mt-1 text-xs ${comment.trim().length > 2000 ? 'text-red-800' : 'text-ink/55'}`}>{comment.trim().length}/2.000 ký tự. Mỗi tài khoản có một đánh giá cho món ăn.</p></div>
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending} className="button-primary">{pending ? 'Đang lưu…' : review ? 'Lưu đánh giá' : 'Gửi đánh giá'}</button>{review && <button type="button" disabled={pending} className="button-secondary" onClick={() => { setRating(review.rating); setComment(review.comment ?? ''); setEditing(false); setError(null) }}>Hủy chỉnh sửa</button>}</div>
      </form>}
    {confirmDelete && <div className="mt-4 rounded-xl border border-red-200 bg-white p-4" role="group" aria-label="Xác nhận xóa đánh giá"><p className="text-sm text-ink">Bạn có muốn xóa đánh giá này?</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={pending} className="button-primary" onClick={() => perform('delete', (signal) => deleteReview(review.reviewId, { signal }))}>{pending ? 'Đang xóa…' : 'Xác nhận xóa'}</button><button type="button" disabled={pending} className="button-secondary" onClick={() => setConfirmDelete(false)}>Giữ đánh giá</button></div></div>}
  </div>
}

export default function ReviewForm(props) {
  const { isAuthenticated, currentUser, sessionGeneration } = useAuth()
  if (!isAuthenticated) return null
  // Keying the editable form removes another account's draft immediately and
  // aborts pending CSRF/mutations before a newly logged-in session can use it.
  return <ReviewFormBody key={`${currentUser.userId}:${sessionGeneration}:${props.recipeId}`} {...props} />
}
