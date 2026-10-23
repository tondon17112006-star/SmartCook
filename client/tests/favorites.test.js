import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// HTTP fixtures are scoped to DOM tests only. All context, guards, service,
// Axios, cards and page code below is loaded from the production sources.
const USER = { userId: 24, fullName: 'Người dùng kiểm thử', email: 'favorites.fixture@example.test', role: 'User' }
const globals = new Map()
let dom, vite, root, createRoot, AuthProvider, FavoriteProvider, FavoriteButton, Favorites, ProtectedRoute, useAuth, useFavorites, api, originalAdapter, originalConsoleError
let auth, favorites, errors = []

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: AuthProvider } = await vite.ssrLoadModule('/src/context/AuthProvider.jsx'))
  ;({ default: FavoriteProvider } = await vite.ssrLoadModule('/src/context/FavoriteProvider.jsx'))
  ;({ default: FavoriteButton } = await vite.ssrLoadModule('/src/components/FavoriteButton.jsx'))
  ;({ default: Favorites } = await vite.ssrLoadModule('/src/pages/Favorites.jsx'))
  ;({ default: ProtectedRoute } = await vite.ssrLoadModule('/src/components/ProtectedRoute.jsx'))
  ;({ default: useAuth } = await vite.ssrLoadModule('/src/hooks/useAuth.js'))
  ;({ default: useFavorites } = await vite.ssrLoadModule('/src/hooks/useFavorites.js'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
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

function reject(config, status, message = 'Yêu cầu chưa thực hiện được.') {
  const error = new Error(message)
  error.config = config
  error.response = { config, status, data: { message } }
  throw error
}
function deferred() {
  let resolve
  const promise = new Promise((complete) => { resolve = complete })
  return { promise, resolve }
}
function fixture({ session = USER, saved = [], handler } = {}) {
  const state = { session, ids: new Set(saved), calls: [] }
  state.adapter = async (config) => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const call = { config, path: config.url, method: config.method, body, params: config.params }
    state.calls.push(call)
    let data = await handler?.(call, state)
    if (data === undefined) {
      if (call.path === '/auth/csrf') data = { csrfToken: 'fixture-csrf-token' }
      else if (call.path === '/auth/me') {
        if (!state.session) return reject(config, 401)
        data = { data: state.session }
      } else if (call.path === '/auth/logout') { state.session = null; data = { message: 'Đã đăng xuất.' } }
      else if (call.path === '/auth/login') { state.session = USER; data = { data: USER } }
      else if (call.path === '/favorites/ids') data = { data: [...state.ids] }
      else if (call.path === '/favorites' && call.method === 'get') {
        const ids = [...state.ids]
        const page = call.params.page
        const limit = call.params.limit
        data = { data: ids.slice((page - 1) * limit, page * limit).map((id) => ({ recipeId: id, recipeName: `Món kiểm thử ${id}`, difficulty: 'Dễ', totalTime: 20, imageUrl: null })), pagination: { page, limit, total: ids.length, totalPages: Math.ceil(ids.length / limit) } }
      } else if (call.path === '/favorites' && call.method === 'post') { state.ids.add(body.recipeId); data = { message: 'Đã lưu.' } }
      else if (/^\/favorites\/\d+$/u.test(call.path) && call.method === 'delete') { state.ids.delete(Number(call.path.split('/').at(-1))); data = { message: 'Đã bỏ.' } }
      else throw new Error(`Unexpected favorites fixture endpoint ${call.method} ${call.path}`)
    }
    return { config, data, status: call.method === 'post' ? 201 : 200, statusText: 'OK', headers: {} }
  }
  return state
}
function Probe() {
  const session = useAuth()
  const saved = useFavorites()
  const location = useLocation()
  React.useEffect(() => { auth = session; favorites = saved }, [session, saved])
  return React.createElement('output', { 'data-location': true }, `${location.pathname}${location.search}|${location.state?.from || ''}`)
}
async function mount(state, { page = false, path = '/recipes/1?servings=4', duplicate = false } = {}) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren()
  window.localStorage.clear()
  window.sessionStorage.clear()
  api.defaults.adapter = state.adapter
  errors = []
  const heart = React.createElement(FavoriteButton, { recipeId: 1, recipeName: 'Món kiểm thử 1' })
  const content = page ? React.createElement(ProtectedRoute, {}, React.createElement(Favorites)) : React.createElement(React.Fragment, {}, heart, duplicate ? heart : null)
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(React.StrictMode, {}, React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AuthProvider, {}, React.createElement(FavoriteProvider, {}, React.createElement(Probe), React.createElement(Routes, {}, React.createElement(Route, { path: '/login', element: React.createElement('h1', {}, 'Trang đăng nhập') }), React.createElement(Route, { path: '*', element: content }))))))))
}
async function waitFor(check) {
  let last
  for (let count = 0; count < 120; count += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3)) })
    try { check(); return } catch (error) { last = error }
  }
  throw last
}
function hearts() { return [...document.querySelectorAll('button[aria-pressed]')] }
function text() { return document.body.textContent }
function button(label) {
  const result = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === label || element.getAttribute('aria-label') === label)
  assert.ok(result, `Button ${label}`)
  return result
}
async function click(element) { await act(async () => element.click()) }
function writes(state) { return state.calls.filter((call) => ['post', 'delete'].includes(call.method) && call.path.startsWith('/favorites')) }
function noErrors() { assert.deepEqual(errors, []) }

