export default function MatchProgress({ percentage }) {
  const value = Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0
  const tone = value === 100
    ? { text: 'text-forest', track: 'bg-forest/10', fill: 'bg-forest' }
    : value >= 50
      ? { text: 'text-amber-800', track: 'bg-amber-100', fill: 'bg-orange' }
      : { text: 'text-ink/70', track: 'bg-stone-100', fill: 'bg-stone-400' }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-ink/70">Mức độ phù hợp</span>
        <span className={`font-bold tabular-nums ${tone.text}`}>{value}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Tỷ lệ phù hợp theo loại nguyên liệu bắt buộc"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}% phù hợp theo loại nguyên liệu bắt buộc`}
        className={`h-2 overflow-hidden rounded-full ${tone.track}`}
      >
        <div className={`h-full rounded-full ${tone.fill}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
