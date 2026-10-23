import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Controlled HTTP fixtures only. Production routes, context, forms, Axios,
// guards and Navbar are mounted together in BrowserRouter and StrictMode.
const globals = new Map()
const user = { userId: 987, fullName: 'Nguyễn Mai Kiểm Thử', email: 'mai.test@example.com', phone: null, avatar: null, role: 'User', createdAt: '2026-10-18T09:00:00.000Z' }
const password = '  cụm mật khẩu rất dài  '
let dom, vite, App, api, root, createRoot, oldAdapter, oldConsoleError
let consoleErrors = []

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/login', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent', 'PopStateEvent']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  dom.window.scrollTo = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  oldAdapter = api.defaults.adapter
  oldConsoleError = console.error
  console.error = (...values) => { consoleErrors.push(values.map(String).join(' ')) }
})

after(async () => {
  if (root) await act(async () => root.unmount())
  if (api) api.defaults.adapter = oldAdapter
  if (oldConsoleError) console.error = oldConsoleError
  await vite?.close()
  dom?.window.close()
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

function reject(config, status, message) {
  const error = new Error(message)
  error.config = config
  error.response = { status, data: { message }, config }
  throw error
}
function fixture({ session = null, handler } = {}) {
  const state = { session, calls: [], failLogout: false }
  state.adapter = async (config) => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const call = { path: config.url, method: config.method, body, config }
    state.calls.push(call)
    if (handler) {
      const custom = await handler(call, state)
      if (custom !== undefined) return { data: custom, status: 200, statusText: 'OK', headers: {}, config }
    }
    let data
    switch (config.url) {
      case '/favorites/ids': data = { data: [] }; break
      case '/auth/csrf': data = { csrfToken: 'controlled-test-csrf' }; break
      case '/auth/me':
        if (!state.session) return reject(config, 401, 'Bạn cần đăng nhập để tiếp tục.')
        data = { data: state.session }; break
      case '/auth/register': data = { data: { ...user, fullName: body.fullName, email: body.email } }; break
      case '/auth/login': state.session = { ...user }; data = { data: state.session }; break
      case '/auth/logout':
        if (state.failLogout) return reject(config, 503, 'Chưa thể đăng xuất. Vui lòng thử lại.')
        state.session = null; data = { message: 'Đã đăng xuất.' }; break
      case '/auth/profile':
        if (!state.session) return reject(config, 401, 'Phiên đăng nhập đã kết thúc.')
        state.session = { ...state.session, ...body }; data = { data: state.session }; break
      case '/admin/dashboard':
        if (state.session?.role !== 'Admin') return reject(config, 403, 'Bạn không có quyền quản trị.')
        data = { data: { totals: { recipeCount: 0, ingredientCount: 0, categoryCount: 0, userCount: 1, reviewCount: 0, favoriteCount: 0 }, mostFavorited: [], mostReviewed: [], newestRecipes: [] } }; break
      case '/categories': data = { data: [] }; break
      case '/recipes': data = { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }; break
      default: throw new Error(`Unexpected auth-test endpoint: ${config.url}`)
    }
    return { data, status: config.url === '/auth/register' ? 201 : 200, statusText: 'OK', headers: {}, config }
  }
  return state
}

async function mount(path, state, { preserveStorage = false, routeState = null } = {}) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren()
  if (!preserveStorage) { window.localStorage.clear(); window.sessionStorage.clear() }
  window.history.replaceState(routeState ? { usr: routeState, key: 'auth-test' } : null, '', path)
  api.defaults.adapter = state.adapter
  consoleErrors = []
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(App)))
}
async function waitFor(check) {
  let last
  for (let count = 0; count < 100; count += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
    try { check(); return } catch (error) { last = error }
  }
  throw last
}
function main() { return document.querySelector('main') }
function text() { return document.body.textContent }
function field(name) { const element = main().querySelector(`input[name="${name}"]`); assert.ok(element, `Field ${name}`); return element }
function button(label, scope = main()) {
  const element = [...scope.querySelectorAll('button')].find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label)
  assert.ok(element, `Button ${label}`)
  return element
}
async function click(element) { await act(async () => element.click()) }
async function fill(name, value) {
  const element = field(name)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function submit() { await act(async () => main().querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
async function formReady(name = 'email') { await waitFor(() => assert.ok(main().querySelector(`input[name="${name}"]`))) }
async function login() { await fill('email', user.email); await fill('password', password); await submit() }
function writes(state) { return state.calls.filter((call) => ['post', 'patch'].includes(call.method)) }
function noErrors() { assert.deepEqual(consoleErrors, [], 'No React DOM/act errors') }

test('guest form validates each field, toggles password, and never sends invalid credentials', async () => {
  const state = fixture()
  await mount('/login', state)
  await formReady()
  assert.equal(state.calls.filter((call) => call.path === '/auth/me').length, 1, 'StrictMode does not duplicate bootstrap request')
  await fill('email', 'invalid')
  await fill('password', 'short')
  await submit()
  assert.equal(field('email').getAttribute('aria-invalid'), 'true')
  assert.ok(document.getElementById(field('email').getAttribute('aria-describedby')))
  assert.equal(document.activeElement, field('email'))
  assert.equal(writes(state).length, 0)
  await click(button('Hiện mật khẩu'))
  assert.equal(field('password').type, 'text')
  await click(button('Ẩn mật khẩu'))
  assert.equal(field('password').type, 'password')
  noErrors()
})

test('registration normalizes public fields, preserves password exactly and requires a separate login', async () => {
  const state = fixture()
  await mount('/register', state)
  await formReady('fullName')
  await fill('fullName', '  Nguyễn   Mai  ')
  await fill('email', '  MAI.TEST@EXAMPLE.COM  ')
  await fill('password', password)
  await fill('confirmPassword', 'không khớp')
  await submit()
  assert.equal(writes(state).length, 0)
  assert.match(text(), /Mật khẩu xác nhận chưa khớp/)
  await fill('confirmPassword', password)
  await submit()
  await waitFor(() => assert.equal(window.location.pathname, '/login'))
  assert.match(text(), /Đăng ký thành công/)
  assert.equal(field('email').value, user.email)
  assert.equal(field('password').value, '')
  assert.equal(state.session, null)
  const request = writes(state)[0]
  assert.deepEqual(request.body, { fullName: 'Nguyễn Mai', email: user.email, password })
  assert.equal(request.config.headers.get('X-CSRF-Token'), 'controlled-test-csrf')
  assert.equal(window.history.state.usr.password, undefined)
  assert.equal(window.localStorage.length, 0)
  assert.equal(window.sessionStorage.length, 0)
  noErrors()
})

test('registration disables form while pending and does not duplicate a submitted request', async () => {
  let complete
  const state = fixture({ handler: (call) => {
    if (call.path === '/auth/register') return new Promise((resolve) => { complete = () => resolve({ data: { ...user } }) })
  } })
  await mount('/register', state)
  await formReady('fullName')
  await fill('fullName', user.fullName)
  await fill('email', user.email)
  await fill('password', password)
  await fill('confirmPassword', password)
  await submit()
  await waitFor(() => assert.equal(typeof complete, 'function'))
  assert.equal(button('Đang tạo tài khoản…').disabled, true)
  assert.equal(field('password').disabled, true)
  await submit()
  assert.equal(writes(state).length, 1)
  await act(async () => complete())
  await formReady()
  assert.equal(window.location.pathname, '/login')
  noErrors()
})

test('ProtectedRoute preserves internal destination and successful login restores it with authenticated Navbar', async () => {
  const state = fixture()
  await mount('/profile?view=me', state)
  await formReady()
  assert.equal(window.location.pathname, '/login')
  assert.equal(window.history.state.usr.from, '/profile?view=me')
  await login()
  await waitFor(() => assert.ok(main().querySelector('h1')?.textContent.includes('Hồ sơ cá nhân')))
  assert.equal(window.location.search, '?view=me')
  assert.ok(document.querySelector(`header a[aria-label="Hồ sơ của ${user.fullName}"]`))
  assert.equal(document.querySelector('header a[href="/admin"]'), null)
  assert.equal(state.calls.filter((call) => call.path === '/auth/login').length, 1)
  assert.equal(window.localStorage.length, 0)
  assert.equal(window.sessionStorage.length, 0)
  noErrors()
})

test('rejected credentials and CSRF errors remain guest with actionable message; retry reaches actual login', async () => {
  let status = 401
  const state = fixture({ handler: (call) => {
    if (call.path === '/auth/login' && status) return reject(call.config, status, status === 401 ? 'Email hoặc mật khẩu không đúng.' : 'Yêu cầu CSRF không hợp lệ.')
  } })
  await mount('/login', state)
  await formReady()
  await login()
  assert.match(text(), /Email hoặc mật khẩu không đúng/)
  assert.equal(window.location.pathname, '/login')
  assert.equal(state.session, null)
  status = 403
  await submit()
  assert.match(text(), /Yêu cầu CSRF không hợp lệ/)
  status = 0
  await submit()
  await waitFor(() => assert.equal(window.location.pathname, '/profile'))
  noErrors()
})

test('existing cookie session restores from /me on reload and profile updates only allowed fields', async () => {
  const state = fixture({ session: { ...user } })
  await mount('/profile', state)
  await formReady('fullName')
  assert.equal(field('accountEmail').readOnly, true)
  assert.equal(field('fullName').value, user.fullName)
  assert.match(text(), /18 tháng 10, 2026/)
  await fill('fullName', '  Mai   Sau Cập Nhật  ')
  await fill('phone', ' +84 (90) 123-456 ')
  await submit()
  await waitFor(() => assert.match(text(), /Đã cập nhật hồ sơ/))
  assert.deepEqual(writes(state).at(-1).body, { fullName: 'Mai Sau Cập Nhật', phone: '+84 (90) 123-456' })
  assert.equal(state.session.role, 'User')
  assert.equal(state.session.email, user.email)
  assert.ok(document.querySelector('header a[aria-label="Hồ sơ của Mai Sau Cập Nhật"]'))
  await mount('/profile', state, { preserveStorage: true })
  await formReady('fullName')
  assert.equal(field('fullName').value, 'Mai Sau Cập Nhật')
  assert.equal(state.calls.filter((call) => call.path === '/auth/me').length, 2)
  noErrors()
})

test('profile validation blocks unsupported phone and failed save preserves editable draft', async () => {
  const state = fixture({ session: { ...user }, handler: (call) => {
    if (call.path === '/auth/profile') return reject(call.config, 503, 'Chưa thể lưu thông tin.')
  } })
  await mount('/profile', state)
  await formReady('fullName')
  await fill('phone', 'abcdefg')
  await submit()
  assert.equal(writes(state).length, 0)
  assert.equal(field('phone').getAttribute('aria-invalid'), 'true')
  await fill('phone', '0901234567')
  await fill('fullName', 'Tên chưa lưu')
  await submit()
  assert.match(text(), /Chưa thể lưu thông tin/)
  assert.equal(field('fullName').value, 'Tên chưa lưu')
  assert.equal(state.session.fullName, user.fullName)
  noErrors()
})

test('unknown session network state can retry without pretending the user is logged out', async () => {
  let offline = true
  const state = fixture({ session: { ...user }, handler: (call) => {
    if (call.path === '/auth/me' && offline) { const error = new Error('Controlled network failure'); error.config = call.config; throw error }
  } })
  await mount('/profile', state)
  await waitFor(() => assert.match(text(), /Chưa thể kiểm tra phiên đăng nhập/))
  assert.equal(window.location.pathname, '/profile')
  offline = false
  await click(button('Thử lại'))
  await formReady('fullName')
  assert.equal(field('fullName').value, user.fullName)
  noErrors()
})

test('AdminRoute rejects User without requesting protected endpoint; Admin dashboard requests server statistics', async () => {
  const regular = fixture({ session: { ...user } })
  await mount('/admin', regular)
  await waitFor(() => assert.match(text(), /Khu vực dành cho quản trị viên/))
  assert.equal(regular.calls.some((call) => call.path === '/admin/dashboard'), false)
  const admin = fixture({ session: { ...user, role: 'Admin' } })
  await mount('/admin', admin)
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/))
  assert.ok(admin.calls.some((call) => call.path === '/admin/dashboard'))
  assert.ok(document.querySelector('aside nav a[href="/admin"][aria-current="page"]'))
  assert.equal(document.querySelector('footer'), null, 'Admin has a separate layout')
  assert.equal(writes(admin).length, 0, 'mock Admin is not created or promoted through API')
  noErrors()
})

test('Admin dashboard honors a real server rejection and offers retry without claiming statistics', async () => {
  let deny = true
  const state = fixture({ session: { ...user, role: 'Admin' }, handler: (call) => {
    if (call.path === '/admin/dashboard' && deny) return reject(call.config, 403, 'Quyền quản trị không còn hiệu lực.')
  } })
  await mount('/admin', state)
  await waitFor(() => assert.match(text(), /Quyền quản trị không còn hiệu lực/))
  assert.doesNotMatch(text(), /Góc nhìn tổng thể/)
  deny = false
  await click(button('Thử lại'))
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/))
  assert.equal(writes(state).length, 0)
  noErrors()
})

