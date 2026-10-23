import { useState } from 'react'

function avatarSource(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\\')
    || Array.from(value).some((character) => character.charCodeAt(0) <= 32)) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    if (value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/iu.test(value)) return null
    return value
  }
}

export default function UserAvatar({ user, className = '' }) {
  const [failedSource, setFailedSource] = useState(null)
  const source = avatarSource(user?.avatar ?? user?.avatarUrl)
  const name = user?.fullName?.trim() || 'Người dùng'
  const initials = name.split(/\s+/u).slice(-2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase('vi-VN')
  return (
    <span className={`inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest/10 text-sm font-bold text-dark-green ${className}`}>
      {source && failedSource !== source
        ? <img src={source} alt={`Ảnh đại diện của ${name}`} referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setFailedSource(source)} />
        : <span role="img" aria-label={`Ảnh đại diện của ${name}`}>{initials}</span>}
    </span>
  )
}
