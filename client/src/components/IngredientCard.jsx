import { Check, Plus, Sprout } from 'lucide-react'
import { useState } from 'react'

export default function IngredientCard({ ingredient, selected = false, disabled = false, onToggle }) {
  const [failedSource, setFailedSource] = useState(null)
  const showImage = Boolean(ingredient.imageUrl) && failedSource !== ingredient.imageUrl

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? 'Bỏ chọn' : 'Chọn'} ${ingredient.ingredientName}`}
      disabled={disabled}
      onClick={() => onToggle(ingredient.ingredientId)}
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border-2 text-left transition-colors disabled:opacity-60 ${selected ? 'border-forest bg-forest/5' : 'border-stone-100 bg-white hover:border-forest/40 hover:bg-cream'}`}
    >
      <div className="relative flex aspect-[1.7] w-full items-center justify-center overflow-hidden bg-[#F0F0E6]">
        {showImage ? (
          <img
            src={ingredient.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedSource(ingredient.imageUrl)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-white/65 text-forest/65" aria-hidden="true">
            <Sprout size={29} strokeWidth={1.4} />
          </span>
        )}
        <span className={`absolute right-2 top-2 flex size-7 items-center justify-center rounded-full shadow-sm ${selected ? 'bg-forest text-white' : 'bg-white text-forest/70'}`} aria-hidden="true">
          {selected ? <Check size={17} strokeWidth={2.5} /> : <Plus size={16} />}
        </span>
      </div>
      <span className="flex w-full flex-1 flex-col px-3 py-3 sm:px-4">
        <span className="text-sm font-semibold leading-6 text-dark-green [overflow-wrap:anywhere]">{ingredient.ingredientName}</span>
        <span className="mt-1 text-xs leading-5 text-ink/55 [overflow-wrap:anywhere]">{ingredient.ingredientCategory}</span>
      </span>
    </button>
  )
}