test('guest heart navigates to login preserving an internal path and never loads or writes favorites', async () => {
  const state = fixture({ session: null })
  await mount(state)
  await waitFor(() => assert.equal(auth.sessionStatus, 'guest'))
  await click(hearts()[0])
  assert.match(text(), /Trang đăng nhập/)
  assert.equal(document.querySelector('[data-location]').textContent, '/login|/recipes/1?servings=4')
  assert.equal(state.calls.some((call) => call.path.startsWith('/favorites')), false)
  noErrors()
})

test('StrictMode loads favorite IDs once and shares their confirmed state between heart instances', async () => {
  const state = fixture({ saved: [1] })
  await mount(state, { duplicate: true })
  await waitFor(() => assert.equal(favorites.isReady, true))
  assert.equal(state.calls.filter((call) => call.path === '/favorites/ids').length, 1)
  assert.equal(hearts().length, 2)
  assert.ok(hearts().every((element) => element.getAttribute('aria-pressed') === 'true'))
  assert.ok(hearts().every((element) => element.getAttribute('aria-label') === 'Bỏ yêu thích Món kiểm thử 1'))
  assert.equal(window.localStorage.length + window.sessionStorage.length, 0)
  noErrors()
})

test('pending add blocks duplicate requests across buttons and updates both only after server success', async () => {
  const pending = deferred()
  const state = fixture({ handler: (call) => call.path === '/favorites' && call.method === 'post' ? pending.promise : undefined })
  await mount(state, { duplicate: true })
  await waitFor(() => assert.equal(favorites.isReady, true))
  await click(hearts()[0])
  await waitFor(() => assert.equal(writes(state).length, 1))
  assert.ok(hearts().every((element) => element.disabled))
  assert.ok(hearts().every((element) => element.getAttribute('aria-pressed') === 'false'))
  await click(hearts()[1])
  assert.equal(writes(state).length, 1)
  await act(async () => pending.resolve({ message: 'Lưu thành công.' }))
  assert.ok(hearts().every((element) => element.getAttribute('aria-pressed') === 'true'))
  assert.match(text(), /Đã lưu món ăn yêu thích/)
  assert.deepEqual(writes(state)[0].body, { recipeId: 1 })
  assert.equal(writes(state)[0].config.headers.get('X-CSRF-Token'), 'fixture-csrf-token')
  noErrors()
})

