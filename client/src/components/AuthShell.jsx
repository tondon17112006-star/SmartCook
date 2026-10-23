import { ChefHat, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AuthShell({ title, description, children }) {
  return (
    <section className="bg-cream py-10 sm:py-16">
      <div className="container-shell grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div className="mx-auto max-w-lg lg:pt-14">
          <span className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl bg-forest/10 text-forest"><ChefHat size={32} aria-hidden="true" /></span>
          <p className="eyebrow">Góc riêng trong căn bếp</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-dark-green sm:text-4xl">{title}</h1>
          <p className="mt-5 leading-8 text-ink/70">{description}</p>
          <p className="mt-7 flex items-start gap-3 text-sm leading-7 text-ink/65"><Leaf className="mt-1 shrink-0 text-forest" size={19} aria-hidden="true" />Bạn luôn có thể khám phá công thức và tìm món từ nguyên liệu mà không cần tài khoản.</p>
          <Link to="/recipes" className="button-ghost mt-4 -ml-3">Khám phá món ăn →</Link>
        </div>
        <div className="surface-card mx-auto w-full max-w-lg p-6 sm:p-9">{children}</div>
      </div>
    </section>
  )
}
