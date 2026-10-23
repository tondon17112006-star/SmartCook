import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ChefHat, CircleCheck, CookingPot, Leaf, ShoppingBasket, Sparkles } from 'lucide-react'
import heroImage from '../assets/smartcook-hero.png'
import CategoryCard from '../components/CategoryCard.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import RecipeSkeleton from '../components/RecipeSkeleton.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import useApiResource from '../hooks/useApiResource.js'
import { getCategories, getRecipes } from '../services/catalogService.js'

const steps = [
  { number: '01', icon: ShoppingBasket, title: 'Chọn nguyên liệu bạn có', description: 'Bắt đầu từ những gì có sẵn trong tủ lạnh và căn bếp của bạn.' },
  { number: '02', icon: CookingPot, title: 'Khám phá món ăn phù hợp', description: 'Tìm cảm hứng cho bữa ăn, biết món nào phù hợp và cần thêm gì.' },
  { number: '03', icon: ChefHat, title: 'Nấu ngon và thưởng thức', description: 'Theo từng bước hướng dẫn để tự tay chuẩn bị một bữa ăn ngon.' },
]

export default function HomePage() {
  const categories = useApiResource((signal) => getCategories({ signal }), [])
  const featured = useApiResource((signal) => getRecipes({ limit: 8, sort: 'newest' }, { signal }), [])

  return (
    <>
      <section className="overflow-hidden bg-cream">
        <div className="container-shell grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest/15 bg-white/70 px-4 py-2 text-xs font-semibold text-dark-green"><Leaf size={15} className="text-forest" aria-hidden="true" /> Cảm hứng mới, từ căn bếp quen</p>
            <h1 className="max-w-xl text-[2.75rem] font-bold leading-[1.14] tracking-[-0.045em] text-dark-green sm:text-6xl xl:text-[4.15rem]">Hôm nay bạn muốn <span className="text-forest">nấu món gì?</span></h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-ink/70 sm:text-lg">Khám phá những công thức nấu ăn hấp dẫn từ chính nguyên liệu có sẵn trong căn bếp của bạn.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/recipes" className="button-primary">Khám phá công thức <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link to="/ingredients" className="button-secondary"><ShoppingBasket size={18} aria-hidden="true" /> Tìm món từ nguyên liệu</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/65">
              <span className="inline-flex items-center gap-1.5"><CircleCheck size={15} className="text-forest" aria-hidden="true" /> Công thức gần gũi</span>
              <span className="inline-flex items-center gap-1.5"><CircleCheck size={15} className="text-forest" aria-hidden="true" /> Hướng dẫn từng bước</span>
            </div>
          </div>
          <figure className="hero-image-frame relative mx-auto w-full max-w-xl pb-5 pr-2 lg:pr-0">
            <img src={heroImage} alt="Mâm cơm nhà với trứng chiên, canh cà chua, cơm trắng và rau tươi" className="hero-photo relative z-10 rounded-t-[45%] rounded-b-3xl shadow-[0_20px_55px_-30px_rgba(31,77,58,0.4)]" fetchPriority="high" width="1448" height="1086" />
            <figcaption className="absolute bottom-1 left-3 z-20 flex items-center gap-3 rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-lg shadow-dark-green/5 sm:bottom-3 sm:left-5">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#fff0db] text-[#98601f]"><CookingPot size={21} aria-hidden="true" /></span>
              <span><span className="block text-sm font-semibold text-dark-green">Trọn vị bữa cơm nhà</span><span className="block text-xs text-ink/60">Từ những nguyên liệu giản đơn</span></span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="category-heading" className="container-shell py-16 sm:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><p className="eyebrow mb-3">Mỗi ngày một vị ngon</p><h2 id="category-heading" className="section-title">Bạn muốn thử món nào?</h2><p className="mt-3 text-sm leading-7 text-ink/65">Khám phá công thức theo cách nấu bạn yêu thích.</p></div>
          <Link to="/recipes" className="button-ghost">Tất cả công thức <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
        {categories.loading ? <div role="status" aria-label="Đang tải danh mục" className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-stone-100" />)}<span className="sr-only">Đang tải danh mục…</span></div> : categories.error ? <ErrorState title="Chưa tải được danh mục" error={categories.error} onRetry={categories.retry} /> : categories.data?.data.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.data.data.slice(0, 8).map((category) => <CategoryCard key={category.categoryId} category={category} />)}</div> : <EmptyState title="Danh mục đang được cập nhật" description="Bạn có thể quay lại sau để khám phá các nhóm món ăn." />}
      </section>

      <section aria-labelledby="featured-heading" className="border-y border-stone-100 bg-[#fafbf8] py-16 sm:py-20">
        <div className="container-shell">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div><p className="eyebrow mb-3">Thêm cảm hứng cho bữa nhà</p><h2 id="featured-heading" className="section-title">Món ngon đáng thử</h2><p className="mt-3 text-sm leading-7 text-ink/65">Những công thức mới nhất trong bộ sưu tập SmartCook.</p></div>
            <Link to="/recipes" className="button-secondary">Xem tất cả <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          {featured.loading ? <RecipeSkeleton count={8} /> : featured.error ? <ErrorState title="Chưa tải được công thức" error={featured.error} onRetry={featured.retry} /> : featured.data?.data.length ? <div className="recipe-grid">{featured.data.data.map((recipe) => <RecipeCard key={recipe.recipeId} recipe={recipe} />)}</div> : <EmptyState title="Công thức đang được cập nhật" description="Ghé lại sau để tìm cảm hứng cho bữa ăn của bạn." />}
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="container-shell py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center"><p className="eyebrow mb-3">Từ nguyên liệu đến bữa ngon</p><h2 id="steps-heading" className="section-title">Nấu ăn dễ dàng chỉ với 3 bước</h2><p className="mt-4 text-sm leading-7 text-ink/65">Một hành trình đơn giản để tận dụng căn bếp của bạn.</p></div>
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map(({ number, icon: Icon, title, description }, index) => <div key={number} className="relative text-center">
            {index < 2 && <div className="step-connector absolute top-9 left-[calc(50%+3rem)] hidden w-[calc(100%-4rem)] md:block" aria-hidden="true" />}
            <div className="relative mx-auto flex size-[4.5rem] items-center justify-center rounded-2xl bg-cream text-forest"><Icon size={31} strokeWidth={1.5} aria-hidden="true" /><span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-white">{number}</span></div>
            <h3 className="mt-6 text-lg font-semibold text-dark-green">{title}</h3><p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-ink/65">{description}</p>
          </div>)}
        </div>
        <div className="mt-8 text-center"><Link to="/ingredients" className="button-ghost">Bắt đầu từ nguyên liệu của bạn <ArrowRight size={17} aria-hidden="true" /></Link></div>
      </section>

      <section aria-labelledby="cta-heading" className="container-shell pb-16 sm:pb-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#e9f2e9] px-6 py-12 text-center sm:px-12 sm:py-14">
          <Leaf size={140} strokeWidth={0.7} className="pointer-events-none absolute -bottom-5 -left-6 rotate-45 text-forest/10" aria-hidden="true" />
          <Sparkles size={80} strokeWidth={1} className="pointer-events-none absolute -top-4 -right-3 text-forest/10" aria-hidden="true" />
          <p className="eyebrow mb-3">Căn bếp nhỏ, nhiều ý tưởng</p><h2 id="cta-heading" className="section-title">Không biết hôm nay nấu gì?</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-ink/70">Bắt đầu từ những gì bạn đang có. Để SmartCook đồng hành cùng bạn tìm cảm hứng cho bữa ăn tiếp theo.</p><Link to="/ingredients" className="button-primary mt-7">Khám phá từ nguyên liệu <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  )
}
