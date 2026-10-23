import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { createServer } from 'vite'
import { JSDOM } from 'jsdom'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const clientRoot = fileURLToPath(new URL('../', import.meta.url))
const USER = { userId: 15, fullName: 'Người dùng kiểm thử', email: 'fixture@example.test', phone: null, avatar: null, role: 'User' }
const ADMIN = { ...USER, role: 'Admin' } // Controlled DOM fixture, never inserted into SQL Server.
const globals = new Map()
let dom, vite, createRoot, root, AuthProvider, ProtectedRoute, AdminRoute, UserAvatar, useAuth, api, services, originalAdapter, originalConsoleError
let auth, errors = []

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: clientRoot, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: AuthProvider } = await vite.ssrLoadModule('/src/context/AuthProvider.jsx'))
  ;({ default: ProtectedRoute } = await vite.ssrLoadModule('/src/components/ProtectedRoute.jsx'))
  ;({ default: AdminRoute } = await vite.ssrLoadModule('/src/components/AdminRoute.jsx'))
  ;({ default: UserAvatar } = await vite.ssrLoadModule('/src/components/UserAvatar.jsx'))
  ;({ useAuth } = await vite.ssrLoadModule('/src/hooks/useAuth.js'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  services = await vite.ssrLoadModule('/src/services/authService.js')
  originalAdapter = api.defaults.adapter
  originalConsoleError = console.error
  console.error = (...values) => errors.push(values.map(String).join(' '))
})

after(async () => {
  if (root) await act(async () => root.unmount())
  if (api) api.defaults.adapter = originalAdapter
  if (originalConsoleError) console.error = originalConsoleError
  await vite?.close()
  dom?.window.close()
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

function response(config, data) { return { config, data, status: 200, statusText: 'OK', headers: {} } }
function httpError(config, status) {
  const error = new Error(`HTTP ${status} fixture`)
  error.config = config
  error.response = { status, data: { message: `Lỗi kiểm thử ${status}` }, config }
  return error
}
function deferred() {
  let resolve, reject
  const promise = new Promise((success, failure) => { resolve = success; reject = failure })
  return { promise, resolve, reject }
}
function fixture({ user = USER, handler } = {}) {
  const calls = []
  let csrf = 0
  return {
    calls,
    adapter: async (config) => {
      calls.push(config)
      const result = await handler?.(config)
      if (result !== undefined) return response(config, result)
      if (config.url === '/auth/csrf') return response(config, { csrfToken: `fixture-csrf-${++csrf}` })
      if (config.url === '/auth/me') {
        if (!user) throw httpError(config, 401)
        return response(config, { data: user })
      }
      if (config.url === '/auth/login') return response(config, { data: USER })
      if (config.url === '/auth/logout') return response(config, { message: 'Đăng xuất thành công.' })
      if (config.url === '/auth/register') return response(config, { data: USER })
      if (config.url === '/auth/profile') return response(config, { data: { ...USER, fullName: 'Tên đã cập nhật' } })
      if (config.url === '/admin/check') return response(config, { message: 'OK' })
      throw new Error(`Unexpected fixture endpoint: ${config.url}`)
    },
  }
}

function Probe() {
  const current = useAuth()
  React.useEffect(() => { auth = current }, [current])
  const location = useLocation()
  return React.createElement('output', { 'data-testid': 'session' }, `${current.sessionStatus}:${current.currentUser?.fullName || ''}:${location.pathname}:${location.state?.from || ''}`)
}
async function mount(mock, { path = '/', privateRoute = false, adminRoute = false, child } = {}) {
  if (root) await act(async () => root.unmount())
  root = null
  document.getElementById('root').replaceChildren()
  api.defaults.adapter = mock.adapter
  errors = []
  const content = child || React.createElement('p', {}, 'Nội dung tài khoản')
  const protectedContent = adminRoute ? React.createElement(AdminRoute, {}, content) : React.createElement(ProtectedRoute, {}, content)
  const routes = privateRoute || adminRoute
    ? React.createElement(Routes, {}, React.createElement(Route, { path: '/private', element: protectedContent }), React.createElement(Route, { path: '/login', element: React.createElement('p', {}, 'Trang đăng nhập') }))
    : content
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(React.StrictMode, {}, React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AuthProvider, {}, React.createElement(Probe), routes)))))
}
async function waitFor(assertion) {
  let lastError
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3)) })
    try { assertion(); return } catch (error) { lastError = error }
  }
  throw lastError
}
function text() { return document.getElementById('root').textContent }

