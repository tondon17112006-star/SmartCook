import { useRef, useState } from 'react'
import { Save, ShieldCheck, UserRound } from 'lucide-react'
import UserAvatar from '../components/UserAvatar.jsx'
import AuthFormField from '../components/AuthFormField.jsx'
import useAuth from '../hooks/useAuth.js'
import { authErrorMessage, focusFirstError, normalizeFullName, normalizePhone, validateProfile } from '../utilities/authForms.js'

function formatDate(value) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(date) : 'Chưa có thông tin'
}

export default function ProfilePage() {
  const { currentUser, updateProfile } = useAuth()
  const formRef = useRef(null)
  const [values, setValues] = useState({ fullName: currentUser?.fullName ?? '', phone: currentUser?.phone ?? '' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)
  function change(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFailure(''); setSuccess('')
  }
  async function submit(event) {
    event.preventDefault()
    if (pending) return
    const nextErrors = validateProfile(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { focusFirstError(formRef.current, nextErrors); return }
    setPending(true); setFailure(''); setSuccess('')
    try {
      const updated = await updateProfile({ fullName: normalizeFullName(values.fullName), phone: normalizePhone(values.phone) })
      setValues({ fullName: updated.fullName, phone: updated.phone ?? '' })
      setSuccess('Đã cập nhật hồ sơ của bạn.')
    } catch (error) { setFailure(authErrorMessage(error)) }
    finally { setPending(false) }
  }
  if (!currentUser) return null
  return (
    <section className="container-shell py-10 sm:py-14">
      <p className="eyebrow">Tài khoản của bạn</p>
      <h1 className="section-title mt-3">Hồ sơ cá nhân</h1>
      <p className="mt-4 max-w-2xl leading-8 text-ink/65">Một góc nhỏ để bạn cập nhật thông tin của mình trên SmartCook.</p>
      <div className="mt-9 grid items-start gap-7 lg:grid-cols-[.8fr_1.4fr]">
        <aside className="surface-card p-6 sm:p-8">
          <UserAvatar user={currentUser} className="size-20 text-2xl" />
          <h2 className="mt-5 break-words text-xl font-bold text-dark-green">{currentUser.fullName}</h2>
          <p className="mt-2 break-all text-sm text-ink/65">{currentUser.email}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest/10 px-3 py-1.5 text-sm font-semibold text-dark-green">{currentUser.role === 'Admin' ? <ShieldCheck size={16} aria-hidden="true" /> : <UserRound size={16} aria-hidden="true" />}{currentUser.role === 'Admin' ? 'Quản trị viên' : 'Người dùng'}</span>
          <dl className="mt-7 border-t border-stone-100 pt-5 text-sm leading-7"><dt className="text-ink/60">Tham gia từ</dt><dd className="font-medium text-dark-green">{formatDate(currentUser.createdAt)}</dd></dl>
          <p className="mt-6 text-xs leading-6 text-ink/60">Ảnh đại diện, email và vai trò được hiển thị theo thông tin tài khoản hiện tại.</p>
        </aside>
        <div className="surface-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-dark-green">Thông tin cá nhân</h2>
          <form ref={formRef} onSubmit={submit} noValidate className="mt-6 space-y-5" aria-busy={pending}>
            <AuthFormField label="Họ và tên" name="fullName" autoComplete="name" value={values.fullName} onChange={change} error={errors.fullName} disabled={pending} required />
            <AuthFormField label="Số điện thoại" name="phone" type="tel" autoComplete="tel" value={values.phone} onChange={change} error={errors.phone} hint="Không bắt buộc. Để trống nếu bạn chưa muốn cung cấp." disabled={pending} />
            <AuthFormField label="Email tài khoản" name="accountEmail" type="email" autoComplete="email" value={currentUser.email} readOnly hint="Địa chỉ email hiện chưa hỗ trợ thay đổi." />
            {failure && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{failure}</p>}
            {success && <p role="status" className="rounded-xl bg-forest/10 p-4 text-sm leading-7 text-dark-green">{success}</p>}
            <button type="submit" disabled={pending} className="button-primary w-full sm:w-auto"><Save size={18} aria-hidden="true" />{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
          </form>
        </div>
      </div>
    </section>
  )
}
