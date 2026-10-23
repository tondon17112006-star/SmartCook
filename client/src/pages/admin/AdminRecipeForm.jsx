import { useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ErrorState from '../../components/ErrorState.jsx'
import useApiResource from '../../hooks/useApiResource.js'
import useAuth from '../../hooks/useAuth.js'
import { createAdmin, getAdmin, updateAdmin } from '../../services/adminService.js'
import { loadAllAdminOptions } from './adminRecipeOptions.js'
import useAdminMutation from '../../components/admin/useAdminMutation.js'

const blankIngredient = () => ({ ingredientId: '', quantity: '', unit: '', isRequired: true, notes: '' })
const blankStep = () => ({ instruction: '', imageUrl: '' })
const emptyRecipe = { recipeName: '', categoryId: '', description: '', imageUrl: '', prepTime: '10', cookTime: '15', servings: '2', difficulty: 'Dễ', ingredients: [blankIngredient()], steps: [blankStep()] }
const singleLineControls = /[\p{Cc}\p{Cf}]/u
// Reject unsafe control characters while retaining line breaks in instructions.
// oxlint-disable-next-line no-control-regex
const multilineControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\p{Cf}]/u

function validImageUrl(value) {
  if (!value) return true
  if (value.length > 500 || /[\s\\\p{Cc}\p{Cf}]/u.test(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}

function validateRecipe(values) {
  const errors = {}
  function text(key, value, max, { required = true, multiline = false } = {}) {
    if ((required && !value.trim()) || value.length > max || (multiline ? multilineControls : singleLineControls).test(value)) errors[key] = `Vui lòng nhập ${required ? '1–' : 'tối đa '}${max} ký tự hợp lệ.`
  }
  const int = (value, min) => /^\d+$/.test(String(value)) && Number(value) >= min && Number(value) <= 2_147_483_647
  text('recipeName', values.recipeName, 200)
  if (!int(values.categoryId, 1)) errors.categoryId = 'Vui lòng chọn danh mục.'
  text('description', values.description, 10_000, { required: false, multiline: true })
  if (!validImageUrl(values.imageUrl.trim())) errors.imageUrl = 'Dùng URL http, https hoặc đường dẫn bắt đầu bằng /, tối đa 500 ký tự.'
  for (const key of ['prepTime', 'cookTime']) if (!int(values[key], 0)) errors[key] = 'Nhập số phút nguyên từ 0 đến 2147483647.'
  if (!errors.prepTime && !errors.cookTime && Number(values.prepTime) + Number(values.cookTime) <= 0) errors.cookTime = 'Tổng thời gian phải lớn hơn 0 phút.'
  if (!int(values.servings, 1)) errors.servings = 'Khẩu phần phải là số nguyên dương.'
  if (!['Dễ', 'Trung bình', 'Khó'].includes(values.difficulty)) errors.difficulty = 'Vui lòng chọn độ khó.'
  if (!values.ingredients.length || !values.ingredients.some((row) => row.isRequired)) errors.ingredients = 'Cần ít nhất một nguyên liệu bắt buộc.'
  const selected = new Set()
  values.ingredients.forEach((row, index) => {
    const key = `ingredients.${index}`
    if (!int(row.ingredientId, 1)) errors[`${key}.ingredientId`] = 'Vui lòng chọn nguyên liệu.'
    else if (selected.has(String(row.ingredientId))) errors[`${key}.ingredientId`] = 'Nguyên liệu đã có trong công thức.'
    selected.add(String(row.ingredientId))
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(row.quantity)) || Number(row.quantity) <= 0 || Number(row.quantity) > 9_999_999_999.99) errors[`${key}.quantity`] = 'Nhập định lượng dương, tối đa 2 chữ số thập phân.'
    text(`${key}.unit`, row.unit, 30)
    text(`${key}.notes`, row.notes, 255, { required: false })
  })
  if (!values.steps.length) errors.steps = 'Cần ít nhất một bước chế biến.'
  values.steps.forEach((row, index) => {
    text(`steps.${index}.instruction`, row.instruction, 10_000, { multiline: true })
    if (!validImageUrl(row.imageUrl.trim())) errors[`steps.${index}.imageUrl`] = 'URL ảnh bước nấu không hợp lệ.'
  })
  return errors
}

