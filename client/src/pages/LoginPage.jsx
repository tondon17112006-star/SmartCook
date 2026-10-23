import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import AuthFormField from '../components/AuthFormField.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import useAuth from '../hooks/useAuth.js'
import { authErrorMessage, focusFirstError, normalizeEmail, safeReturnPath, validateLogin } from '../utilities/authForms.js'

export default function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const formRef = useRef(null)
  const mounted = useRef(false)
  const [values, setValues] = useState({ email: typeof location.state?.email === 'string' ? location.state.email : '', password: '' })
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
    const nextErrors = validateLogin(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { focusFirstError(formRef.current, nextErrors); return }
    setPending(true); setFailure('')
    try {
      await auth.login({ email: normalizeEmail(values.email), password: values.password })
      // The shared provider still reconciles a legitimate login response, but
      // an abandoned form must not replace the user's newer navigation.
      if (!mounted.current) return
      setValues((current) => ({ ...current, password: '' }))
      navigate(destination, { replace: true })
    } catch (error) { if (mounted.current) setFailure(authErrorMessage(error)) }
    finally { if (mounted.current) setPending(false) }
  }
  return (
    <AuthShell title="Chào mừng bạn trở lại." description="Đăng nhập để quản lý hồ sơ và tiếp tục hành trình vào bếp cùng SmartCook.">
      {location.state?.registered && <p role="status" className="mb-6 rounded-xl bg-forest/10 p-4 text-sm leading-7 text-dark-green">Đăng ký thành công. Hãy đăng nhập bằng tài khoản vừa tạo.</p>}
      {location.state?.sessionExpired && <p role="status" className="mb-6 rounded-xl bg-orange/15 p-4 text-sm leading-7">Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại để tiếp tục.</p>}
      <h2 className="text-xl font-bold text-dark-green">Đăng nhập</h2>
      <form ref={formRef} onSubmit={submit} noValidate className="mt-6 space-y-5" aria-busy={pending}>
        <AuthFormField label="Email" name="email" type="email" autoComplete="username" inputMode="email" value={values.email} onChange={change} error={errors.email} disabled={pending} required />
        <AuthFormField label="Mật khẩu" name="password" type="password" autoComplete="current-password" value={values.password} onChange={change} error={errors.password} disabled={pending} required />
        {failure && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{failure}</p>}
        <button className="button-primary w-full" type="submit" disabled={pending}><LogIn size={18} aria-hidden="true" />{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      <p className="mt-5 text-xs leading-6 text-ink/60">Phiên đăng nhập có thời hạn 15 phút. Hãy đăng nhập lại khi phiên kết thúc.</p>
      <p className="mt-6 border-t border-stone-100 pt-5 text-center text-sm text-ink/70">Chưa có tài khoản? <Link className="font-semibold text-forest underline-offset-4 hover:underline" to="/register" state={{ from: destination }}>Đăng ký ngay</Link></p>
    </AuthShell>
  )
}
