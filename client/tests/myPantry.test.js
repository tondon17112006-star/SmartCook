import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { eligiblePantryIds, expiryStatus, summarizePantry, todayInVietnam, validatePantryInput, validDate } from '../src/utilities/myPantry.js'

const USER = { userId: 53, fullName: 'Người dùng thử tủ nguyên liệu', email: 'pantry.fixture@example.test', role: 'User' }
const ITEM = { userIngredientId: 701, ingredientId: 1, ingredientName: 'Trứng gà', ingredientCategory: 'Trứng', defaultUnit: 'quả', imageUrl: null, quantity: 2, unit: 'quả', expiryDate: null }
const CATALOG = [ITEM, { ingredientId: 2, ingredientName: 'Cà chua', ingredientCategory: 'Rau củ', defaultUnit: 'quả', imageUrl: null }]
const globals = new Map()
let dom, vite, root, createRoot, AuthProvider, MyPantry, ProtectedRoute, useAuth, PantryContext, api, getPantry, originalAdapter, originalConsoleError
let auth, errors = []

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: AuthProvider } = await vite.ssrLoadModule('/src/context/AuthProvider.jsx'))
  ;({ default: MyPantry } = await vite.ssrLoadModule('/src/pages/MyPantry.jsx'))
  ;({ default: ProtectedRoute } = await vite.ssrLoadModule('/src/components/ProtectedRoute.jsx'))
  ;({ default: useAuth } = await vite.ssrLoadModule('/src/hooks/useAuth.js'))
  ;({ PantryContext } = await vite.ssrLoadModule('/src/context/PantryContext.js'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  ;({ getPantry } = await vite.ssrLoadModule('/src/services/pantryService.js'))
  originalAdapter = api.defaults.adapter
  originalConsoleError = console.error
  console.error = (...values) => errors.push(values.map(String).join(' '))
})
after(async () => {
  if (root) await act(async () => root.unmount())
  if (api) api.defaults.adapter = originalAdapter
  if (originalConsoleError) console.error = originalConsoleError
  await vite?.close(); dom?.window.close()
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

function reject(config, status, message = 'Yêu cầu chưa thực hiện được.') {
  const error = new Error(message)
  error.config = config; error.response = { config, status, data: { message } }; throw error
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }
function pageBody(items, page = 1, limit = 100) {
  const totalPages = Math.ceil(items.length / limit)
  return { data: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: items.length, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } }
}
function fixture({ session = USER, items = [], handler, catalog = CATALOG, catalogError = null, catalogLoading = false, selectionAllowed = true } = {}) {
  const state = { session, items: items.map((item) => ({ ...item })), calls: [], selected: null, servings: 4, retries: 0 }
  state.recordServings = (value) => { state.servings = value }
  state.pantry = { catalog, loading: catalogLoading, error: catalogError, retry: () => { state.retries += 1 }, servings: 4, replaceSelection(ids) { if (selectionAllowed) state.selected = ids; return selectionAllowed } }
  state.adapter = async (config) => {
    const call = { config, path: config.url, method: config.method, params: config.params, body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data }
    state.calls.push(call)
    let data = await handler?.(call, state)
    if (data === undefined) {
      if (call.path === '/auth/csrf') data = { csrfToken: 'pantry-fixture-csrf' }
      else if (call.path === '/auth/me') { if (!state.session) return reject(config, 401); data = { data: state.session } }
      else if (call.path === '/auth/login') { state.session = USER; data = { data: USER } }
      else if (call.path === '/auth/logout') { state.session = null; data = { message: 'Đã đăng xuất.' } }
      else if (call.path === '/pantry' && call.method === 'get') data = pageBody(state.items, call.params.page, call.params.limit)
      else if (call.path === '/pantry' && call.method === 'post') {
        const ingredient = catalog.find((item) => item.ingredientId === call.body.ingredientId)
        const item = { ...ingredient, ...call.body, userIngredientId: 900 + state.items.length }
        state.items.push(item); data = { data: item }
      } else if (/^\/pantry\/\d+$/u.test(call.path) && call.method === 'patch') {
        const index = state.items.findIndex((item) => item.userIngredientId === Number(call.path.split('/').at(-1)))
        state.items[index] = { ...state.items[index], ...call.body }; data = { data: state.items[index] }
      } else if (/^\/pantry\/\d+$/u.test(call.path) && call.method === 'delete') {
        state.items = state.items.filter((item) => item.userIngredientId !== Number(call.path.split('/').at(-1))); data = { message: 'Đã xóa.' }
      } else throw new Error(`Unexpected pantry endpoint ${call.method} ${call.path}`)
    }
    return { config, data, status: call.method === 'post' ? 201 : 200, statusText: 'OK', headers: {} }
  }
  return state
}
function Probe() {
  const session = useAuth(), location = useLocation()
  React.useEffect(() => { auth = session }, [session])
  return React.createElement('output', { 'data-location': true }, `${location.pathname}|${location.state?.from || ''}`)
}
function PantryHarness({ state, children }) {
  const [servings, setServings] = React.useState(4)
  return React.createElement(PantryContext.Provider, { value: { ...state.pantry, servings, setServings: (value) => { state.recordServings(value); setServings(value) } } }, children)
}
async function mount(state) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren(); api.defaults.adapter = state.adapter; errors = []
  root = createRoot(document.getElementById('root'))
  const routes = React.createElement(Routes, {}, React.createElement(Route, { path: '/login', element: React.createElement('h1', {}, 'Trang đăng nhập') }), React.createElement(Route, { path: '/suggestions', element: React.createElement('h1', {}, 'Gợi ý từ lựa chọn') }), React.createElement(Route, { path: '/pantry', element: React.createElement(ProtectedRoute, {}, React.createElement(MyPantry)) }))
  await act(async () => root.render(React.createElement(React.StrictMode, {}, React.createElement(MemoryRouter, { initialEntries: ['/pantry'] }, React.createElement(AuthProvider, {}, React.createElement(PantryHarness, { state }, React.createElement(Probe), routes))))))
}
async function waitFor(check) {
  let last
  for (let index = 0; index < 120; index += 1) { await act(async () => { await new Promise((done) => setTimeout(done, 3)) }); try { check(); return } catch (error) { last = error } }
  throw last
}
function text() { return document.body.textContent }
function button(label) { const element = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label); assert.ok(element, `Button ${label}`); return element }
async function click(element) { await act(async () => element.click()) }
async function input(name, value) {
  const element = document.querySelector(`[name="${name}"]`); assert.ok(element, `Field ${name}`)
  await act(async () => {
    Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
async function submit() { await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
function writes(state) { return state.calls.filter((call) => call.path.startsWith('/pantry') && call.method !== 'get') }
function noErrors() { assert.deepEqual(errors, []) }

test('Vietnam dates include midnight boundary and Gregorian leap rules', () => {
  assert.equal(todayInVietnam(new Date('2026-10-21T16:59:59.999Z')), '2026-10-21')
  assert.equal(todayInVietnam(new Date('2026-10-21T17:00:00.000Z')), '2026-10-22')
  for (const value of ['2000-02-29', '2024-02-29', '0001-01-01', '9999-12-31']) assert.equal(validDate(value), true)
  for (const value of ['1900-02-29', '2026-02-29', '2026-04-31', '0000-01-01', '2026-1-01', '2026-13-01', '2026-01-00']) assert.equal(validDate(value), false)
})
test('expiry classification includes today and next three calendar days and excludes expired', () => {
  const today = '2026-12-30'
  assert.equal(expiryStatus(null, today), 'unknown')
  assert.equal(expiryStatus('2026-12-29', today), 'expired')
  for (const date of ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']) assert.equal(expiryStatus(date, today), 'soon')
  assert.equal(expiryStatus('2027-01-03', today), 'fresh')
  assert.equal(expiryStatus('invalid', today), 'invalid')
  const items = [null, '2026-12-29', '2027-01-02', '2027-01-03'].map((expiryDate, index) => ({ ingredientId: index + 1, expiryDate }))
  assert.deepEqual(summarizePantry(items, today), { total: 4, expired: 1, soon: 1, unknown: 1 })
  assert.deepEqual(eligiblePantryIds(items, today), [1, 3, 4])
})
test('quantity decimals have no silent rounding; null fields and unit-only records are supported', () => {
  const valid = (quantity, unit = ' kg ') => validatePantryInput({ ingredientId: 1, quantity, unit, expiryDate: '' })
  for (const quantity of ['1', '0.01', '1.25', '9999999999.99']) assert.deepEqual(valid(quantity).errors, {})
  for (const quantity of ['0', '-1', '0.001', '1e2', '1,5', 'Infinity', '10000000000']) assert.ok(valid(quantity).errors.quantity)
  assert.ok(valid('1', '').errors.unit)
  assert.ok(valid('1', '<kg>').errors.unit)
  assert.deepEqual(valid('', '').data, { ingredientId: 1, quantity: null, unit: null, expiryDate: null })
  assert.deepEqual(valid('', 'quả').data, { ingredientId: 1, quantity: null, unit: 'quả', expiryDate: null })
  assert.deepEqual(validatePantryInput({ ingredientId: 1, quantity: '', unit: '', expiryDate: '' }, { editing: true }).data, { quantity: null, unit: null, expiryDate: null })
})
test('cooking refuses zero or over100 types without choosing an arbitrary subset', () => {
  assert.throws(() => eligiblePantryIds([]), /chưa có nguyên liệu/)
  assert.throws(() => eligiblePantryIds(Array.from({ length: 101 }, (_, index) => ({ ingredientId: index + 1, expiryDate: null }))), /tối đa 100/)
  assert.equal(eligiblePantryIds(Array.from({ length: 100 }, (_, index) => ({ ingredientId: index + 1, expiryDate: null }))).length, 100)
})
test('guest pantry is protected and never loads private pantry', async () => {
  const state = fixture({ session: null }); await mount(state)
  await waitFor(() => assert.match(text(), /Trang đăng nhập/))
  assert.equal(document.querySelector('[data-location]').textContent, '/login|/pantry')
  assert.equal(state.calls.some((call) => call.path === '/pantry'), false); noErrors()
})
test('empty pantry reuses existing catalog, searchable select and add validation', async () => {
  const state = fixture(); await mount(state)
  await waitFor(() => assert.match(text(), /Tủ nguyên liệu đang trống/))
  assert.equal(state.calls.filter((call) => call.path === '/pantry').length, 1)
  assert.equal(state.calls.some((call) => call.path === '/ingredients'), false)
  await submit(); assert.match(text(), /chọn nguyên liệu/); assert.equal(writes(state).length, 0)
  await input('ingredientSearch', 'cà'.normalize('NFD')); assert.equal(document.querySelectorAll('select option').length, 2)
  await input('ingredientId', '2'); await input('quantity', '1.234'); await submit()
  assert.match(text(), /2 chữ số thập phân/); assert.equal(writes(state).length, 0)
  await input('quantity', '1.25'); await input('unit', ' kg '); await input('expiryDate', '2026-10-20'); await submit()
  await waitFor(() => assert.match(text(), /Đã thêm nguyên liệu vào tủ/))
  assert.deepEqual(writes(state)[0].body, { ingredientId: 2, quantity: 1.25, unit: 'kg', expiryDate: '2026-10-20' })
  assert.equal(writes(state)[0].config.headers.get('X-CSRF-Token'), 'pantry-fixture-csrf')
  assert.equal(document.querySelectorAll('article').length, 1)
  assert.equal(document.querySelector('[name="quantity"]').value, ''); noErrors()
})
test('pending creation disables form and prevents duplicate requests then reports only real result', async () => {
  const pending = deferred()
  const state = fixture({ handler: (call) => call.path === '/pantry' && call.method === 'post' ? pending.promise : undefined })
  await mount(state); await waitFor(() => assert.ok(document.querySelector('form')))
  await input('ingredientId', '1'); await submit()
  await waitFor(() => assert.equal(writes(state).length, 1))
  assert.equal(button('Đang lưu…').disabled, true)
  assert.equal(document.querySelector('[name="ingredientId"]').disabled, true)
  await submit(); assert.equal(writes(state).length, 1)
  assert.doesNotMatch(text(), /Đã thêm nguyên liệu vào tủ/)
  await act(async () => pending.resolve({ data: { ...ITEM, quantity: null } }))
  assert.match(text(), /Đã thêm nguyên liệu vào tủ/); noErrors()
})
test('failed creation preserves draft and shows409 without false success', async () => {
  const state = fixture({ handler(call) { if (call.method === 'post' && call.path === '/pantry') return reject(call.config, 409, 'Nguyên liệu đã có trong tủ.') } })
  await mount(state); await waitFor(() => assert.ok(document.querySelector('form')))
  await input('ingredientId', '1'); await input('quantity', '3.5'); await submit()
  assert.match(text(), /Nguyên liệu đã có trong tủ/)
  assert.equal(document.querySelector('[name="quantity"]').value, '3.5')
  assert.equal(state.items.length, 0); assert.doesNotMatch(text(), /Đã thêm nguyên liệu/); noErrors()
})
test('editing locks ingredient identity, keeps draft on failure, supports clearing nullable fields', async () => {
  let fail = true
  const state = fixture({ items: [ITEM], handler(call) { if (call.method === 'patch' && fail) return reject(call.config, 503, 'Chưa thể sửa nguyên liệu.') } })
  await mount(state); await waitFor(() => assert.equal(document.querySelectorAll('article').length, 1))
  await click(document.querySelector('button[aria-label="Sửa Trứng gà"]'))
  assert.equal(document.querySelector('[name="ingredientId"]'), null)
  await input('quantity', ''); await input('unit', ''); await input('expiryDate', ''); await submit()
  assert.match(text(), /Chưa thể sửa nguyên liệu/)
  assert.equal(state.items[0].quantity, 2); assert.equal(document.querySelector('[name="quantity"]').value, '')
  fail = false; await submit()
  await waitFor(() => assert.match(text(), /Đã cập nhật nguyên liệu/))
  assert.deepEqual(writes(state).at(-1).body, { quantity: null, unit: null, expiryDate: null })
  assert.equal(writes(state).at(-1).path, '/pantry/701')
  assert.equal(state.items[0].ingredientId, 1); assert.match(document.querySelector('article').textContent, /Chưa ghi số lượng/); noErrors()
})
test('delete confirmation can cancel and failed delete keeps item until actual success', async () => {
  let fail = true
  const state = fixture({ items: [ITEM], handler(call) { if (call.method === 'delete' && fail) return reject(call.config, 503, 'Chưa thể xóa nguyên liệu.') } })
  await mount(state); await waitFor(() => assert.ok(document.querySelector('article')))
  await click(document.querySelector('button[aria-label="Xóa Trứng gà"]')); assert.equal(writes(state).length, 0)
  await click(button('Giữ nguyên liệu')); assert.equal(writes(state).length, 0)
  await click(document.querySelector('button[aria-label="Xóa Trứng gà"]')); await click(button('Xác nhận xóa'))
  assert.match(text(), /Chưa thể xóa nguyên liệu/); assert.equal(state.items.length, 1)
  assert.doesNotMatch(text(), /Đã xóa nguyên liệu khỏi tủ/)
  fail = false; await click(button('Xác nhận xóa'))
  await waitFor(() => assert.match(text(), /Tủ nguyên liệu đang trống/))
  assert.match(text(), /Đã xóa nguyên liệu khỏi tủ/); assert.deepEqual(writes(state).at(-1).body, {}); noErrors()
})
test('loading/error/retry does not expose a partial pantry or leave cooking enabled', async () => {
  const pending = deferred(); let first = true
  const state = fixture({ items: [ITEM], handler(call) { if (call.path === '/pantry' && call.method === 'get' && first) { first = false; return pending.promise.then(() => reject(call.config, 503, 'Tủ tạm gián đoạn.')) } } })
  await mount(state); await waitFor(() => assert.equal(first, false))
  assert.match(text(), /Đang tải tủ nguyên liệu/); assert.equal(document.querySelector('article'), null)
  await act(async () => pending.resolve()); assert.match(text(), /Tủ tạm gián đoạn/)
  assert.equal(document.querySelector('form'), null)
  await click(button('Thử lại')); await waitFor(() => assert.ok(document.querySelector('article'))); noErrors()
})
test('catalog error offers retry and prevents cooking or adding without a validated catalog', async () => {
  const state = fixture({ items: [ITEM], catalogError: new Error('offline') }); await mount(state)
  await waitFor(() => assert.match(text(), /Chưa thể tải danh mục/))
  assert.equal(button('Nấu ăn từ tủ nguyên liệu').disabled, true); assert.equal(document.querySelector('form'), null)
  await click(button('Thử lại')); assert.equal(state.retries, 1); noErrors()
})
test('cooking sends every usable type, excludes expired and preserves chosen servings', async () => {
  const today = todayInVietnam()
  const state = fixture({ items: [ITEM, { ...ITEM, userIngredientId: 702, ingredientId: 2, ingredientName: 'Cà chua', expiryDate: today }, { ...ITEM, userIngredientId: 703, ingredientId: 3, ingredientName: 'Nguyên liệu cũ', expiryDate: '2000-01-01' }] })
  await mount(state); await waitFor(() => assert.equal(document.querySelectorAll('article').length, 3))
  assert.match(text(), /Đã hết hạn/); assert.match(text(), /Sắp hết hạn/)
  assert.match(text(), /chưa tính đủ số lượng/); assert.match(text(), /cần tự kiểm tra chất lượng/)
  await click(button('Nấu ăn từ tủ nguyên liệu'))
  assert.equal(document.querySelector('[data-location]').textContent, '/suggestions|')
  assert.deepEqual(state.selected, [1, 2]); assert.equal(state.servings, 4); noErrors()
})
test('cooking refuses catalog mismatch and over100 eligible types without partial navigation', async () => {
  const state = fixture({ items: [ITEM], selectionAllowed: false }); await mount(state)
  await waitFor(() => assert.ok(document.querySelector('article'))); await click(button('Nấu ăn từ tủ nguyên liệu'))
  assert.match(text(), /Danh mục nguyên liệu đã thay đổi/); assert.equal(state.selected, null)
  assert.equal(document.querySelector('[data-location]').textContent, '/pantry|')
  const large = fixture({ items: Array.from({ length: 101 }, (_, index) => ({ ...ITEM, userIngredientId: index + 1, ingredientId: index + 1 })) })
  await mount(large); await waitFor(() => assert.equal(document.querySelectorAll('article').length, 101))
  await click(button('Nấu ăn từ tủ nguyên liệu')); assert.match(text(), /tối đa 100/); assert.equal(large.selected, null)
  assert.equal(large.calls.filter((call) => call.path === '/pantry' && call.method === 'get').length, 2); noErrors()
})
test('pantry servings selector updates shared choice and cooking keeps that selection', async () => {
  const state = fixture({ items: [ITEM] }); await mount(state)
  await waitFor(() => assert.ok(document.querySelector('article')))
  assert.equal(document.querySelector('output[aria-label="Số người ăn"]').textContent, '4 người')
  await click(document.querySelector('button[aria-label="Tăng số người ăn"]'))
  assert.equal(state.servings, 5)
  assert.equal(document.querySelector('output[aria-label="Số người ăn"]').textContent, '5 người')
  await click(button('Nấu ăn từ tủ nguyên liệu'))
  assert.deepEqual(state.selected, [1]); assert.equal(state.servings, 5)
  assert.equal(document.querySelector('[data-location]').textContent, '/suggestions|'); noErrors()
})
test('cooking rechecks Vietnam midnight even before visible expiry badges refresh', async () => {
  const OriginalDate = globalThis.Date
  let now = '2026-10-22T16:59:59.999Z'
  globalThis.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return new OriginalDate(now).getTime() }
  }
  try {
    const state = fixture({ items: [{ ...ITEM, expiryDate: '2026-10-22' }] }); await mount(state)
    await waitFor(() => assert.ok(document.querySelector('article')))
    assert.match(document.querySelector('article').textContent, /Sắp hết hạn/)
    now = '2026-10-22T17:00:00.000Z'
    await click(button('Nấu ăn từ tủ nguyên liệu'))
    assert.match(text(), /Tủ chưa có nguyên liệu còn hạn/)
    assert.equal(state.selected, null); assert.equal(document.querySelector('[data-location]').textContent, '/pantry|'); noErrors()
  } finally { globalThis.Date = OriginalDate }
})
test('a failing second page never renders the accepted first page or offers partial cooking', async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({ ...ITEM, userIngredientId: index + 1, ingredientId: index + 1 }))
  const state = fixture({ items: rows, handler(call) { if (call.path === '/pantry' && call.params.page === 2) return reject(call.config, 503, 'Trang tiếp theo chưa tải được.') } })
  await mount(state); await waitFor(() => assert.match(text(), /Trang tiếp theo chưa tải được/))
  assert.equal(document.querySelector('article'), null)
  assert.equal(document.querySelector('form'), null)
  assert.equal([...document.querySelectorAll('button')].some((element) => element.textContent.includes('Nấu ăn từ tủ')), false)
  assert.equal(state.calls.filter((call) => call.path === '/pantry').length, 2); noErrors()
})
test('full pantry loader rejects missing rows, duplicate IDs, changed totals, invalid dates and over10000', async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({ ...ITEM, userIngredientId: index + 1, ingredientId: index + 1 }))
  const malformed = [
    (body) => ({ ...body, data: body.data.slice(1) }),
    (body) => ({ ...body, data: body.data.map((item) => ({ ...item, expiryDate: '2026-02-29' })) }),
    (body) => ({ ...body, pagination: { ...body.pagination, total: 10001 } }),
  ]
  for (const transform of malformed) {
    const state = fixture({ items: [ITEM], handler: (call) => call.path === '/pantry' ? transform(pageBody([ITEM])) : undefined })
    api.defaults.adapter = state.adapter; await assert.rejects(() => getPantry(), /dữ liệu chưa đầy đủ/)
  }
  const duplicate = fixture({ items: rows, handler: (call) => call.path === '/pantry' && call.params.page === 2 ? pageBody([{ ...ITEM, userIngredientId: 1, ingredientId: 101 }], 1) : undefined })
  // Keep pagination consistent while repeating a previous page identity.
  duplicate.adapter = async (config) => ({ config, data: config.params.page === 1 ? pageBody(rows, 1) : { ...pageBody(rows, 2), data: [{ ...rows[100], userIngredientId: 1 }] }, status: 200, headers: {} })
  api.defaults.adapter = duplicate.adapter; await assert.rejects(() => getPantry(), /dữ liệu chưa đầy đủ/)
  const changed = fixture({ handler(call) { if (call.path === '/pantry') return call.params.page === 1 ? pageBody(rows, 1) : pageBody(rows.slice(0, 100), 2) } })
  api.defaults.adapter = changed.adapter; await assert.rejects(() => getPantry(), /dữ liệu chưa đầy đủ/)
})
test('401 on private mutation clears auth, removes private data and redirects to login', async () => {
  const state = fixture({ items: [ITEM], handler(call) { if (call.method === 'patch') return reject(call.config, 401, 'Phiên đã kết thúc.') } })
  await mount(state); await waitFor(() => assert.ok(document.querySelector('article')))
  await click(document.querySelector('button[aria-label="Sửa Trứng gà"]')); await input('quantity', '3'); await submit()
  await waitFor(() => assert.equal(auth.isAuthenticated, false))
  assert.match(text(), /Trang đăng nhập/); assert.equal(document.querySelector('article'), null)
  assert.doesNotMatch(text(), /Đã cập nhật nguyên liệu/); noErrors()
})
test('new session aborts pending CSRF and clears old draft before it can mutate another session', async () => {
  const pending = deferred(); let hold = true
  const state = fixture({ handler: (call) => call.path === '/auth/csrf' && hold ? pending.promise : undefined })
  await mount(state); await waitFor(() => assert.ok(document.querySelector('form')))
  await input('ingredientId', '1'); await input('quantity', '5'); await submit()
  await waitFor(() => assert.equal(state.calls.filter((call) => call.path === '/auth/csrf').length, 1))
  const stale = state.calls.find((call) => call.path === '/auth/csrf')
  hold = false; await act(async () => { await auth.login({ email: USER.email, password: 'fixture renewed session' }) })
  await waitFor(() => assert.ok(document.querySelector('form')))
  assert.equal(stale.config.signal.aborted, true); assert.equal(document.querySelector('[name="quantity"]').value, '')
  await act(async () => pending.resolve({ csrfToken: 'stale-token' }))
  assert.equal(writes(state).length, 0); assert.doesNotMatch(text(), /Đã thêm nguyên liệu/); noErrors()
})
test('new account aborts stale list request and never displays previous account rows', async () => {
  const pending = deferred(); let oldList = true
  const OTHER = { ...USER, userId: 54, fullName: 'Tài khoản thứ hai' }
  const state = fixture({ handler(call, current) {
    if (call.path === '/pantry' && oldList) { oldList = false; return pending.promise }
    if (call.path === '/auth/login') { current.session = OTHER; return { data: OTHER } }
  } })
  await mount(state); await waitFor(() => assert.equal(oldList, false))
  const old = state.calls.find((call) => call.path === '/pantry')
  await act(async () => { await auth.login({ email: OTHER.email, password: 'fixture other account' }) })
  await waitFor(() => assert.match(text(), /Tủ nguyên liệu đang trống/))
  assert.equal(old.config.signal.aborted, true)
  await act(async () => pending.resolve(pageBody([ITEM])))
  assert.equal(document.querySelector('article'), null); assert.doesNotMatch(text(), /Trứng gà.*Chưa ghi/); noErrors()
})
