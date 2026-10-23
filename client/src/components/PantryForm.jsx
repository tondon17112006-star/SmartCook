import { useId, useState } from 'react'
import { validatePantryInput } from '../utilities/myPantry.js'

export default function PantryForm({ catalog, item, onSubmit, onCancel, pending, error }) {
  const prefix = useId()
  const [search, setSearch] = useState('')
  const [ingredientId, setIngredientId] = useState(item?.ingredientId ?? '')
  const [quantity, setQuantity] = useState(item?.quantity ?? '')
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [expiryDate, setExpiryDate] = useState(item?.expiryDate ?? '')
  const [errors, setErrors] = useState({})
  const visible = catalog.filter((entry) => entry.ingredientId === Number(ingredientId) || entry.ingredientName.normalize('NFC').toLocaleLowerCase('vi').includes(search.normalize('NFC').trim().toLocaleLowerCase('vi')))
  function submit(event) {
    event.preventDefault()
    if (pending) return
    const result = validatePantryInput({ ingredientId, quantity, unit, expiryDate }, { editing: Boolean(item) })
    if (!item && !catalog.some((entry) => entry.ingredientId === result.data.ingredientId)) result.errors.ingredientId = 'Bạn vui lòng chọn nguyên liệu trong danh mục hiện tại.'
    setErrors(result.errors)
    if (!Object.keys(result.errors).length) void onSubmit(result.data)
  }
  const field = (name, label, value, onChange, options = {}) => <div><label htmlFor={`${prefix}-${name}`} className="block text-sm font-semibold text-dark-green">{label}</label><input id={`${prefix}-${name}`} name={name} value={value} onChange={(event) => onChange(event.target.value)} disabled={pending} className="field mt-2 w-full" aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined} {...options} />{errors[name] && <p id={`${prefix}-${name}-error`} role="alert" className="mt-1 text-sm text-red-800">{errors[name]}</p>}</div>
  return <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-forest/15 bg-white p-5 sm:p-6" aria-label={item ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}>
    <h2 className="text-xl font-bold text-dark-green">{item ? `Sửa ${item.ingredientName}` : 'Thêm vào tủ'}</h2>
    {error && <p role="alert" className="rounded-xl border border-red-200 p-3 text-sm text-red-800">{error}</p>}
    {item ? <p className="text-sm text-ink/65">Nguyên liệu: <strong>{item.ingredientName}</strong>. Muốn đổi loại, hãy xóa dòng này và thêm nguyên liệu khác.</p> : <>
      {field('ingredientSearch', 'Tìm nguyên liệu', search, setSearch, { type: 'search', placeholder: 'Ví dụ: trứng, cà chua…' })}
      <div><label htmlFor={`${prefix}-ingredientId`} className="text-sm font-semibold text-dark-green">Chọn nguyên liệu</label><select id={`${prefix}-ingredientId`} name="ingredientId" value={ingredientId} disabled={pending} className="field mt-2 w-full" onChange={(event) => { setIngredientId(event.target.value); if (!unit) setUnit(catalog.find((entry) => entry.ingredientId === Number(event.target.value))?.defaultUnit || '') }} aria-invalid={Boolean(errors.ingredientId)}><option value="">Chọn trong danh mục</option>{visible.map((entry) => <option key={entry.ingredientId} value={entry.ingredientId}>{entry.ingredientName} — {entry.ingredientCategory}</option>)}</select>{errors.ingredientId && <p role="alert" className="mt-1 text-sm text-red-800">{errors.ingredientId}</p>}</div>
    </>}
    <div className="grid gap-4 sm:grid-cols-2">{field('quantity', 'Số lượng (không bắt buộc)', quantity, setQuantity, { type: 'text', inputMode: 'decimal', placeholder: 'Ví dụ: 1.25' })}{field('unit', 'Đơn vị', unit, setUnit, { type: 'text', maxLength: 30, placeholder: 'Ví dụ: kg, quả, bó' })}</div>
    {field('expiryDate', 'Hạn sử dụng (không bắt buộc)', expiryDate, setExpiryDate, { type: 'date' })}
    <p className="text-xs leading-6 text-ink/60">Để trống số lượng hoặc hạn sử dụng nếu chưa biết. Số lượng dùng dấu chấm và tối đa 2 chữ số thập phân. Có thể ghi lại ngày đã qua để nhận cảnh báo.</p>
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending} className="button-primary">{pending ? 'Đang lưu…' : item ? 'Lưu thay đổi' : 'Thêm nguyên liệu'}</button>{onCancel && <button type="button" disabled={pending} onClick={onCancel} className="button-secondary">Hủy chỉnh sửa</button>}</div>
  </form>
}