test('failed add keeps confirmed state and exposes the server error without a success message', async () => {
  const state = fixture({ handler(call) { if (call.path === '/favorites' && call.method === 'post') return reject(call.config, 503, 'Chưa thể lưu món yêu thích.') } })
  await mount(state)
  await waitFor(() => assert.equal(favorites.isReady, true))
  await click(hearts()[0])
  assert.equal(hearts()[0].getAttribute('aria-pressed'), 'false')
  assert.match(text(), /Chưa thể lưu món yêu thích/)
  assert.doesNotMatch(text(), /Đã lưu món ăn yêu thích/)
  assert.equal(hearts()[0].disabled, false)
  noErrors()
})

test('failed ID loading offers retry and never blindly toggles unknown server state', async () => {
  let fail = true
  const state = fixture({ saved: [1], handler(call) { if (call.path === '/favorites/ids' && fail) return reject(call.config, 503) } })
  await mount(state)
  await waitFor(() => assert.ok(favorites.error))
  assert.match(text(), /Nhấn trái tim để thử lại/)
  fail = false
  await click(hearts()[0])
  await waitFor(() => assert.equal(favorites.isReady, true))
  assert.equal(writes(state).length, 0)
  assert.equal(hearts()[0].getAttribute('aria-pressed'), 'true')
  noErrors()
})

test('duplicate from another tab reconciles real server IDs while retaining the rejected action message', async () => {
  const state = fixture({ handler(call, current) {
    if (call.path === '/favorites' && call.method === 'post') {
      current.ids.add(1)
      return reject(call.config, 409, 'Món ăn đã có trong yêu thích.')
    }
  } })
  await mount(state)
  await waitFor(() => assert.equal(favorites.isReady, true))
  await click(hearts()[0])
  await waitFor(() => assert.equal(hearts()[0].getAttribute('aria-pressed'), 'true'))
  assert.match(text(), /Món ăn đã có trong yêu thích/)
  assert.doesNotMatch(text(), /Đã lưu món ăn yêu thích/)
  assert.equal(state.calls.filter((call) => call.path === '/favorites/ids').length, 2)
  assert.equal(favorites.revision, 1)
  noErrors()
})

test('Favorites shows API cards, confirms removal, sends CSRF JSON DELETE and reaches the empty state', async () => {
  const state = fixture({ saved: [1] })
  await mount(state, { page: true, path: '/favorites' })
  await waitFor(() => assert.ok(document.querySelector('a[aria-label="Xem công thức Món kiểm thử 1"]')))
  const link = document.querySelector('a[aria-label="Xem công thức Món kiểm thử 1"]')
  assert.equal(link.querySelector('button'), null, 'Heart is outside the recipe link')
  await click(hearts()[0])
  assert.match(text(), /khỏi món yêu thích\?/)
  assert.equal(writes(state).length, 0)
  await click(button('Giữ lại'))
  assert.equal(writes(state).length, 0)
  await click(hearts()[0])
  await click(button('Bỏ yêu thích'))
  await waitFor(() => assert.match(text(), /Bạn chưa lưu món ăn nào/))
  assert.ok(document.querySelector('a[href="/recipes"]'))
  assert.equal(writes(state)[0].path, '/favorites/1')
  assert.deepEqual(writes(state)[0].body, {})
  assert.equal(writes(state)[0].config.headers.get('X-CSRF-Token'), 'fixture-csrf-token')
  noErrors()
})

test('Favorites displays loading, retries a failed list request and paginates server results', async () => {
  let fail = true
  const pending = deferred()
  let first = true
  const state = fixture({ saved: Array.from({ length: 13 }, (_, index) => index + 1), handler(call) {
    if (call.path === '/favorites' && call.method === 'get' && first) { first = false; return pending.promise.then(() => reject(call.config, 503, 'Danh sách tạm gián đoạn.')) }
    if (call.path === '/favorites' && call.method === 'get' && fail) return reject(call.config, 503)
  } })
  await mount(state, { page: true, path: '/favorites' })
  await waitFor(() => assert.equal(first, false))
  assert.match(text(), /Đang tải các công thức/)
  await act(async () => pending.resolve())
  assert.match(text(), /Danh sách tạm gián đoạn/)
  fail = false
  await click(button('Thử lại'))
  await waitFor(() => assert.equal(document.querySelectorAll('article').length, 12))
  await click(button('Trang sau'))
  await waitFor(() => assert.match(document.querySelector('article').textContent, /Món kiểm thử 13/))
  assert.equal(document.querySelectorAll('article').length, 1)
  assert.ok(state.calls.some((call) => call.path === '/favorites' && call.params?.page === 2))
  noErrors()
})

