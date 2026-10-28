import { useId } from 'react'
import { MEAL_TYPES } from '../../utilities/mealPlannerDates.js'
export default function MealFields({ values, onChange, pending }) {
  const id = useId()
  return <div className="grid gap-4 sm:grid-cols-3">
    <label htmlFor={`${id}-date`} className="grid gap-2 text-sm font-semibold">Ngày nấu<input id={`${id}-date`} className="field min-w-0" name="mealDate" type="date" min="0001-01-01" max="9999-12-26" required value={values.mealDate} disabled={pending} onChange={(event) => onChange({ ...values, mealDate: event.target.value })} /></label>
    <label htmlFor={`${id}-type`} className="grid gap-2 text-sm font-semibold">Bữa ăn<select id={`${id}-type`} className="field" name="mealType" value={values.mealType} disabled={pending} onChange={(event) => onChange({ ...values, mealType: event.target.value })}>{MEAL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
    <label htmlFor={`${id}-servings`} className="grid gap-2 text-sm font-semibold">Khẩu phần<input id={`${id}-servings`} className="field" name="servings" type="number" min="1" max="20" step="1" required value={values.servings} disabled={pending} onChange={(event) => onChange({ ...values, servings: event.target.value })} /></label>
  </div>
}
