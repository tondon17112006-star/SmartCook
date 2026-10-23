import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Step 11 navigation races use real pages/context/router/Axios with deferred
// HTTP responses. No runtime fixture or database account is introduced.
const descriptors = new Map()
const user = { userId: 901, fullName: 'Người thử điều hướng', email: 'navigation.fixture@example.test', role: 'User', phone: null, avatar: null, createdAt: '2026-10-23T03:00:00Z' }
let dom, vite, App, api, root, createRoot, oldAdapter, previousConsoleError
let reactErrors = []
before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/login', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent', 'PopStateEvent']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  descriptors.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  dom.window.scrollTo = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  oldAdapter = api.defaults.adapter
  previousConsoleError = console.error
  console.error = (...values) => reactErrors.push(values.map(String).join(' '))
})
after(async () => {
  if (root) await act(async () => root.unmount())
  api.defaults.adapter = oldAdapter
  console.error = previousConsoleError
  await vite?.close()
  dom?.window.close()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})
function fixture(operation) {
  const state = { calls: [], session: null, complete: null }
  state.adapter = async (config) => {
    state.calls.push(config)
    const response = (data) => ({ data, config, status: 200, statusText: 'OK', headers: {} })
    if (config.url === '/auth/me') {
      const error = new Error('Bạn cần đăng nhập.')
      error.config = config; error.response = { status: 401, data: { message: error.message }, config }
      throw error
    }
    if (config.url === '/auth/csrf') return response({ csrfToken: 'navigation-controlled-csrf' })
    if (config.url === `/auth/${operation}`) return new Promise((resolve) => {
      state.complete = () => {
        if (operation === 'login') state.session = user
        resolve(response({ data: user }))
      }
    })
    if (config.url === '/categories' || config.url === '/favorites/ids') return response({ data: [] })
    if (config.url === '/recipes') return response({ data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } })
    throw new Error(`Unexpected navigation fixture endpoint ${config.url}`)
  }
  return state
}
async function waitFor(check) {
  let last
  for (let count = 0; count < 100; count += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
    try { check(); return } catch (error) { last = error }
  }
  throw last
}
async function mount(path, state) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren()
  window.localStorage.clear(); window.sessionStorage.clear()
  window.history.replaceState(null, '', path)
  api.defaults.adapter = state.adapter
  reactErrors = []
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(App)))
  await waitFor(() => assert.ok(document.querySelector('main input[name="email"]')))
}
async function fill(name, value) {
  const element = document.querySelector(`main input[name="${name}"]`)
  assert.ok(element)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function startAndLeave(operation, state) {
  const password = 'Cụm mật khẩu kiểm thử điều hướng'
  await mount(`/${operation}`, state)
  await fill('email', user.email)
  await fill('password', password)
  if (operation === 'register') { await fill('fullName', user.fullName); await fill('confirmPassword', password) }
  await act(async () => document.querySelector('main form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => assert.equal(typeof state.complete, 'function'))
  assert.equal(document.querySelector('main button[type="submit"]').disabled, true)
  await act(async () => document.querySelector('header a[href="/recipes"]').click())
  await waitFor(() => assert.equal(window.location.pathname, '/recipes'))
  await waitFor(() => assert.match(document.querySelector('main').textContent, /Khám phá món ngon mỗi ngày/u))
}
test('QA11-FE-001 late registration success cannot redirect a user who already left the form', async () => {
  const state = fixture('register')
  await startAndLeave('register', state)
  await act(async () => state.complete())
  assert.equal(window.location.pathname, '/recipes')
  assert.equal(state.session, null, 'Registration still requires a separate login')
  assert.doesNotMatch(document.querySelector('main').textContent, /Đăng ký thành công/u)
  assert.equal(state.calls.filter((config) => config.url === '/auth/register').length, 1)
  assert.deepEqual(reactErrors, [])
})
test('QA11-FE-002 late login success reconciles its session without redirecting an abandoned form', async () => {
  const state = fixture('login')
  await startAndLeave('login', state)
  await act(async () => state.complete())
  assert.equal(window.location.pathname, '/recipes')
  assert.equal(state.session?.userId, user.userId, 'A request already sent may legitimately establish its server session')
  await waitFor(() => assert.ok(document.querySelector(`header a[aria-label="Hồ sơ của ${user.fullName}"]`)))
  assert.equal(state.calls.filter((config) => config.url === '/auth/login').length, 1)
  assert.equal(window.localStorage.length, 0)
  assert.equal(window.sessionStorage.length, 0)
  assert.deepEqual(reactErrors, [])
})
