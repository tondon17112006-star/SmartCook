import { api } from './api.js'
import { authenticatedRequest } from './authenticatedRequest.js'

// Admin uses the same HttpOnly session and CSRF flow as the public account area.
export async function getAdminDashboard({ signal } = {}) {
  const { data } = await api.get('/admin/dashboard', { signal })
  return data.data
}
export async function listAdmin(resource, query = {}, { signal } = {}) {
  const { data } = await api.get(`/admin/${resource}`, { params: query, signal })
  return data
}
export async function getAdmin(resource, id, { signal } = {}) {
  const { data } = await api.get(`/admin/${resource}/${id}`, { signal })
  return data.data
}
export async function createAdmin(resource, payload, options) {
  const result = await authenticatedRequest('post', `/admin/${resource}`, payload, options)
  return result.data
}
export async function updateAdmin(resource, id, payload, options) {
  const result = await authenticatedRequest('patch', `/admin/${resource}/${id}`, payload, options)
  return result.data
}
export function deleteAdmin(resource, id, options) {
  return authenticatedRequest('delete', `/admin/${resource}/${id}`, {}, options)
}