test('StrictMode restores session with one me request and never persists an auth token', async () => {
  window.sessionStorage.setItem('smartcook:pantry:v1', 'retained pantry fixture')
  window.sessionStorage.setItem('smartcook:cooking:v1:8', 'retained cooking fixture')
  const mock = fixture()
  await mount(mock, { path: '/private', privateRoute: true })
  await waitFor(() => assert.equal(auth.isAuthenticated, true))
  assert.match(text(), /Nội dung tài khoản/)
  assert.equal(mock.calls.filter((call) => call.url === '/auth/me').length, 1)
  assert.equal(mock.calls[0].withCredentials, true)
  assert.equal(window.sessionStorage.length, 2)
  assert.equal(window.localStorage.length, 0)
  assert.deepEqual(errors, [])
})

test('guest guard redirects only after me401 and preserves path plus query', async () => {
  await mount(fixture({ user: null }), { path: '/private?tab=info', privateRoute: true })
  await waitFor(() => assert.equal(auth.sessionStatus, 'guest'))
  assert.match(text(), /Trang đăng nhập/)
  assert.match(text(), /\/login:\/private\?tab=info/)
  assert.doesNotMatch(text(), /Nội dung tài khoản/)
  assert.deepEqual(errors, [])
})

test('me503 keeps protected route closed with a retry that restores the authoritative session', async () => {
  let unavailable = true
  const mock = fixture({ handler(config) { if (config.url === '/auth/me' && unavailable) throw httpError(config, 503) } })
  await mount(mock, { path: '/private', privateRoute: true })
  await waitFor(() => assert.equal(auth.sessionStatus, 'unknown'))
  assert.match(text(), /Chưa thể kiểm tra phiên đăng nhập/)
  assert.doesNotMatch(text(), /Trang đăng nhập|Nội dung tài khoản/)
  unavailable = false
  await act(async () => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Thử lại').click())
  await waitFor(() => assert.equal(auth.isAuthenticated, true))
  assert.match(text(), /Nội dung tài khoản/)
  assert.deepEqual(errors, [])
})

test('stale me401 cannot replace a successful login and its bootstrap request is aborted', async () => {
  const pending = deferred()
  const mock = fixture({ handler(config) { if (config.url === '/auth/me') return pending.promise.then(() => { throw httpError(config, 401) }) } })
  await mount(mock)
  await waitFor(() => assert.equal(mock.calls.filter((call) => call.url === '/auth/me').length, 1))
  const firstMe = mock.calls.find((call) => call.url === '/auth/me')
  await act(async () => { await auth.login({ email: 'fixture@example.test', password: 'test fixture only' }) })
  assert.equal(firstMe.signal.aborted, true)
  await act(async () => { pending.resolve(); await new Promise((resolve) => setTimeout(resolve, 5)) })
  assert.equal(auth.isAuthenticated, true)
  assert.equal(auth.currentUser.userId, USER.userId)
  assert.deepEqual(errors, [])
})

test('failed early login does not leave an aborted bootstrap in perpetual loading', async () => {
  const pending = deferred()
  const mock = fixture({ handler(config) {
    if (config.url === '/auth/me') return pending.promise
    if (config.url === '/auth/login') throw httpError(config, 401)
  } })
  await mount(mock)
  await act(async () => { await assert.rejects(auth.login({ email: 'fixture@example.test', password: 'wrong fixture' })) })
  assert.equal(auth.isLoading, false)
  assert.equal(auth.sessionStatus, 'unknown')
  await act(async () => pending.resolve({ data: USER }))
  assert.equal(auth.isAuthenticated, false)
  assert.deepEqual(errors, [])
})

test('logout network failure retains the account; success sends JSON and fresh CSRF without touching pantry/cooking', async () => {
  let unavailable = true
  const mock = fixture({ handler(config) {
    if (config.url === '/auth/logout' && unavailable) throw new Error('fixture network failure')
  } })
  await mount(mock)
  await waitFor(() => assert.equal(auth.isAuthenticated, true))
  await act(async () => { await assert.rejects(auth.logout()) })
  assert.equal(auth.isAuthenticated, true)
  assert.match(auth.error, /Không thể kết nối/)
  unavailable = false
  await act(async () => { await auth.logout() })
  assert.equal(auth.currentUser, null)
  assert.equal(auth.isAuthenticated, false)
  const calls = mock.calls.filter((call) => call.url === '/auth/logout')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].data, '{}')
  assert.equal(calls[1].headers.get('X-CSRF-Token'), 'fixture-csrf-2')
  assert.equal(window.sessionStorage.getItem('smartcook:pantry:v1'), 'retained pantry fixture')
  assert.equal(window.sessionStorage.getItem('smartcook:cooking:v1:8'), 'retained cooking fixture')
  assert.equal(window.localStorage.length, 0)
  assert.deepEqual(errors, [])
})

