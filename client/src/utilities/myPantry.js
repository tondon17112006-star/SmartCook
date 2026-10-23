import { isIngredientId, MAX_PANTRY_INGREDIENTS } from './pantryState.js'

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}

export function todayInVietnam(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function expiryStatus(expiryDate, today = todayInVietnam()) {
  if (expiryDate === null) return 'unknown'
  if (!validDate(expiryDate) || !validDate(today)) return 'invalid'
  if (expiryDate < today) return 'expired'
  const end = new Date(`${today}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + 3)
  return expiryDate <= end.toISOString().slice(0, 10) ? 'soon' : 'fresh'
}

export function summarizePantry(items, today = todayInVietnam()) {
  const counts = { total: items.length, expired: 0, soon: 0, unknown: 0 }
  for (const item of items) {
    const status = expiryStatus(item.expiryDate, today)
    if (Object.hasOwn(counts, status)) counts[status] += 1
  }
  return counts
}

export function eligiblePantryIds(items, today = todayInVietnam()) {
  const ids = [...new Set(items.filter((item) => ['unknown', 'soon', 'fresh'].includes(expiryStatus(item.expiryDate, today))).map((item) => item.ingredientId))]
  if (!ids.length) throw new Error('Tủ chưa có nguyên liệu còn hạn hoặc chưa ghi hạn sử dụng để tìm món.')
  if (ids.length > MAX_PANTRY_INGREDIENTS || !ids.every(isIngredientId)) throw new Error('Chỉ có thể tìm món với tối đa 100 loại nguyên liệu. Hãy điều chỉnh tủ trước khi tiếp tục; hệ thống không tự cắt bớt danh sách.')
  return ids
}

export function validatePantryInput({ ingredientId, quantity, unit, expiryDate }, { editing = false } = {}) {
  const errors = {}
  const id = Number(ingredientId)
  if (!editing && !isIngredientId(id)) errors.ingredientId = 'Bạn vui lòng chọn một nguyên liệu trong danh mục.'
  const rawQuantity = String(quantity ?? '').trim()
  const parsedQuantity = rawQuantity === '' ? null : Number(rawQuantity)
  if (rawQuantity !== '' && (!/^\d+(?:\.\d{1,2})?$/u.test(rawQuantity) || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 9_999_999_999.99)) {
    errors.quantity = 'Số lượng phải là số dương không quá 9999999999.99, tối đa 2 chữ số thập phân.'
  }
  const parsedUnit = String(unit ?? '').normalize('NFC').trim() || null
  if (parsedUnit && (parsedUnit.length > 30 || /[\p{Cc}\p{Cf}<>]/u.test(parsedUnit))) errors.unit = 'Đơn vị phải có từ 1 đến 30 ký tự hợp lệ.'
  if (parsedQuantity !== null && !parsedUnit) errors.unit = 'Cần nhập đơn vị khi có số lượng.'
  const parsedDate = String(expiryDate ?? '').trim() || null
  if (parsedDate !== null && !validDate(parsedDate)) errors.expiryDate = 'Hạn sử dụng phải là ngày hợp lệ (YYYY-MM-DD).'
  return { errors, data: { ...(!editing ? { ingredientId: id } : {}), quantity: parsedQuantity, unit: parsedUnit, expiryDate: parsedDate } }
}
