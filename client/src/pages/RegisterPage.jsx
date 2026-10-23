import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { UserRoundPlus } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import AuthFormField from '../components/AuthFormField.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import useAuth from '../hooks/useAuth.js'
import { authErrorMessage, focusFirstError, normalizeEmail, normalizeFullName, safeReturnPath, validateRegister } from '../utilities/authForms.js'

export default function RegisterPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const formRef = useRef(null)
  const mounted = useRef(false)
  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const destination = safeReturnPath(location.state?.from)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  if (auth.isLoading) return <LoadingSpinner label="Đang kiểm tra phiên đăng nhập…" />
  if (auth.isAuthenticated) return <Navigate to={destination} replace />
  function change(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFailure('')
  }
  async function submit(event) {
    event.preventDefault()
    if (pending) return
    const nextErrors = validateRegister(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { focusFirstError(formRef.current, nextErrors); return }
    setPending(true); setFailure('')
    try {
      const email = normalizeEmail(values.email)
      await auth.register({ fullName: normalizeFullName(values.fullName), email, password: values.password })
      if (!mounted.current) return
      setValues((current) => ({ ...current, password: '', confirmPassword: '' }))
      navigate('/login', { replace: true, state: { registered: true, email, from: destination } })
    } catch (error) { if (mounted.current) setFailure(authErrorMessage(error)) }
    finally { if (mounted.current) setPending(false) }
  }
  return (
    <AuthShell title="Bắt đầu hành trình yêu bếp." description="Tạo tài khoản SmartCook để có một góc riêng cho thông tin và trải nghiệm của bạn.">
      <h2 className="text-xl font-bold text-dark-green">Tạo tài khoản</h2>
      <form ref={formRef} onSubmit={submit} noValidate className="mt-6 space-y-5" aria-busy={pending}>
        <AuthFormField label="Họ và tên" name="fullName" autoComplete="name" value={values.fullName} onChange={change} error={errors.fullName} disabled={pending} required />
        <AuthFormField label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={values.email} onChange={change} error={errors.email} disabled={pending} required />
        <AuthFormField label="Mật khẩu" name="password" type="password" autoComplete="new-password" value={values.password} onChange={change} error={errors.password} hint="Dùng cụm mật khẩu từ 12 đến 1024 ký tự. Khoảng trắng và tiếng Việt được giữ nguyên." disabled={pending} required />
        <AuthFormField label="Xác nhận mật khẩu" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} disabled={pending} required />
        {failure && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{failure}</p>}
        <button className="button-primary w-full" type="submit" disabled={pending}><UserRoundPlus size={18} aria-hidden="true" />{pending ? 'Đang tạo tài khoản…' : 'Đăng ký'}</button>
      </form>
      <p className="mt-6 border-t border-stone-100 pt-5 text-center text-sm text-ink/70">Đã có tài khoản? <Link className="font-semibold text-forest underline-offset-4 hover:underline" to="/login" state={{ from: destination }}>Đăng nhập</Link></p>
    </AuthShell>
  )
}
