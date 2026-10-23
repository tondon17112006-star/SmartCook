import { ArrowUpRight, ChartNoAxesColumnIncreasing, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import RecipeImage from './RecipeImage'
import FavoriteButton from './FavoriteButton.jsx'

export default function RecipeCard({ recipe, confirmFavoriteRemoval = false }) {
  return (
    <article className="relative h-full">
      <Link
        to={`/recipes/${recipe.recipeId}`}
        aria-label={`Xem công thức ${recipe.recipeName}`}
        className="group surface-card flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"
      >
        <RecipeImage src={recipe.imageUrl} alt={recipe.recipeName} className="aspect-[4/3] w-full" />
        <div className="flex flex-1 flex-col p-5">
          <p className="mb-2 text-xs font-semibold text-forest">{recipe.categoryName}</p>
          <h3 className="text-lg font-bold leading-snug text-ink transition-colors group-hover:text-forest">{recipe.recipeName}</h3>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-sm text-ink/65">
            <span className="inline-flex items-center gap-1.5"><Clock3 size={15} aria-hidden="true" />{recipe.totalTime} phút</span>
            <span className="inline-flex items-center gap-1.5"><ChartNoAxesColumnIncreasing size={15} aria-hidden="true" />{recipe.difficulty}</span>
          </div>
          <span className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4 text-sm font-semibold text-forest">Xem công thức <ArrowUpRight size={18} aria-hidden="true" className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" /></span>
        </div>
      </Link>
      <FavoriteButton recipeId={recipe.recipeId} recipeName={recipe.recipeName} confirmRemoval={confirmFavoriteRemoval} className="absolute right-3 top-3 z-10 flex flex-col items-end" />
    </article>
  )
}
