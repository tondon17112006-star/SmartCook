import { ArrowUpRight, Soup } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function CategoryCard({ category }) {
  const [failedSource, setFailedSource] = useState(null)
  const showImage = Boolean(category.imageUrl) && failedSource !== category.imageUrl

  return (
    <Link
      to={`/recipes?categoryId=${encodeURIComponent(category.categoryId)}`}
      className="group surface-card flex h-full items-center gap-4 p-4 transition duration-200 hover:border-forest/35 hover:bg-cream hover:shadow-sm sm:p-5"
      aria-label={`Khám phá danh mục ${category.categoryName}`}
    >
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-forest/8 text-forest" aria-hidden="true">
        {showImage ? (
          <img src={category.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedSource(category.imageUrl)} className="h-full w-full object-cover" />
        ) : <Soup size={27} strokeWidth={1.4} />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold leading-relaxed text-ink sm:text-base">{category.categoryName}</h3>
        {category.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink/60">{category.description}</p>
        )}
      </div>
      <ArrowUpRight size={17} aria-hidden="true" className="shrink-0 text-forest/65 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </Link>
  )
}
