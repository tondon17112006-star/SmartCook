import { ArrowLeft, ArrowRight, ChefHat, Heart, Leaf, LockKeyhole, ShieldCheck, Sparkles, UserRound, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router-dom'

const upcomingPages = {
  ingredients: {
    Icon: Leaf,
    label: 'Tìm món từ nguyên liệu',
    title: 'Căn bếp của bạn sắp có thêm trợ thủ.',
    description: 'Tính năng chọn nguyên liệu đang được hoàn thiện. Sắp tới, bạn có thể cho SmartCook biết căn bếp đang có gì để tìm những món ăn phù hợp.',
    detail: 'Trong lúc chờ, hãy khám phá công thức và xem nguyên liệu cần chuẩn bị cho từng món.',
  },
  suggestions: {
    Icon: Sparkles,
    label: 'Gợi ý món ăn',
    title: 'Một chút cảm hứng, thật nhiều món ngon.',
    description: 'Trang gợi ý theo nguyên liệu đang được hoàn thiện. Khi ra mắt, bạn sẽ xem được mức độ phù hợp cùng những nguyên liệu đã có và còn thiếu.',
    detail: 'Bạn vẫn có thể tìm món theo tên, danh mục, thời gian và độ khó tại trang khám phá.',
  },
  login: {
    Icon: LockKeyhole,
    label: 'Đăng nhập',
    title: 'Góc riêng của bạn đang được chuẩn bị.',
    description: 'Tính năng đăng nhập chưa mở ở giai đoạn này. SmartCook sẽ sớm có tài khoản để bạn lưu lại hành trình vào bếp của mình.',
    detail: 'Bạn có thể xem công thức và khám phá món ăn ngay bây giờ mà không cần tài khoản.',
  },
  register: {
    Icon: UserRoundPlus,
    label: 'Đăng ký',
    title: 'Hẹn bạn trong cộng đồng yêu bếp.',
    description: 'Tính năng tạo tài khoản đang được chuẩn bị. Đăng ký sẽ được mở khi các chức năng tài khoản sẵn sàng.',
    detail: 'Trong lúc chờ, cùng SmartCook tìm thêm cảm hứng cho bữa cơm hôm nay.',
  },
  favorites: {
    Icon: Heart,
    label: 'Món yêu thích',
    title: 'Một nơi cho những món bạn muốn nấu lại.',
    description: 'Tính năng lưu món yêu thích chưa mở ở giai đoạn này. Trong giai đoạn tiếp theo, bạn sẽ có thể tạo bộ sưu tập công thức của riêng mình.',
    detail: 'Hãy tiếp tục khám phá và chọn một món mới cho bữa ăn hôm nay.',
  },
  profile: {
    Icon: UserRound,
    label: 'Hồ sơ cá nhân',
    title: 'Không gian riêng cho người yêu bếp.',
    description: 'Trang hồ sơ cá nhân đang được chuẩn bị cùng các chức năng tài khoản. Bạn chưa cần cung cấp thông tin cá nhân ở giai đoạn này.',
    detail: 'Các công thức nấu ăn hiện có luôn sẵn sàng để bạn khám phá.',
  },
  admin: {
    Icon: ShieldCheck,
    label: 'Quản trị',
    title: 'Khu vực quản trị đang được phát triển.',
    description: 'Các công cụ quản lý sẽ được triển khai cùng xác thực và phân quyền tài khoản trong giai đoạn sau.',
    detail: 'Hiện tại, bạn có thể xem nội dung công khai tại trang khám phá món ăn.',
  },
}

export default function ComingSoonPage({ kind = 'ingredients' }) {
  const { Icon, label, title, description, detail } = upcomingPages[kind] ?? upcomingPages.ingredients

  return (
    <section className="container-shell py-12 sm:py-20">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-forest/10 bg-white px-6 py-12 text-center sm:px-14 sm:py-16">
        <span className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-forest/10 text-forest"><Icon size={38} strokeWidth={1.5} aria-hidden="true" /></span>
        <p className="eyebrow mt-7">{label}</p>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange/15 px-3 py-1 text-xs font-semibold text-dark-green"><span className="size-1.5 rounded-full bg-orange" aria-hidden="true" />Đang phát triển</span>
        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-dark-green sm:text-4xl">{title}</h1>
        <p className="mt-5 text-base leading-8 text-ink/70">{description}</p>
        <p className="mt-3 text-sm leading-7 text-ink/60">{detail}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/recipes" className="button-primary"><ChefHat size={18} aria-hidden="true" />Khám phá món ăn<ArrowRight size={17} aria-hidden="true" /></Link>
          <Link to="/" className="button-secondary"><ArrowLeft size={17} aria-hidden="true" />Về trang chủ</Link>
        </div>
      </div>
    </section>
  )
}