test('logout resets IDs and a previous session ID request cannot populate a newly logged-in session', async () => {
  const pending = deferred()
  let count = 0
  const state = fixture({ handler(call) { if (call.path === '/favorites/ids' && ++count === 1) return pending.promise } })
  await mount(state)
  await waitFor(() => assert.equal(count, 1))
  await act(async () => { await auth.logout() })
  assert.equal(favorites.ids.size, 0)
  state.ids.add(2)
  await act(async () => { await auth.login({ email: USER.email, password: 'DOM fixture only' }) })
  await waitFor(() => assert.equal(favorites.isReady, true))
  assert.deepEqual([...favorites.ids], [2])
  await act(async () => pending.resolve({ data: [1] }))
  assert.deepEqual([...favorites.ids], [2])
  assert.equal(window.localStorage.length + window.sessionStorage.length, 0)
  noErrors()
})

test('stale successful mutation after same-user re-login cannot update its new session or show success', async () => {
  const pending = deferred()
  const state = fixture({ handler: (call) => call.path === '/favorites' && call.method === 'post' ? pending.promise : undefined })
  await mount(state)
  await waitFor(() => assert.equal(favorites.isReady, true))
  await click(hearts()[0])
  await waitFor(() => assert.equal(writes(state).length, 1))
  await act(async () => { await auth.login({ email: USER.email, password: 'new fixture session' }) })
  await waitFor(() => assert.equal(favorites.isReady, true))
  await act(async () => pending.resolve({ message: 'Old session success' }))
  assert.equal(favorites.ids.size, 0)
  assert.equal(hearts()[0].getAttribute('aria-pressed'), 'false')
  assert.doesNotMatch(text(), /Đã lưu món ăn yêu thích/)
  noErrors()
})

test('switching accounts while CSRF is pending aborts the old favorite before it can write with a new cookie', async () => {
  const pending = deferred()
  let waitForCsrf = true
  const state = fixture({ handler(call) {
    if (call.path === '/auth/csrf' && waitForCsrf) return pending.promise
  } })
  await mount(state)
  await waitFor(() => assert.equal(favorites.isReady, true))
  await click(hearts()[0])
  await waitFor(() => assert.equal(state.calls.filter((call) => call.path === '/auth/csrf').length, 1))
  const csrf = state.calls.find((call) => call.path === '/auth/csrf')
  waitForCsrf = false
  await act(async () => { await auth.login({ email: USER.email, password: 'new controlled session' }) })
  await waitFor(() => assert.equal(favorites.isReady, true))
  assert.equal(csrf.config.signal.aborted, true)
  await act(async () => pending.resolve({ csrfToken: 'old-account-csrf' }))
  assert.equal(writes(state).length, 0)
  assert.equal(favorites.ids.size, 0)
  assert.doesNotMatch(text(), /Đã lưu món ăn yêu thích/)
  noErrors()
})

test('current favorites401 expires the session and ProtectedRoute redirects instead of exposing private cards', async () => {
  const state = fixture({ saved: [1], handler(call) { if (call.path === '/favorites' && call.method === 'get') return reject(call.config, 401, 'Phiên đăng nhập đã kết thúc.') } })
  await mount(state, { page: true, path: '/favorites' })
  await waitFor(() => assert.match(text(), /Trang đăng nhập/))
  assert.equal(auth.isAuthenticated, false)
  assert.equal(favorites.ids.size, 0)
  assert.equal(document.querySelector('article'), null)
  assert.equal(document.querySelector('[data-location]').textContent, '/login|/favorites')
  noErrors()
})
