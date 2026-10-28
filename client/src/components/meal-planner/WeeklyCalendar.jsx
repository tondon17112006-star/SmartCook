import { Link } from 'react-router-dom'
import { ChefHat, Clock3, Pencil, Plus, Trash2 } from 'lucide-react'
import RecipeImage from '../RecipeImage.jsx'
import { DAY_NAMES, MEAL_TYPES, formatMealDate, recipeMealLink } from '../../utilities/mealPlannerDates.js'

export function MealRecipeCard({ item, onEdit, onDelete }) {
  return <article className="min-w-0 rounded-xl border border-forest/10 bg-white p-3">
    <RecipeImage src={item.imageUrl} alt={item.recipeName} className="mb-3 aspect-[4/3] w-full rounded-lg" />
    <Link to={recipeMealLink(item)} className="font-bold text-dark-green hover:underline [overflow-wrap:anywhere]">{item.recipeName}</Link>
    <p className="mt-2 text-xs leading-6 text-ink/65">{item.servings} người · <Clock3 className="inline" size={12} aria-hidden="true" /> {item.totalTime} phút</p>
    <div className="mt-2 flex flex-wrap gap-2"><Link to={recipeMealLink(item)} className="min-h-10 py-2 text-xs font-semibold text-forest underline underline-offset-4">Xem công thức</Link><Link to={recipeMealLink(item, true)} className="flex min-h-10 items-center gap-1 py-2 text-xs font-semibold text-forest underline underline-offset-4"><ChefHat size={13} aria-hidden="true" />Bắt đầu nấu</Link></div>
    <div className="mt-2 flex gap-2 border-t border-forest/10 pt-2"><button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-forest/5 text-forest" aria-label={`Sửa ${item.recipeName} ngày ${formatMealDate(item.mealDate)}`} onClick={() => onEdit(item)}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-800 hover:bg-red-50" aria-label={`Xóa ${item.recipeName} ngày ${formatMealDate(item.mealDate)}`} onClick={() => onDelete(item)}><Trash2 size={16} aria-hidden="true" /></button></div>
  </article>
}
export function MealSection({ date, type, items, onAdd, onEdit, onDelete }) {
  return <section aria-label={`${type.label} ngày ${formatMealDate(date)}`} className="min-w-0 rounded-xl bg-cream/70 p-2">
    <div className="mb-3 flex items-center justify-between gap-1"><h3 className="text-sm font-bold text-dark-green">{type.label}</h3><button type="button" aria-label={`Thêm món bữa ${type.label.toLowerCase()} ngày ${formatMealDate(date)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-forest hover:bg-forest/10" onClick={() => onAdd({ mealDate: date, mealType: type.value })}><Plus size={18} aria-hidden="true" /></button></div>
    <div className="space-y-3">{items.length ? items.map((item) => <MealRecipeCard key={item.mealPlanItemId} item={item} onEdit={onEdit} onDelete={onDelete} />) : <div className="pb-3 text-center"><p className="text-xs leading-6 text-ink/55">Chưa có món ăn</p><button type="button" className="min-h-11 px-2 text-xs font-semibold text-forest underline underline-offset-4" onClick={() => onAdd({ mealDate: date, mealType: type.value })}>Thêm món</button></div>}</div>
  </section>
}
export function DayCard({ day, index, today, onAdd, onEdit, onDelete }) {
  const current = day.date === today
  return <section aria-label={`${DAY_NAMES[index]} ${formatMealDate(day.date)}`} aria-current={current ? 'date' : undefined} className={`min-w-0 rounded-2xl border p-3 ${current ? 'border-forest bg-forest/5' : 'border-forest/15 bg-white'}`}>
    <header className="mb-4"><h2 className="font-bold text-dark-green">{DAY_NAMES[index]}</h2><p className="mt-1 text-sm text-ink/60">{formatMealDate(day.date)}</p>{current && <span className="mt-2 inline-block rounded-full bg-forest px-2 py-1 text-xs font-semibold text-white">Hôm nay</span>}</header>
    <div className="grid gap-3">{MEAL_TYPES.map((type) => <MealSection key={type.value} date={day.date} type={type} items={day.meals[type.value]} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />)}</div>
  </section>
}
export default function WeeklyCalendar({ days, today, onAdd, onEdit, onDelete }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7" aria-label="Lịch nấu ăn 7 ngày">{days.map((day, index) => <DayCard key={day.date} day={day} index={index} today={today} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />)}</div>
}
