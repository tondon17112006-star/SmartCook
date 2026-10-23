import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthFormField({ label, name, type = 'text', error, hint, ...props }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const password = type === 'password'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-dark-green">{label}</label>
      <div className="relative">
        <input {...props} id={id} name={name} type={password && visible ? 'text' : type} className={`field ${password ? 'pr-14' : ''} ${error ? 'border-red-600' : ''}`} aria-invalid={!!error} aria-describedby={describedBy} />
        {password && <button type="button" aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((value) => !value)} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-ink/65 hover:bg-forest/5">{visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>}
      </div>
      {hint && <p id={`${id}-hint`} className="mt-2 text-xs leading-6 text-ink/65">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