test('logout calls CSRF-protected server, preserves pantry/cooking and reload stays guest', async () => {
  const state = fixture({ session: { ...user } })
  await mount('/profile', state)
  await formReady('fullName')
  window.sessionStorage.setItem('smartcook:pantry:v1', '{"version":1,"ingredientIds":[64],"servings":2}')
  window.sessionStorage.setItem('smartcook:cooking:v1:8', '{"version":1,"servings":2}')
  const previous = { ...window.sessionStorage }
  await click(button('Đăng xuất', document.querySelector('header')))
  await waitFor(() => assert.equal(window.location.pathname, '/'))
  assert.equal(state.session, null)
  assert.deepEqual({ ...window.sessionStorage }, previous)
  const logout = state.calls.find((call) => call.path === '/auth/logout')
  assert.equal(logout.config.headers.get('X-CSRF-Token'), 'controlled-test-csrf')
  await mount('/profile', state, { preserveStorage: true })
  await formReady()
  assert.equal(window.location.pathname, '/login')
  assert.deepEqual({ ...window.sessionStorage }, previous)
  assert.equal(window.localStorage.length, 0)
  noErrors()
})

test('failed logout keeps authenticated session available for a real retry', async () => {
  const state = fixture({ session: { ...user } })
  state.failLogout = true
  await mount('/profile', state)
  await formReady('fullName')
  await click(button('Đăng xuất', document.querySelector('header')))
  assert.match(text(), /Chưa thể đăng xuất/)
  assert.equal(window.location.pathname, '/profile')
  assert.ok(document.querySelector(`header a[aria-label="Hồ sơ của ${user.fullName}"]`))
  state.failLogout = false
  await click(button('Đăng xuất', document.querySelector('header')))
  await waitFor(() => assert.equal(window.location.pathname, '/'))
  assert.equal(state.calls.filter((call) => call.path === '/auth/logout').length, 2)
  noErrors()
})

test('401 from expired profile session clears auth and returns through ProtectedRoute to login', async () => {
  const state = fixture({ session: { ...user } })
  await mount('/profile', state)
  await formReady('fullName')
  state.session = null
  await fill('fullName', 'Tên khi hết phiên')
  await submit()
  await formReady()
  assert.equal(window.location.pathname, '/login')
  assert.equal(document.querySelector(`header a[aria-label="Hồ sơ của ${user.fullName}"]`), null)
  assert.equal(window.history.state.usr.from, '/profile')
  noErrors()
})

test('login rejects external return route and mobile Navbar opens/closes real account links', async () => {
  const state = fixture()
  await mount('/login', state, { routeState: { from: '//evil.test/steal' } })
  await formReady()
  await login()
  await formReady('fullName')
  assert.equal(window.location.pathname, '/profile')
  const header = document.querySelector('header')
  const toggle = button('Mở menu', header)
  await click(toggle)
  assert.equal(toggle.getAttribute('aria-expanded'), 'true')
  assert.equal(document.getElementById('mobile-menu').hidden, false)
  const profile = document.querySelector('#mobile-menu a[href="/profile"]')
  assert.ok(profile)
  await click(profile)
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  noErrors()
})
