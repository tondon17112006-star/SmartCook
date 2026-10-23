import { api } from './api.js'
import { authenticatedRequest } from './authenticatedRequest.js'

export async function getFavoriteIds({ signal } = {}) {
  const { data } = await api.get('/favorites/ids', { signal })
  if (!Array.isArray(data?.data) || !data.data.every((id) => Number.isInteger(id) && id > 0)) {
    throw new Error('Danh sách món yêu thích chưa hợp lệ. Bạn vui lòng thử lại.')
  }
  return data.data
}

export async function getFavorites({ page = 1, limit = 12, signal } = {}) {
  const { data } = await api.get('/favorites', { params: { page, limit }, signal })
  return data
}

export function addFavorite(recipeId, options) {
  return authenticatedRequest('post', '/favorites', { recipeId }, options)
}

export function removeFavorite(recipeId, options) {
  // An explicit JSON body keeps DELETE compatible with the existing CSRF and
  // Content-Type checks; the server obtains UserID only from its session.
  return authenticatedRequest('delete', `/favorites/${encodeURIComponent(recipeId)}`, {}, options)
}
