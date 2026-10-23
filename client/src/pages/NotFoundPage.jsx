import { ArrowLeft, ArrowRight, CookingPot } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="container-shell py-16 text-center sm:py-24">
      <div className="mx-auto max-w-xl">
        <span className="mx-auto flex size-24 items-center justify-center rounded-full border border-dashed border-forest/30 bg-forest/5 text-forest"><CookingPot size={46} strokeWidth={1.5} aria-hidden="true" /></span>
        <p className="eyebrow mt-7">Lỗi 404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-dark-green sm:text-4xl">Có vẻ bạn đã đi lạc khỏi căn bếp.</h1>
        <p className="mt-5 text-base leading-8 text-ink/65">Trang bạn tìm không tồn tại. Cùng trở lại SmartCook và tìm thêm một món ngon nhé.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="button-primary"><ArrowLeft size={18} aria-hidden="true" />Về trang chủ</Link>
          <Link to="/recipes" className="button-secondary">Khám phá món ăn<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  )
}
