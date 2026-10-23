import { api } from './api'

export async function getCategories({ signal } = {}) {
  const response = await api.get('/categories', { signal })
  return response.data
}

export async function getRecipes(params = {}, { signal } = {}) {
  const response = await api.get('/recipes', { params, signal })
  return response.data
}

export async function getRecipe(id, { signal } = {}) {
  const response = await api.get(`/recipes/${encodeURIComponent(id)}`, { signal })
  return response.data
}
