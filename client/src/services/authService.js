import { api } from './api.js'

// The session cookie is managed only by the browser. Never persist a JWT or
// password in Web Storage; CSRF tokens are short-lived request values.
export async function getCsrfToken({ signal } = {}) {
  const { data } = await api.get('/auth/csrf', { signal })
  if (typeof data?.csrfToken !== 'string' || !data.csrfToken) {
    throw new Error('Không thể xác nhận yêu cầu. Bạn vui lòng thử lại.')
  }
  return data.csrfToken
}

async function mutate(method, path, body, { signal, authGeneration } = {}) {
  const csrfToken = await getCsrfToken({ signal })
  const { data } = await api.request({
    method,
    url: path,
    data: body,
    signal,
    headers: { 'X-CSRF-Token': csrfToken },
    smartCookAuthGeneration: authGeneration,
  })
  return data
}

export async function registerUser(credentials, options) {
  const result = await mutate('post', '/auth/register', credentials, options)
  return result.data
}

export async function loginUser(credentials, options) {
  const result = await mutate('post', '/auth/login', credentials, options)
  return result.data
}

export async function logoutUser(options) {
  return mutate('post', '/auth/logout', {}, options)
}

export async function getCurrentUser({ signal, authGeneration } = {}) {
  const { data } = await api.get('/auth/me', { signal, smartCookAuthGeneration: authGeneration })
  return data.data
}

export async function updateUserProfile(profile, options) {
  const result = await mutate('patch', '/auth/profile', profile, options)
  return result.data
}

export async function checkAdminAccess({ signal } = {}) {
  const { data } = await api.get('/admin/check', { signal })
  return data
}
