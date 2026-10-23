import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function AdminDialog({ title, description, children, onClose, pending = false, side = false }) {
  const headingId = useId(), descriptionId = useId(), dialog = useRef(null)
  const current = useRef({ onClose, pending })
  useEffect(() => { current.current = { onClose, pending } }, [onClose, pending])
  useEffect(() => {
    const previous = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => [...dialog.current.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter((item) => !item.hidden)
    const initial = dialog.current.querySelector('[data-autofocus]') || focusable()[0] || dialog.current
    initial.focus()
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!current.current.pending) current.current.onClose()
      }
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1)
        if (!first) { event.preventDefault(); dialog.current.focus() }
        else if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return createPortal(<div className={`fixed inset-0 z-50 flex bg-dark-green/45 ${side ? 'justify-start' : 'items-center justify-center p-4'}`}>
    <button type="button" tabIndex={-1} aria-label="Đóng hộp thoại" disabled={pending} className="absolute inset-0 cursor-default" onClick={onClose} />
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={description ? descriptionId : undefined} aria-busy={pending} tabIndex={-1} className={`relative overflow-y-auto bg-white shadow-xl ${side ? 'h-full w-72 max-w-[90vw] p-5' : 'max-h-[90dvh] w-full max-w-xl rounded-2xl p-5 sm:p-7'}`}>
      <div className="mb-5 flex items-start justify-between gap-4"><h2 id={headingId} className="text-xl font-bold text-dark-green">{title}</h2><button type="button" disabled={pending} onClick={onClose} className="rounded-lg p-2 text-ink/65 hover:bg-forest/8 disabled:opacity-40" aria-label="Đóng"><X size={20} aria-hidden="true" /></button></div>
      {description && <p id={descriptionId} className="mb-5 text-sm leading-7 text-ink/70">{description}</p>}
      {children}
    </section>
  </div>, document.body)
}
