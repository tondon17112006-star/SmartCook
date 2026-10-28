import { MEAL_TYPES, isSupportedMealDate } from './mealPlannerDates.js'

export function validateMealFields({ mealDate, mealType, servings }) {
  if (!isSupportedMealDate(mealDate)) return 'Chọn ngày hợp lệ trong khoảng 01/01/0001 – 26/12/9999.'
  if (!MEAL_TYPES.some((item) => item.value === mealType)) return 'Chọn bữa sáng, trưa hoặc tối.'
  if (!Number.isInteger(Number(servings)) || Number(servings) < 1 || Number(servings) > 20 || !String(servings).trim()) return 'Khẩu phần phải là số nguyên từ 1 đến 20.'
  return null
}
export function formatShoppingQuantity(value) {
  // Keep Decimal strings intact rather than rounding large sums through Number.
  const [integer, decimal] = String(value).split('.')
  const fractional = decimal?.replace(/0+$/u, '')
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/gu, '.')}${fractional ? `,${fractional}` : ''}`
}
