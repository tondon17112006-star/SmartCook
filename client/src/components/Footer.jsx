import { ArrowUpRight, ChefHat, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

const currentYear = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="bg-dark-green text-white">
      <div className="container-shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 text-2xl font-bold"><ChefHat size={29} aria-hidden="true" /> SmartCook</Link>
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/75">Một chút cảm hứng cho căn bếp mỗi ngày.<br />Nấu món ngon từ những nguyên liệu quen thuộc.</p>
          <p className="mt-5 flex items-center gap-2 text-xs text-white/65"><Leaf size={15} aria-hidden="true" /> Tận dụng nguyên liệu, trọn vị bữa nhà.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Khám phá SmartCook</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><Link to="/recipes" className="hover:text-white hover:underline">Công thức nấu ăn</Link></li>
            <li><Link to="/ingredients" className="hover:text-white hover:underline">Tìm món từ nguyên liệu</Link></li>
            <li><Link to="/favorites" className="hover:text-white hover:underline">Món ăn yêu thích</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Căn bếp của bạn</h2>
          <p className="mt-4 max-w-xs text-sm leading-7 text-white/75">Tìm một công thức mới cho bữa cơm hôm nay.</p>
          <Link to="/recipes" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#ffbe7c] hover:underline">Bắt đầu khám phá <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="container-shell border-t border-white/15 py-6 text-xs text-white/60">© {currentYear} SmartCook. Cảm hứng từ căn bếp Việt.</div>
    </footer>
  )
}