function Field({ label, name, error, children, ...props }) {
  const id = `admin-recipe-${name}`
  const attributes = { id, name, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-error` : undefined }
  return <div className="min-w-0"><label htmlFor={id} className="mb-2 block text-sm font-semibold text-dark-green">{label}</label>{children ? children(attributes) : <input {...props} {...attributes} className="field" />}{error && <p id={`${id}-error`} className="mt-2 text-sm text-red-800">{error}</p>}</div>
}

function RecipeEditor({ recipe, categories, ingredients, recipeId }) {
  const navigate = useNavigate()
  const [values, setValues] = useState(() => recipe ? {
    ...recipe, categoryId: String(recipe.categoryId), description: recipe.description ?? '', imageUrl: recipe.imageUrl ?? '',
    prepTime: String(recipe.prepTime), cookTime: String(recipe.cookTime), servings: String(recipe.servings),
    ingredients: recipe.ingredients.map((row) => ({ ...row, ingredientId: String(row.ingredientId), quantity: String(row.quantity), notes: row.notes ?? '' })),
    steps: recipe.steps.map((row) => ({ instruction: row.instruction, imageUrl: row.imageUrl ?? '' })),
  } : structuredClone(emptyRecipe))
  const [errors, setErrors] = useState({})
  const mutation = useAdminMutation()
  const { pending, error: failure } = mutation
  const form = useRef(null)

  function change(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined })); mutation.reset()
  }
  function changeRow(collection, index, field, value) {
    setValues((current) => ({ ...current, [collection]: current[collection].map((row, position) => {
      if (position !== index) return row
      const next = { ...row, [field]: value }
      if (collection === 'ingredients' && field === 'ingredientId') next.unit = ingredients.find((option) => String(option.ingredientId) === value)?.defaultUnit ?? row.unit
      return next
    }) }))
    setErrors((current) => ({ ...current, [`${collection}.${index}.${field}`]: undefined, [collection]: undefined })); mutation.reset()
  }
  function removeRow(collection, index) {
    setValues((current) => ({ ...current, [collection]: current[collection].filter((_, position) => position !== index) }))
    setErrors({}); mutation.reset()
  }
  function moveStep(index, delta) {
    setValues((current) => {
      const steps = [...current.steps]
      ;[steps[index], steps[index + delta]] = [steps[index + delta], steps[index]]
      return { ...current, steps }
    })
    setErrors({}); mutation.reset()
  }

  function submit(event) {
    event.preventDefault()
    if (pending) return
    const nextErrors = validateRecipe(values)
    setErrors(nextErrors); mutation.reset()
    if (Object.keys(nextErrors).length) {
      // The error attributes render after this event. Locate the existing
      // control by name so keyboard focus moves on the first invalid submit.
      const first = Object.keys(nextErrors).map((name) => form.current.elements.namedItem(name)).find(Boolean)
      ;(first ?? form.current).focus()
      return
    }
    const payload = {
      recipeName: values.recipeName.normalize('NFC').trim(), categoryId: Number(values.categoryId), description: values.description.normalize('NFC').trim() || null,
      imageUrl: values.imageUrl.trim() || null, prepTime: Number(values.prepTime), cookTime: Number(values.cookTime), servings: Number(values.servings), difficulty: values.difficulty,
      ingredients: values.ingredients.map((row) => ({ ingredientId: Number(row.ingredientId), quantity: Number(row.quantity), unit: row.unit.normalize('NFC').trim(), isRequired: row.isRequired, notes: row.notes.normalize('NFC').trim() || null })),
      steps: values.steps.map((row, index) => ({ stepNumber: index + 1, instruction: row.instruction.normalize('NFC').trim(), imageUrl: row.imageUrl.trim() || null })),
    }
    mutation.run((options) => recipeId ? updateAdmin('recipes', recipeId, payload, options) : createAdmin('recipes', payload, options), () => {
      navigate('/admin/recipes', { replace: true, state: { recipeSaved: 'Đã lưu công thức thành công.' } })
    })
  }

  return <form ref={form} onSubmit={submit} noValidate aria-busy={pending} tabIndex={-1} className="space-y-6">
    <fieldset disabled={pending} className="surface-card min-w-0 p-4 sm:p-6"><legend className="px-2 text-lg font-bold text-dark-green">Thông tin món ăn</legend><div className="grid gap-5 sm:grid-cols-2">
      <Field label="Tên món ăn" name="recipeName" maxLength={200} value={values.recipeName} onChange={(event) => change('recipeName', event.target.value)} error={errors.recipeName} required />
      <Field label="Danh mục" name="categoryId" error={errors.categoryId}>{(props) => <select {...props} className="field" value={values.categoryId} onChange={(event) => change('categoryId', event.target.value)} required><option value="">Chọn danh mục</option>{categories.map((row) => <option key={row.categoryId} value={row.categoryId}>{row.categoryName}</option>)}</select>}</Field>
      <div className="sm:col-span-2"><Field label="Mô tả món ăn (không bắt buộc)" name="description" error={errors.description}>{(props) => <textarea {...props} className="field min-h-28" maxLength={10000} value={values.description} onChange={(event) => change('description', event.target.value)} />}</Field></div>
      <div className="sm:col-span-2"><Field label="URL hình ảnh món ăn (không bắt buộc)" name="imageUrl" maxLength={500} value={values.imageUrl} onChange={(event) => change('imageUrl', event.target.value)} placeholder="https://… hoặc /images/…" error={errors.imageUrl} /><p className="mt-2 text-xs text-ink/60">Nhập đường dẫn hình ảnh đã có. Chưa hỗ trợ tải ảnh từ máy.</p></div>
      <Field label="Chuẩn bị (phút)" name="prepTime" type="number" min="0" step="1" value={values.prepTime} onChange={(event) => change('prepTime', event.target.value)} error={errors.prepTime} required />
      <Field label="Chế biến (phút)" name="cookTime" type="number" min="0" step="1" value={values.cookTime} onChange={(event) => change('cookTime', event.target.value)} error={errors.cookTime} required />
      <Field label="Khẩu phần (người)" name="servings" type="number" min="1" step="1" value={values.servings} onChange={(event) => change('servings', event.target.value)} error={errors.servings} required />
      <Field label="Độ khó" name="difficulty" error={errors.difficulty}>{(props) => <select {...props} className="field" value={values.difficulty} onChange={(event) => change('difficulty', event.target.value)}>{['Dễ', 'Trung bình', 'Khó'].map((value) => <option key={value}>{value}</option>)}</select>}</Field>
    </div></fieldset>

    <fieldset disabled={pending} className="surface-card min-w-0 space-y-4 p-4 sm:p-6"><legend className="px-2 text-lg font-bold text-dark-green">Nguyên liệu và định lượng</legend><p className="text-sm leading-6 text-ink/65">Định lượng cho {values.servings || '…'} người. Cần ít nhất một nguyên liệu bắt buộc, không chọn trùng.</p>
      {errors.ingredients && <p role="alert" tabIndex={-1} className="text-sm text-red-800">{errors.ingredients}</p>}
      {values.ingredients.map((row, index) => <div key={index} className="rounded-xl border border-stone-200 p-4"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold text-dark-green">Nguyên liệu {index + 1}</h3><button type="button" className="button-ghost text-red-700" aria-label={`Xóa nguyên liệu ${index + 1}`} onClick={() => removeRow('ingredients', index)}><Trash2 size={18} aria-hidden="true" /></button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label={`Tên nguyên liệu ${index + 1}`} name={`ingredients.${index}.ingredientId`} error={errors[`ingredients.${index}.ingredientId`]}>{(props) => <select {...props} className="field" value={row.ingredientId} onChange={(event) => changeRow('ingredients', index, 'ingredientId', event.target.value)} required><option value="">Chọn nguyên liệu</option>{ingredients.map((option) => <option key={option.ingredientId} value={option.ingredientId} disabled={values.ingredients.some((other, position) => position !== index && String(other.ingredientId) === String(option.ingredientId))}>{option.ingredientName}</option>)}</select>}</Field>
        <Field label={`Định lượng ${index + 1}`} name={`ingredients.${index}.quantity`} type="number" min="0.01" step="0.01" value={row.quantity} onChange={(event) => changeRow('ingredients', index, 'quantity', event.target.value)} error={errors[`ingredients.${index}.quantity`]} required />
        <Field label={`Đơn vị ${index + 1}`} name={`ingredients.${index}.unit`} maxLength={30} value={row.unit} onChange={(event) => changeRow('ingredients', index, 'unit', event.target.value)} error={errors[`ingredients.${index}.unit`]} required />
        <div className="sm:col-span-2"><Field label={`Ghi chú nguyên liệu ${index + 1} (không bắt buộc)`} name={`ingredients.${index}.notes`} maxLength={255} value={row.notes} onChange={(event) => changeRow('ingredients', index, 'notes', event.target.value)} error={errors[`ingredients.${index}.notes`]} /></div>
        <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-forest" checked={row.isRequired} onChange={(event) => changeRow('ingredients', index, 'isRequired', event.target.checked)} />Nguyên liệu {index + 1} bắt buộc</label>
      </div></div>)}
      <button type="button" className="button-secondary" disabled={values.ingredients.length >= 200} onClick={() => { change('ingredients', [...values.ingredients, blankIngredient()]) }}><Plus size={17} aria-hidden="true" />Thêm nguyên liệu</button>
    </fieldset>

    <fieldset disabled={pending} className="surface-card min-w-0 space-y-4 p-4 sm:p-6"><legend className="px-2 text-lg font-bold text-dark-green">Các bước chế biến</legend><p className="text-sm leading-6 text-ink/65">Số bước được cập nhật tự động theo thứ tự hiển thị.</p>{errors.steps && <p role="alert" tabIndex={-1} className="text-sm text-red-800">{errors.steps}</p>}
      {values.steps.map((row, index) => <div key={index} className="rounded-xl border border-stone-200 p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-dark-green">Bước {index + 1}</h3><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label={`Chuyển bước ${index + 1} lên`} className="button-ghost disabled:opacity-40"><ArrowUp size={18} aria-hidden="true" /></button><button type="button" disabled={index === values.steps.length - 1} onClick={() => moveStep(index, 1)} aria-label={`Chuyển bước ${index + 1} xuống`} className="button-ghost disabled:opacity-40"><ArrowDown size={18} aria-hidden="true" /></button><button type="button" onClick={() => removeRow('steps', index)} aria-label={`Xóa bước ${index + 1}`} className="button-ghost text-red-700"><Trash2 size={18} aria-hidden="true" /></button></div></div><div className="space-y-4">
        <Field label={`Hướng dẫn bước ${index + 1}`} name={`steps.${index}.instruction`} error={errors[`steps.${index}.instruction`]}>{(props) => <textarea {...props} className="field min-h-28" maxLength={10000} required value={row.instruction} onChange={(event) => changeRow('steps', index, 'instruction', event.target.value)} />}</Field>
        <Field label={`URL ảnh bước ${index + 1} (không bắt buộc)`} name={`steps.${index}.imageUrl`} maxLength={500} value={row.imageUrl} onChange={(event) => changeRow('steps', index, 'imageUrl', event.target.value)} error={errors[`steps.${index}.imageUrl`]} />
      </div></div>)}
      <button type="button" className="button-secondary" disabled={values.steps.length >= 100} onClick={() => change('steps', [...values.steps, blankStep()])}><Plus size={17} aria-hidden="true" />Thêm bước nấu</button>
    </fieldset>
    {Object.keys(errors).some((key) => errors[key]) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">Vui lòng kiểm tra các trường được đánh dấu trước khi lưu.</p>}
    {failure && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{failure}</p>}
    <div className="flex flex-wrap justify-end gap-3"><Link to="/admin/recipes" aria-disabled={pending ? 'true' : undefined} onClick={(event) => { if (pending) event.preventDefault() }} className="button-secondary">Hủy và về danh sách</Link><button type="submit" disabled={pending} className="button-primary"><Save size={18} aria-hidden="true" />{pending ? 'Đang lưu…' : 'Lưu công thức'}</button></div>
  </form>
}

export default function AdminRecipeForm() {
  const { id } = useParams()
  const { currentUser, sessionGeneration } = useAuth()
  const source = useApiResource(async (signal) => {
    const [categories, ingredients, recipe] = await Promise.all([
      loadAllAdminOptions('categories', signal), loadAllAdminOptions('ingredients', signal),
      id ? getAdmin('recipes', id, { signal }) : null,
    ])
    return { categories, ingredients, recipe }
  }, [id, currentUser?.userId, sessionGeneration])
  return <section className="min-w-0 space-y-6"><Link to="/admin/recipes" className="inline-flex items-center gap-2 text-sm font-semibold text-forest"><ArrowLeft size={17} aria-hidden="true" />Danh sách công thức</Link><div><h1 className="text-2xl font-bold text-dark-green">{id ? 'Chỉnh sửa món ăn' : 'Thêm món ăn'}</h1><p className="mt-2 text-sm leading-6 text-ink/65">Lưu thông tin, nguyên liệu và bước nấu trong cùng một công thức.</p></div>
    {source.loading ? <p role="status">Đang tải dữ liệu công thức…</p> : source.error ? <ErrorState error={source.error} onRetry={source.retry} /> : <RecipeEditor key={`${id ?? 'new'}:${currentUser?.userId}:${sessionGeneration}`} recipeId={id} recipe={source.data.recipe} categories={source.data.categories} ingredients={source.data.ingredients} />}
  </section>
}
