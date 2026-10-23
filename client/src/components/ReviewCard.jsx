import StarRating from './StarRating.jsx'

function dateLabel(value) {
  const date = new Date(value)
  if (!value || !Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(date)
}

export default function ReviewCard({ review }) {
  const date = dateLabel(review.createdAt)
  return <article className="rounded-2xl border border-forest/10 bg-white p-5" aria-label={`Đánh giá của ${review.fullName}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold text-dark-green [overflow-wrap:anywhere]">{review.fullName}</h3>{date && <time dateTime={review.createdAt} className="mt-1 block text-xs text-ink/55">{date}</time>}</div>
      <StarRating value={review.rating} />
    </div>
    {review.comment ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink/80 [overflow-wrap:anywhere]">{review.comment}</p> : <p className="mt-4 text-sm italic text-ink/50">Người dùng chỉ đánh giá số sao.</p>}
  </article>
}
