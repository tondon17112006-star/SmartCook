import { api } from './api.js'
import { authenticatedRequest } from './authenticatedRequest.js'

export async function getReviews(recipeId, { page = 1, limit = 6, signal } = {}) {
  const { data } = await api.get(`/recipes/${encodeURIComponent(recipeId)}/reviews`, { params: { page, limit }, signal })
  return data
}

export async function getMyReview(recipeId, { signal } = {}) {
  const { data } = await api.get(`/recipes/${encodeURIComponent(recipeId)}/reviews/mine`, { signal })
  return data.data
}

export async function createReview(recipeId, review, options) {
  const result = await authenticatedRequest('post', `/recipes/${encodeURIComponent(recipeId)}/reviews`, review, options)
  return result.data
}

export async function updateReview(reviewId, review, options) {
  const result = await authenticatedRequest('patch', `/reviews/${encodeURIComponent(reviewId)}`, review, options)
  return result.data
}

export function deleteReview(reviewId, options) {
  return authenticatedRequest('delete', `/reviews/${encodeURIComponent(reviewId)}`, {}, options)
}
