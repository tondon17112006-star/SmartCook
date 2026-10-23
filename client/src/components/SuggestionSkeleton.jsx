export default function SuggestionSkeleton({ count = 6 }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Đang tìm các món phù hợp với nguyên liệu bạn chọn…</span>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="surface-card overflow-hidden motion-safe:animate-pulse">
            <div className="aspect-[16/10] bg-forest/8" />
            <div className="space-y-4 p-5 sm:p-6">
              <div className="h-3 w-1/3 rounded bg-forest/8" />
              <div className="h-6 w-4/5 rounded bg-forest/10" />
              <div className="flex gap-4"><div className="h-3 w-1/3 rounded bg-forest/8" /><div className="h-3 w-1/4 rounded bg-forest/8" /></div>
              <div className="h-2 w-full rounded bg-forest/10" />
              <div className="h-9 w-full rounded-xl bg-forest/8" />
              <div className="space-y-2 border-t border-stone-100 pt-4"><div className="h-3 w-1/3 rounded bg-forest/10" /><div className="h-3 w-4/5 rounded bg-forest/8" /><div className="h-3 w-3/5 rounded bg-forest/8" /></div>
              <div className="space-y-2 border-t border-stone-100 pt-4"><div className="h-3 w-1/3 rounded bg-forest/10" /><div className="h-3 w-3/5 rounded bg-forest/8" /></div>
              <div className="h-10 w-full rounded-xl bg-forest/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
