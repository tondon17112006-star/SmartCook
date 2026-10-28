import { api } from './api.js'
import { authenticatedRequest } from './authenticatedRequest.js'

export async function getMealPlan(weekStart, { signal } = {}) {
  const { data } = await api.get('/meal-plans', { params: { weekStart }, signal })
  return data.data
}
export async function getShoppingList(weekStart, { signal } = {}) {
  const { data } = await api.get('/meal-plans/shopping-list', { params: { weekStart }, signal })
  return data.data
}
export async function addMealPlanItem(body, options) { return (await authenticatedRequest('post', '/meal-plans/items', body, options)).data }
export async function updateMealPlanItem(id, body, options) { return (await authenticatedRequest('patch', `/meal-plans/items/${encodeURIComponent(id)}`, body, options)).data }
export function deleteMealPlanItem(id, options) { return authenticatedRequest('delete', `/meal-plans/items/${encodeURIComponent(id)}`, {}, options) }
