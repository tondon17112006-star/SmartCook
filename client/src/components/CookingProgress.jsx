export default function CookingProgress({ completed, total }) {
  const validTotal = Number.isInteger(total) && total > 0 ? total : 0
  const validCompleted = Math.min(validTotal, Math.max(0, Number.isInteger(completed) ? completed : 0))
  const percentage = validTotal ? Math.round(validCompleted / validTotal * 100) : 0

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-dark-green" aria-live="polite" aria-atomic="true">{validCompleted}/{validTotal} bước đã hoàn thành – {percentage}%</p>
      <div role="progressbar" aria-label="Tiến độ nấu ăn" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${validCompleted} trên ${validTotal} bước đã hoàn thành`} className="h-2.5 overflow-hidden rounded-full bg-forest/10">
        <div className="h-full rounded-full bg-forest transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
