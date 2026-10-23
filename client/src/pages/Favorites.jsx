import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Pagination from '../components/Pagination.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import RecipeSkeleton from '../components/RecipeSkeleton.jsx'
import useFavorites from '../hooks/useFavorites.js'
import { getFavorites } from '../services/favoriteService.js'

export default function Favorites() {
  const { key: accountKey, isReady, isLoading: idsLoading, error: idsError, reload, revision, ids } = useFavorites()
  const [pageState, setPageState] = useState({ accountKey: null, page: 1 })
  const page = pageState.accountKey === accountKey ? pageState.page : 1
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState({ accountKey: null, data: [], pagination: null, loading: true, error: null })

  useEffect(() => {
    if (!isReady || !accountKey) return undefined
    const controller = new AbortController()
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setResult((previous) => ({ ...previous, accountKey, loading: true, error: null }))
      try {
        const response = await getFavorites({ page, limit: 12, signal: controller.signal })
        if (!active) return
        if (page > 1 && response.data.length === 0) { setPageState({ accountKey, page: Math.max(1, response.pagination.totalPages) }); return }
        setResult({ accountKey, data: response.data, pagination: response.pagination, loading: false, error: null })
      } catch (error) {
        if (active && !controller.signal.aborted) setResult({ accountKey, data: [], pagination: null, loading: false, error })
      }
    })
    return () => { active = false; controller.abort() }
  }, [accountKey, isReady, page, revision, retry])

  const loading = idsLoading || !isReady || result.accountKey !== accountKey || result.loading
  const visibleRecipes = result.data.filter((recipe) => ids.has(recipe.recipeId))
  const error = idsError || result.error

  return <section className="container-shell py-10 sm:py-14">
    <div className="mb-8 flex items-start gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-forest/8 text-forest"><Heart size={26} aria-hidden="true" /></span>
      <div><p className="eyebrow">Công thức bạn muốn nấu lại</p><h1 className="mt-2 text-3xl font-bold text-dark-green sm:text-4xl">Món ăn yêu thích</h1><p className="mt-3 text-sm leading-7 text-ink/65">Lưu những món ngon vào bộ sưu tập riêng, để mỗi lần vào bếp đều có cảm hứng.</p></div>
    </div>
    {error ? <ErrorState title="Chưa thể tải món yêu thích" error={error} onRetry={idsError ? reload : () => setRetry((value) => value + 1)} />
      : loading ? <RecipeSkeleton count={6} />
        : visibleRecipes.length === 0 ? <EmptyState title="Bạn chưa lưu món ăn nào" description="Nhấn trái tim trên công thức bạn thích để tìm lại nhanh hơn ở đây." action={<Link to="/recipes" className="button-primary">Khám phá công thức</Link>} />
          : <><p className="mb-5 text-sm text-ink/65" role="status">{result.pagination?.total ?? ids.size} món ăn đã lưu</p><div className="recipe-grid">{visibleRecipes.map((recipe) => <RecipeCard key={recipe.recipeId} recipe={recipe} confirmFavoriteRemoval />)}</div><Pagination pagination={result.pagination} onPageChange={(nextPage) => setPageState({ accountKey, page: nextPage })} /></>}
  </section>
}
