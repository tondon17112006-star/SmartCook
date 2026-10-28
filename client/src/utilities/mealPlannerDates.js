// Calendar arithmetic deliberately avoids parsing ISO DATE values as UTC instants.
export const MEAL_TYPES = [{ value: 'Breakfast', label: 'Sáng' }, { value: 'Lunch', label: 'Trưa' }, { value: 'Dinner', label: 'Tối' }]
export const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
export const MIN_WEEK = '0001-01-01'
export const MAX_WEEK = '9999-12-20'
const leap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
const monthLength = (year, month) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= monthLength(year, month)
}
function ordinal(value) {
  if (!isCalendarDate(value)) throw new RangeError('Ngày không hợp lệ.')
  const [year, month, day] = value.split('-').map(Number), before = year - 1
  let result = before * 365 + Math.floor(before / 4) - Math.floor(before / 100) + Math.floor(before / 400) + day - 1
  for (let current = 1; current < month; current += 1) result += monthLength(year, current)
  return result
}
export function addCalendarDays(value, amount) {
  if (!Number.isInteger(amount)) throw new RangeError('Số ngày không hợp lệ.')
  let target = ordinal(value) + amount
  if (target < 0 || target > 3652058) return null
  let low = 1, high = 9999
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (ordinal(`${String(mid).padStart(4, '0')}-01-01`) <= target) low = mid
    else high = mid - 1
  }
  const year = low
  target -= ordinal(`${String(year).padStart(4, '0')}-01-01`)
  let month = 1
  while (target >= monthLength(year, month)) { target -= monthLength(year, month); month += 1 }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(target + 1).padStart(2, '0')}`
}
export function startOfWeek(date) { return addCalendarDays(date, -(ordinal(date) % 7)) }
export function isSupportedMealDate(date) { return isCalendarDate(date) && startOfWeek(date) <= MAX_WEEK }
export function isWeekStart(date) { return isSupportedMealDate(date) && startOfWeek(date) === date }
export function weekDates(date) {
  if (!isWeekStart(date)) throw new RangeError('Tuần phải bắt đầu vào thứ Hai và có đủ 7 ngày.')
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(date, index))
}
export function shiftWeek(date, direction) {
  const result = addCalendarDays(date, direction * 7)
  return result && isWeekStart(result) ? result : null
}
export function todayInVietnam(instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const part = (name) => parts.find((item) => item.type === name).value
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
}
export function formatMealDate(date) { return isCalendarDate(date) ? date.split('-').reverse().join('/') : '' }
export function formatWeekRange(weekStart) { return `${formatMealDate(weekStart)} – ${formatMealDate(addCalendarDays(weekStart, 6))}` }
export function mealError(error) { return typeof error?.response?.data?.message === 'string' ? error.response.data.message : 'Chưa thể lưu thay đổi. Bạn vui lòng kiểm tra kết nối và thử lại.' }
export function recipeMealLink(item, cooking = false) { return `/recipes/${item.recipeId}?servings=${item.servings}&source=meal-planner${cooking ? '&cook=1' : ''}` }