test('current scoped401 revokes client session while rejected credentials do not', async () => {
  const mock = fixture({ handler(config) {
    if (config.url === '/auth/login' || config.url === '/auth/profile') throw httpError(config, 401)
  } })
  await mount(mock)
  await waitFor(() => assert.equal(auth.isAuthenticated, true))
  await act(async () => { await assert.rejects(auth.login({ email: 'wrong@example.test', password: 'wrong fixture' })) })
  assert.equal(auth.isAuthenticated, true)
  await act(async () => { await assert.rejects(auth.updateProfile({ fullName: 'Tên mới' })) })
  assert.equal(auth.isAuthenticated, false)
  assert.equal(auth.currentUser, null)
  assert.deepEqual(errors, [])
})

test('an earlier admin401 cannot clear a newly established login', async () => {
  const pending = deferred()
  const mock = fixture({ handler(config) { if (config.url === '/admin/check') return pending.promise.then(() => { throw httpError(config, 401) }) } })
  await mount(mock)
  await waitFor(() => assert.equal(auth.isAuthenticated, true))
  let staleCheck
  await act(async () => { staleCheck = services.checkAdminAccess().catch(() => null); await Promise.resolve() })
  await act(async () => { await auth.login({ email: 'fixture@example.test', password: 'test fixture only' }) })
  await act(async () => { pending.resolve(); await staleCheck })
  assert.equal(auth.isAuthenticated, true)
  assert.deepEqual(errors, [])
})

test('401 from any Admin endpoint expires the current session and keeps the requested path', async () => {
  const mock = fixture({ user: ADMIN, handler(config) {
    if (config.url === '/admin/dashboard') throw httpError(config, 401)
  } })
  await mount(mock, { path: '/private', adminRoute: true })
  await waitFor(() => assert.equal(auth.isAuthenticated, true))
  await act(async () => { await assert.rejects(api.get('/admin/dashboard')) })
  assert.equal(auth.isAuthenticated, false)
  assert.match(text(), /Trang đăng nhập/)
  assert.deepEqual(errors, [])
})

test('register remains guest and mutations fetch their own CSRF token, with no credential storage', async () => {
  const mock = fixture({ user: null })
  await mount(mock)
  await waitFor(() => assert.equal(auth.sessionStatus, 'guest'))
  await act(async () => { assert.equal((await auth.register({ fullName: USER.fullName, email: USER.email, password: 'fixture password' })).userId, USER.userId) })
  assert.equal(auth.isAuthenticated, false)
  await act(async () => { await auth.login({ email: USER.email, password: 'fixture password' }) })
  await act(async () => { await auth.updateProfile({ fullName: 'Tên mới', phone: null }) })
  const mutations = mock.calls.filter((call) => ['post', 'patch'].includes(call.method))
  assert.deepEqual(mutations.map((call) => call.headers.get('X-CSRF-Token')), ['fixture-csrf-1', 'fixture-csrf-2', 'fixture-csrf-3'])
  assert.equal(auth.currentUser.fullName, 'Tên đã cập nhật')
  assert.equal(window.localStorage.length, 0)
  assert.deepEqual(errors, [])
})

test('AdminRoute denies a User and permits the Admin UI fixture without granting database rights', async () => {
  const ordinary = fixture()
  await mount(ordinary, { path: '/private', adminRoute: true })
  await waitFor(() => assert.equal(auth.isAuthenticated, true))
  assert.match(text(), /Khu vực dành cho quản trị viên/)
  assert.doesNotMatch(text(), /Nội dung tài khoản/)
  assert.equal(ordinary.calls.filter((call) => call.url === '/admin/check').length, 0)
  await mount(fixture({ user: ADMIN }), { path: '/private', adminRoute: true })
  await waitFor(() => assert.equal(auth.currentUser?.role, 'Admin'))
  assert.match(text(), /Nội dung tài khoản/)
  assert.deepEqual(errors, [])
})

test('UserAvatar rejects executable and cross-origin-relative sources and uses a neutral fallback', async () => {
  for (const avatarUrl of ['javascript:alert(1)', 'data:image/svg+xml,fixture', '//untrusted.example/avatar.png', '/\\untrusted.example/avatar.png']) {
    await mount(fixture(), { child: React.createElement(UserAvatar, { user: { ...USER, avatarUrl } }) })
    assert.equal(document.querySelector('img'), null)
    assert.match(document.querySelector('[role="img"]').textContent, /KT/u)
  }
  await mount(fixture(), { child: React.createElement(UserAvatar, { user: { ...USER, avatar: '/uploads/avatar.png' } }) })
  assert.equal(document.querySelector('img').getAttribute('src'), '/uploads/avatar.png')
  assert.equal(document.querySelector('img').getAttribute('referrerpolicy'), 'no-referrer')
  assert.deepEqual(errors, [])
})
