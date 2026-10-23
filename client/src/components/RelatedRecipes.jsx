import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import useApiResource from '../hooks/useApiResource'
import { getRecipes } from '../services/catalogService'
import ErrorState from './ErrorState'
import RecipeCard from './RecipeCard'
import RecipeSkeleton from './RecipeSkeleton'

export default function RelatedRecipes({ recipe }) {
  const categoryId = recipe.category?.categoryId
  const { data: recipes, loading, error, retry } = useApiResource(async (signal) => {
    const items = new Map()
    const addRecipes = (response) => {
      for (const item of Array.isArray(response?.data) ? response.data : []) {
        if (item.recipeId !== recipe.recipeId && !items.has(item.recipeId)) items.set(item.recipeId, item)
      }
    }
    if (categoryId) addRecipes(await getRecipes({ categoryId, limit: 5, sort: 'newest' }, { signal }))
    if (items.size < 3) addRecipes(await getRecipes({ limit: 5, sort: 'newest' }, { signal }))
    return [...items.values()].slice(0, 4)
  }, [recipe.recipeId, categoryId])

  if (!loading && !error && !recipes?.length) return null

  return (
    <section aria-labelledby="related-recipes" className="mt-16 border-t border-forest/10 pt-12 sm:mt-20 sm:pt-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Thêm ý tưởng cho bữa cơm</p><h2 id="related-recipes" className="mt-2 text-2xl font-bold text-dark-green sm:text-3xl">Có thể bạn cũng thích</h2></div>
        <Link to="/recipes" className="button-ghost">Khám phá món ăn<ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      {loading ? <RecipeSkeleton count={4} />
        : error ? <ErrorState title="Chưa thể tải món ăn liên quan" error={error} onRetry={retry} />
          : <div className="recipe-grid">{recipes.map((item) => <RecipeCard key={item.recipeId} recipe={item} />)}</div>}
    </section>
  )
}
