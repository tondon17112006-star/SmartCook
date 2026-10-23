import { CookingPot, Sprout } from 'lucide-react'
import { useState } from 'react'

export default function RecipeImage({ src, alt, className = '' }) {
  const [failedSource, setFailedSource] = useState(null)
  const showImage = Boolean(src) && failedSource !== src

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-[#F0F0E6] ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(src)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 py-6 text-forest/65" role="img" aria-label={`${alt}. Ảnh đang cập nhật.`}>
          <div className="relative flex size-20 items-center justify-center rounded-full bg-white/65" aria-hidden="true">
            <CookingPot size={40} strokeWidth={1.25} />
            <Sprout size={23} strokeWidth={1.3} className="absolute -right-1 top-0 rotate-12" />
          </div>
          <span className="text-xs font-medium tracking-wide">Ảnh đang cập nhật</span>
        </div>
      )}
    </div>
  )
}
