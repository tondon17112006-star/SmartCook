// Match the server's validation rules while keeping password bytes unchanged.
export function normalizeFullName(value) { return String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ') }
export function normalizeEmail(value) { return String(value ?? '').normalize('NFC').trim().toLowerCase() }

export function validateFullName(value) {
  const name = normalizeFullName(value)
  return name.length < 2 || name.length > 150 || /[\p{Cc}\p{Cf}<>]/u.test(name) || !/\p{L}/u.test(name)
    ? 'Họ tên phải từ 2 đến 150 ký tự hợp lệ.' : ''
}
export function validateEmail(value) {
  const email = normalizeEmail(value)
  return email.length > 255 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/u.test(email)
    || email.startsWith('.') || email.includes('..') || email.includes('.@')
    ? 'Vui lòng nhập địa chỉ email hợp lệ.' : ''
}
export function validatePassword(value) {
  return typeof value !== 'string' || [...value].length < 12 || [...value].length > 1024
    || new TextEncoder().encode(value).length > 4096 || value.includes('\u0000')
    ? 'Mật khẩu phải có từ 12 đến 1024 ký tự, tối đa 4096 byte.' : ''
}
export function normalizePhone(value) { return String(value ?? '').trim() || null }
export function validatePhone(value) {
  const phone = normalizePhone(value)
  return phone && (phone.length > 20 || !/^\+?[0-9][0-9 ()-]{5,18}[0-9]$/u.test(phone))
    ? 'Số điện thoại phải từ 7 đến 20 ký tự gồm chữ số, dấu +, khoảng trắng, () hoặc -.' : ''
}
export function validateLogin(values) {
  return Object.fromEntries(Object.entries({ email: validateEmail(values.email), password: validatePassword(values.password) }).filter(([, message]) => message))
}
export function validateRegister(values) {
  const errors = { ...validateLogin(values), fullName: validateFullName(values.fullName), confirmPassword: values.confirmPassword === values.password ? '' : 'Mật khẩu xác nhận chưa khớp.' }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}
export function validateProfile(values) {
  return Object.fromEntries(Object.entries({ fullName: validateFullName(values.fullName), phone: validatePhone(values.phone) }).filter(([, message]) => message))
}

// Router state is untrusted. Never pass an external or ambiguous destination to navigate.
export function safeReturnPath(from, fallback = '/profile') {
  const candidate = typeof from === 'string' ? from : from && typeof from === 'object'
    ? `${from.pathname ?? ''}${from.search ?? ''}${from.hash ?? ''}` : ''
  if (candidate.length > 2048) return fallback
  let decoded = candidate
  try {
    for (let count = 0; count < 3; count += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch { return fallback }
  for (const path of [candidate, decoded]) {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\p{Cc}\p{Cf}]/u.test(path)
      || /^\/(?:login|register)(?:[/?#]|$)/iu.test(path)) return fallback
    try {
      const target = new URL(path, 'https://smartcook.invalid')
      if (target.origin !== 'https://smartcook.invalid' || /^\/(?:login|register)(?:\/|$)/iu.test(target.pathname)) return fallback
    } catch { return fallback }
  }
  return candidate
}

export function authErrorMessage(error) {
  if (typeof error?.response?.data?.message === 'string') return error.response.data.message
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'Yêu cầu mất nhiều thời gian hơn dự kiến. Vui lòng thử lại.'
  if (!error?.response) return 'Chưa thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.'
  return 'Chưa thể thực hiện yêu cầu. Vui lòng thử lại sau.'
}

export function focusFirstError(form, errors) {
  const first = Object.keys(errors)[0]
  form?.elements.namedItem(first)?.focus()
}
