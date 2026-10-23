import { api } from './api.js'
import { getCsrfToken } from './authService.js'

// All personal-data writes reuse the existing cookie/Origin/CSRF architecture.
export async function authenticatedRequest(method, url, body = {}, { signal } = {}) {
  const csrfToken = await getCsrfToken({ signal })
  const { data } = await api.request({
    method, url, data: body, signal,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  })
  return data
}
