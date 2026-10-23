import { Check } from 'lucide-react'
import CookingProgress from './CookingProgress'
import RecipeImage from './RecipeImage'

export default function RecipeSteps({ recipeName, steps, completedIds, completedCount, onToggleStep }) {
  return (
    <section aria-labelledby="recipe-instructions" className="min-w-0 py-2">
      <p className="eyebrow">Vào bếp cùng SmartCook</p>
      <h2 id="recipe-instructions" className="mt-2 text-2xl font-bold text-dark-green sm:text-3xl">Các bước chế biến</h2>
      {steps.length ? (
        <>
          <div className="mt-6"><CookingProgress completed={completedCount} total={steps.length} /></div>
          <ol className="mt-7 space-y-5">
            {steps.map((step) => {
              const complete = completedIds.includes(step.stepId)
              return (
                <li key={step.stepId} className={`rounded-2xl border p-5 sm:p-6 ${complete ? 'border-forest/25 bg-forest/5' : 'border-forest/10 bg-white'}`}>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest font-bold text-white" aria-hidden="true">{complete ? <Check size={20} /> : step.stepNumber}</span>
                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="text-lg font-semibold text-dark-green">Bước {step.stepNumber}</h3>
                      <p className="mt-2 whitespace-pre-line break-words text-base leading-8 text-ink/80">{step.instruction}</p>
                      {step.imageUrl && <div className="mt-4 overflow-hidden rounded-2xl"><RecipeImage src={step.imageUrl} alt={`Bước ${step.stepNumber}: ${recipeName}`} className="aspect-video w-full object-cover" /></div>}
                      <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-forest">
                        <input type="checkbox" aria-label={`Hoàn thành bước ${step.stepNumber}`} checked={complete} onChange={() => onToggleStep(step.stepId)} className="size-5 shrink-0 cursor-pointer accent-forest" />
                        <span>{complete ? 'Đã hoàn thành' : 'Hoàn thành bước'}</span>
                      </label>
                      {!complete && <span className="ml-3 inline-block text-xs text-ink/55">Chưa thực hiện</span>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {completedCount === steps.length && <p role="status" className="mt-6 rounded-2xl bg-forest/10 p-5 font-semibold leading-7 text-dark-green">Bạn đã hoàn thành tất cả các bước. Chúc bạn ngon miệng!</p>}
        </>
      ) : <p className="mt-6 rounded-2xl border border-orange/25 bg-white p-5 leading-7 text-ink/65">Công thức chưa có các bước chế biến. Chế độ nấu sẽ sẵn sàng khi hướng dẫn được cập nhật.</p>}
    </section>
  )
}
