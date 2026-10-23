import { useEffect, useId, useRef } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChefHat, ListChecks, RotateCcw, X } from 'lucide-react'
import CookingProgress from './CookingProgress.jsx'
import RecipeImage from './RecipeImage.jsx'

export default function CookingMode({ recipeName, steps, currentStepId, completedIds, onSelectStep, onToggleStep, onExit, onRestart, servings, originalServings }) {
  const headingId = useId()
  const headingRef = useRef(null)
  const index = Math.max(0, steps.findIndex((step) => step.stepId === currentStepId))
  const step = steps[index]
  const completedSet = new Set(completedIds)
  const completed = steps.filter((item) => completedSet.has(item.stepId)).length
  const allComplete = steps.length > 0 && completed === steps.length
  const isCurrentComplete = step ? completedSet.has(step.stepId) : false

  useEffect(() => {
    headingRef.current?.focus()
  }, [currentStepId, allComplete])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onExit()
    }
  }

  if (!step) {
    return <section className="surface-card p-6 text-center" aria-label="Chế độ nấu ăn"><h2 className="text-xl font-bold text-dark-green">Chưa có bước nấu</h2><p className="mt-3 text-sm text-ink/65">Hướng dẫn của món này đang được cập nhật.</p><button type="button" className="button-secondary mt-5" onClick={onExit}>Xem toàn bộ công thức</button></section>
  }

  return (
    <section aria-labelledby={headingId} onKeyDown={handleKeyDown} className="mx-auto max-w-4xl overflow-hidden rounded-[1.75rem] border border-forest/15 bg-white shadow-sm">
      <div className="border-b border-forest/10 bg-cream p-5 sm:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="eyebrow flex items-center gap-2"><ChefHat size={17} aria-hidden="true" /> Chế độ nấu ăn</p><p className="mt-2 text-lg font-semibold text-dark-green [overflow-wrap:anywhere]">{recipeName}</p></div>
          <button type="button" onClick={onExit} className="button-ghost shrink-0 bg-white"><X size={17} aria-hidden="true" /> Thoát chế độ nấu</button>
        </div>
        <CookingProgress completed={completed} total={steps.length} />
        {servings && servings !== originalServings && <p className="mt-4 text-sm leading-7 text-ink/70">Bạn đang nấu cho {servings} người. Các bước giữ nội dung công thức gốc cho {originalServings} người; hãy dùng lượng đã điều chỉnh trong danh sách nguyên liệu.</p>}
      </div>

      {allComplete ? (
        <div className="px-5 py-12 text-center sm:px-10 sm:py-16">
          <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-forest/10 text-forest"><CheckCircle2 size={40} strokeWidth={1.5} aria-hidden="true" /></span>
          <p className="eyebrow mt-7">Chúc mừng bạn!</p>
          <h2 ref={headingRef} id={headingId} tabIndex={-1} className="mt-3 text-3xl font-bold leading-tight text-dark-green sm:text-4xl">Bạn đã hoàn thành món ăn!</h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-8 text-ink/70">Tất cả {steps.length} bước đã được đánh dấu hoàn thành. Chúc bạn có một bữa ăn thật ngon miệng.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" className="button-primary" onClick={onExit}><ListChecks size={18} aria-hidden="true" /> Xem toàn bộ công thức</button><button type="button" className="button-secondary" onClick={onRestart}><RotateCcw size={17} aria-hidden="true" /> Làm lại từ đầu</button></div>
        </div>
      ) : (
        <div className="p-5 sm:p-8">
          <nav aria-label="Chọn bước nấu" className="mb-8 flex flex-wrap gap-2">
            {steps.map((item) => <button key={item.stepId} type="button" onClick={() => onSelectStep(item.stepId)} aria-label={`Xem bước ${item.stepNumber}${completedSet.has(item.stepId) ? ', đã hoàn thành' : ''}`} aria-current={item.stepId === step.stepId ? 'step' : undefined} className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-3 text-sm font-semibold ${item.stepId === step.stepId ? 'border-forest bg-forest text-white' : 'border-forest/15 bg-white text-dark-green hover:bg-forest/5'}`}>{completedSet.has(item.stepId) && <Check size={14} aria-hidden="true" />}{item.stepNumber}</button>)}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">Bước {index + 1} trên {steps.length}</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isCurrentComplete ? 'bg-forest/10 text-forest' : 'bg-stone-100 text-ink/65'}`}>{isCurrentComplete ? 'Đã hoàn thành' : 'Chưa thực hiện'}</span></div>
          <h2 ref={headingRef} id={headingId} tabIndex={-1} className="mt-4 text-3xl font-bold text-dark-green sm:text-4xl">Bước {step.stepNumber}</h2>
          <p className="mt-5 whitespace-pre-line text-lg leading-9 text-ink [overflow-wrap:anywhere] sm:text-xl sm:leading-10">{step.instruction}</p>
          {step.imageUrl && <RecipeImage key={step.stepId} src={step.imageUrl} alt={`Bước ${step.stepNumber}: ${recipeName}`} className="mt-6 aspect-video w-full rounded-2xl" />}
          <button type="button" onClick={() => onToggleStep(step.stepId)} className={`mt-8 w-full sm:w-auto ${isCurrentComplete ? 'button-secondary' : 'button-primary'}`}><CheckCircle2 size={19} aria-hidden="true" />{isCurrentComplete ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}</button>
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-stone-100 pt-6"><button type="button" onClick={() => onSelectStep(steps[index - 1].stepId)} disabled={index === 0} className="button-secondary px-3 disabled:opacity-40"><ArrowLeft size={18} aria-hidden="true" /> Bước trước</button><button type="button" onClick={() => onSelectStep(steps[index + 1].stepId)} disabled={index === steps.length - 1} className="button-secondary px-3 disabled:opacity-40">Bước tiếp theo <ArrowRight size={18} aria-hidden="true" /></button></div>
          <button type="button" onClick={onExit} className="button-ghost mt-5 w-full"><ListChecks size={17} aria-hidden="true" /> Xem toàn bộ công thức</button>
        </div>
      )}
    </section>
  )
}
