import { useState } from 'react'
import AdminDialog from '../admin/AdminDialog.jsx'
import MealFields from './MealFields.jsx'
import { validateMealFields } from '../../utilities/mealPlanner.js'
import useMealMutation from './useMealMutation.js'
import { updateMealPlanItem } from '../../services/mealPlannerService.js'

export default function EditMealDialog({ item, onClose, onSaved }) {
  const [values, setValues] = useState({ mealDate: item.mealDate, mealType: item.mealType, servings: item.servings })
  const { pending, error, setError, run } = useMealMutation()
  function submit(event) {
    event.preventDefault()
    const failure = validateMealFields(values)
    if (failure) { setError(failure); return }
    void run((options) => updateMealPlanItem(item.mealPlanItemId, { ...values, servings: Number(values.servings) }, options), onSaved)
  }
  return <AdminDialog title="Chỉnh sửa món trong lịch" description={item.recipeName} pending={pending} onClose={onClose}>
    <form onSubmit={submit} noValidate className="space-y-5"><MealFields values={values} onChange={setValues} pending={pending} /><p className="text-sm leading-6 text-ink/65">Bạn có thể chuyển món sang tuần khác. Công thức gốc và món yêu thích được giữ nguyên.</p>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="flex flex-wrap justify-end gap-3"><button type="button" className="button-secondary" disabled={pending} onClick={onClose}>Hủy</button><button type="submit" className="button-primary" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></form>
  </AdminDialog>
}
