import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const USER = { userId: 43, fullName: 'Người dùng thử đánh giá', email: 'review.fixture@example.test', role: 'User' }
const REVIEW = { reviewId: 901, recipeId: 1, userId: USER.userId, fullName: USER.fullName, rating: 4, comment: 'Món ăn hợp khẩu vị.', createdAt: '2026-10-22T03:00:00.000Z' }
const globals = new Map()
let dom, vite, root, createRoot, AuthProvider, ReviewList, useAuth, api, originalAdapter, originalConsoleError
let auth, errors = []

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLTextAreaElement', 'Node', 'Event', 'MouseEvent']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: AuthProvider } = await vite.ssrLoadModule('/src/context/AuthProvider.jsx'))
  ;({ default: ReviewList } = await vite.ssrLoadModule('/src/components/ReviewList.jsx'))
  ;({ default: useAuth } = await vite.ssrLoadModule('/src/hooks/useAuth.js'))
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
function fixture({ session = USER, reviews = [], handler } = {}) {
  const state = { session, reviews: reviews.map((review) => ({ ...review })), calls: [] }
  state.adapter = async (config) => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const call = { config, path: config.url, method: config.method, body, params: config.params }
    state.calls.push(call)
    let data = await handler?.(call, state)
    if (data === undefined) {
      if (call.path === '/auth/csrf') data = { csrfToken: 'review-fixture-csrf' }
      else if (call.path === '/auth/me') {
        if (!state.session) return reject(config, 401)
        data = { data: state.session }
      } else if (call.path === '/auth/logout') { state.session = null; data = { message: 'Đã đăng xuất.' } }
      else if (call.path === '/auth/login') { state.session = USER; data = { data: USER } }
      else if (call.path === '/recipes/1/reviews/mine') data = { data: state.reviews.find((review) => review.userId === state.session?.userId) || null }
      else if (call.path === '/recipes/1/reviews' && call.method === 'get') {
        const page = call.params.page, limit = call.params.limit
        const sum = state.reviews.reduce((total, review) => total + review.rating, 0)
        data = { data: state.reviews.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: state.reviews.length, totalPages: Math.ceil(state.reviews.length / limit) }, summary: { averageRating: state.reviews.length ? sum / state.reviews.length : 0, reviewCount: state.reviews.length } }
      } else if (call.path === '/recipes/1/reviews' && call.method === 'post') {
        const review = { ...REVIEW, ...body, userId: state.session.userId, fullName: state.session.fullName }
        state.reviews.unshift(review); data = { data: review }
      } else if (/^\/reviews\/\d+$/u.test(call.path) && call.method === 'patch') {
        const index = state.reviews.findIndex((review) => review.reviewId === Number(call.path.split('/').at(-1)))
        state.reviews[index] = { ...state.reviews[index], ...body }; data = { data: state.reviews[index] }
      } else if (/^\/reviews\/\d+$/u.test(call.path) && call.method === 'delete') {
        state.reviews = state.reviews.filter((review) => review.reviewId !== Number(call.path.split('/').at(-1))); data = { message: 'Đã xóa.' }
      } else throw new Error(`Unexpected reviews fixture endpoint ${call.method} ${call.path}`)
    }
    return { config, data, status: call.method === 'post' ? 201 : 200, statusText: 'OK', headers: {} }
  }
  return state
}
function Probe() {
  const session = useAuth()
  const location = useLocation()
  React.useEffect(() => { auth = session }, [session])
  return React.createElement('output', { 'data-location': true }, `${location.pathname}${location.search}|${location.state?.from || ''}`)
}
async function mount(state) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren()
  api.defaults.adapter = state.adapter
  errors = []
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(React.StrictMode, {}, React.createElement(MemoryRouter, { initialEntries: ['/recipes/1?servings=3'] }, React.createElement(AuthProvider, {}, React.createElement(Probe), React.createElement(Routes, {}, React.createElement(Route, { path: '/login', element: React.createElement('h1', {}, 'Trang đăng nhập') }), React.createElement(Route, { path: '*', element: React.createElement(ReviewList, { recipeId: 1 }) })))))))
}
async function waitFor(check) {
  let last
  for (let count = 0; count < 120; count += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3)) })
    try { check(); return } catch (error) { last = error }
  }
  throw last
}
function text() { return document.body.textContent }
function button(label) {
  const result = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === label)
  assert.ok(result, `Button ${label}`)
  return result
}
async function click(element) { await act(async () => element.click()) }
async function stars(value) { await click(document.querySelector(`input[aria-label="${value} sao"]`)) }
async function comment(value) {
  const field = document.querySelector('textarea')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(field, value)
    field.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function submit() { await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
function writes(state) { return state.calls.filter((call) => ['post', 'patch', 'delete'].includes(call.method) && call.path.includes('reviews')) }
function noErrors() { assert.deepEqual(errors, []) }

test('guest reads public reviews and summary while XSS text stays inert, then login preserves the current recipe path', async () => {
  const content = '<img src=x onerror="window.stolen=true"><script>window.stolen=true</script>'
  const state = fixture({ session: null, reviews: [{ ...REVIEW, comment: content }] })
  await mount(state)
  await waitFor(() => assert.ok(document.querySelector('article')))
  assert.match(text(), /4\/5/)
  assert.match(text(), /1 lượt đánh giá/)
  assert.ok(document.querySelector('article').textContent.includes(content))
  assert.equal(document.querySelector('script,img'), null)
  assert.equal(window.stolen, undefined)
  assert.equal(document.querySelector('textarea'), null)
  assert.equal(state.calls.some((call) => call.path.endsWith('/mine')), false)
  assert.equal(state.calls.filter((call) => call.path === '/recipes/1/reviews').length, 1)
  await click(document.querySelector('a[href="/login"]'))
  assert.equal(document.querySelector('[data-location]').textContent, '/login|/recipes/1?servings=3')
  noErrors()
})

test('review form validates rating and comment length without API writes, then sends only rating and trimmed comment', async () => {
  const state = fixture()
  await mount(state)
  await waitFor(() => assert.ok(document.querySelector('form')))
  assert.equal(document.querySelectorAll('input[type="radio"]').length, 5)
  await submit()
  assert.match(text(), /chọn từ 1 đến 5 sao/)
  assert.equal(writes(state).length, 0)
  await stars(5)
  assert.equal(document.querySelector('input[aria-label="5 sao"]').checked, true)
  await comment('a'.repeat(2001))
  await submit()
  assert.match(text(), /không được vượt quá 2.000 ký tự/)
  assert.equal(writes(state).length, 0)
  await comment('  Cảm nhận của tôi.  ')
  await submit()
  await waitFor(() => assert.match(text(), /Đã gửi đánh giá của bạn/))
  assert.deepEqual(writes(state)[0].body, { rating: 5, comment: 'Cảm nhận của tôi.' })
  assert.equal(writes(state)[0].config.headers.get('X-CSRF-Token'), 'review-fixture-csrf')
  assert.match(text(), /5\/5/)
  assert.match(text(), /1 lượt đánh giá/)
  assert.ok(button('Chỉnh sửa đánh giá'))
  noErrors()
})

test('optional blank comment is null; pending submit disables fields and prevents duplicate reviews', async () => {
  const pending = deferred()
  const state = fixture({ handler: (call) => call.path === '/recipes/1/reviews' && call.method === 'post' ? pending.promise : undefined })
  await mount(state)
  await waitFor(() => assert.ok(document.querySelector('form')))
  await stars(3)
  await comment('   ')
  await submit()
  await waitFor(() => assert.equal(writes(state).length, 1))
  assert.equal(button('Đang lưu…').disabled, true)
  assert.equal(document.querySelector('textarea').disabled, true)
  await submit()
  assert.equal(writes(state).length, 1)
  assert.deepEqual(writes(state)[0].body, { rating: 3, comment: null })
  await act(async () => pending.resolve({ data: { ...REVIEW, rating: 3, comment: null } }))
  assert.match(text(), /Đã gửi đánh giá của bạn/)
  noErrors()
})

test('failed create keeps the draft and shows the server error without a success notification', async () => {
  const state = fixture({ handler(call) { if (call.path === '/recipes/1/reviews' && call.method === 'post') return reject(call.config, 409, 'Bạn đã đánh giá món ăn này.') } })
  await mount(state)
  await waitFor(() => assert.ok(document.querySelector('form')))
  await stars(2)
  await comment('Bản nháp vẫn còn.')
  await submit()
  assert.match(text(), /Bạn đã đánh giá món ăn này/)
  assert.doesNotMatch(text(), /Đã gửi đánh giá của bạn/)
  assert.equal(document.querySelector('textarea').value, 'Bản nháp vẫn còn.')
  assert.equal(document.querySelector('input[aria-label="2 sao"]').checked, true)
  noErrors()
})

test('only the current account mine endpoint produces edit controls; editing preserves draft after failure and retries', async () => {
  let fail = true
  const state = fixture({ reviews: [REVIEW, { ...REVIEW, reviewId: 902, userId: 99, fullName: 'Người dùng khác' }], handler(call) { if (call.method === 'patch' && fail) return reject(call.config, 503, 'Chưa thể cập nhật đánh giá.') } })
  await mount(state)
  await waitFor(() => assert.ok([...document.querySelectorAll('button')].some((item) => item.textContent === 'Chỉnh sửa đánh giá')))
  assert.equal([...document.querySelectorAll('button')].filter((item) => item.textContent === 'Chỉnh sửa đánh giá').length, 1)
  await click(button('Chỉnh sửa đánh giá'))
  await stars(1)
  await comment('Đánh giá đã sửa.')
  await submit()
  assert.match(text(), /Chưa thể cập nhật đánh giá/)
  assert.equal(document.querySelector('textarea').value, 'Đánh giá đã sửa.')
  assert.equal(state.reviews[0].rating, 4)
  fail = false
  await submit()
  await waitFor(() => assert.match(text(), /Đã cập nhật đánh giá/))
  assert.equal(state.reviews[0].rating, 1)
  assert.deepEqual(writes(state).at(-1).body, { rating: 1, comment: 'Đánh giá đã sửa.' })
  assert.equal(writes(state).at(-1).path, '/reviews/901')
  noErrors()
})

test('delete requires confirmation, preserves review on failure and reaches a fresh form after real success', async () => {
  let fail = true
  const state = fixture({ reviews: [REVIEW], handler(call) { if (call.method === 'delete' && fail) return reject(call.config, 503, 'Chưa thể xóa đánh giá.') } })
  await mount(state)
  await waitFor(() => assert.ok([...document.querySelectorAll('button')].some((item) => item.textContent === 'Xóa đánh giá')))
  await click(button('Xóa đánh giá'))
  assert.equal(writes(state).length, 0)
  await click(button('Giữ đánh giá'))
  assert.equal(writes(state).length, 0)
  await click(button('Xóa đánh giá'))
  await click(button('Xác nhận xóa'))
  assert.match(text(), /Chưa thể xóa đánh giá/)
  assert.equal(state.reviews.length, 1)
  assert.doesNotMatch(text(), /Đã xóa đánh giá của bạn/)
  fail = false
  await click(button('Xác nhận xóa'))
  await waitFor(() => assert.match(text(), /Đã xóa đánh giá của bạn/))
  assert.ok(document.querySelector('form'))
  assert.equal(state.reviews.length, 0)
  assert.deepEqual(writes(state).at(-1).body, {})
  assert.equal(writes(state).at(-1).config.headers.get('X-CSRF-Token'), 'review-fixture-csrf')
  noErrors()
})

test('public loading and API error offer retry; pagination fetches the requested page', async () => {
  const pending = deferred()
  let first = true
  const state = fixture({ session: null, reviews: Array.from({ length: 7 }, (_, index) => ({ ...REVIEW, reviewId: index + 1, fullName: `Người đánh giá ${index + 1}` })), handler(call) {
    if (call.path === '/recipes/1/reviews' && first) { first = false; return pending.promise.then(() => reject(call.config, 503, 'Tạm gián đoạn đánh giá.')) }
  } })
  await mount(state)
  await waitFor(() => assert.equal(first, false))
  assert.match(text(), /Đang tải đánh giá/)
  await act(async () => pending.resolve())
  assert.match(text(), /Tạm gián đoạn đánh giá/)
  await click(button('Thử lại'))
  await waitFor(() => assert.equal(document.querySelectorAll('article').length, 6))
  await click(document.querySelector('button[aria-label="Trang sau"]'))
  await waitFor(() => assert.equal(document.querySelectorAll('article').length, 1))
  assert.match(document.querySelector('article').textContent, /Người đánh giá 7/)
  noErrors()
})

test('failed mine lookup blocks a blind duplicate form until retry confirms the existing owned review', async () => {
  let fail = true
  const state = fixture({ reviews: [REVIEW], handler(call) { if (call.path.endsWith('/mine') && fail) return reject(call.config, 503) } })
  await mount(state)
  await waitFor(() => assert.match(text(), /Chưa thể tải đánh giá của bạn/))
  assert.equal(document.querySelector('form'), null)
  assert.equal(writes(state).length, 0)
  fail = false
  await click(button('Thử lại'))
  await waitFor(() => assert.ok([...document.querySelectorAll('button')].some((item) => item.textContent === 'Chỉnh sửa đánh giá')))
  assert.equal(document.querySelector('form'), null)
  noErrors()
})

test('expired owned-review lookup clears auth while public reviews stay readable', async () => {
  const state = fixture({ handler(call) { if (call.path.endsWith('/reviews/mine')) return reject(call.config, 401, 'Phiên đã kết thúc.') } })
  await mount(state)
  await waitFor(() => assert.equal(auth.isAuthenticated, false))
  assert.ok(document.querySelector('a[href="/login"]'))
  assert.equal(document.querySelector('textarea'), null)
  noErrors()
})

test('expired review mutation clears auth and replaces private draft with login CTA', async () => {
  const state = fixture({ handler(call) { if (call.method === 'post' && call.path.includes('/reviews')) return reject(call.config, 401, 'Phiên đã kết thúc.') } })
  await mount(state)
  await waitFor(() => assert.ok(document.querySelector('form')))
  await stars(4)
  await comment('Bản nháp riêng của phiên cũ.')
  await submit()
  await waitFor(() => assert.equal(auth.isAuthenticated, false))
  assert.ok(document.querySelector('a[href="/login"]'))
  assert.equal(document.querySelector('textarea'), null)
  assert.doesNotMatch(text(), /Bản nháp riêng của phiên cũ|Đã gửi đánh giá/)
  noErrors()
})

test('account switch aborts pending CSRF and removes the old review draft without writing to the new session', async () => {
  const pending = deferred()
  let hold = true
  const state = fixture({ handler(call) { if (call.path === '/auth/csrf' && hold) return pending.promise } })
  await mount(state)
  await waitFor(() => assert.ok(document.querySelector('form')))
  await stars(5)
  await comment('Bản nháp trước khi đổi phiên.')
  await submit()
  await waitFor(() => assert.equal(state.calls.filter((call) => call.path === '/auth/csrf').length, 1))
  const oldCsrf = state.calls.find((call) => call.path === '/auth/csrf')
  hold = false
  await act(async () => { await auth.login({ email: USER.email, password: 'new fixture session' }) })
  await waitFor(() => assert.ok(document.querySelector('textarea')))
  assert.equal(oldCsrf.config.signal.aborted, true)
  assert.equal(document.querySelector('textarea').value, '')
  await act(async () => pending.resolve({ csrfToken: 'old-csrf' }))
  assert.equal(writes(state).length, 0)
  assert.doesNotMatch(text(), /Đã gửi đánh giá/)
  noErrors()
})
