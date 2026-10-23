export default function RecipeSkeleton({ count = 8 }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Đang tải các công thức nấu ăn…</span>
      <div className="recipe-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="surface-card overflow-hidden motion-safe:animate-pulse">
            <div className="aspect-[4/3] bg-forest/8" />
            <div className="space-y-3 p-5">
              <div className="h-3 w-1/3 rounded bg-forest/8" />
              <div className="h-5 w-4/5 rounded bg-forest/10" />
              <div className="flex gap-4 pt-3"><div className="h-3 w-1/3 rounded bg-forest/8" /><div className="h-3 w-1/4 rounded bg-forest/8" /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
