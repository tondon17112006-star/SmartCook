import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Controlled HTTP adapters exercise the real forms, request services, CSRF
// flow and dialogs. Actual SQL transactions are covered by backend integration.
const descriptors = new Map()
const administrator = { userId: 91, fullName: 'Quản trị kiểm thử', role: 'Admin' }
const category = { categoryId: 8, categoryName: 'Món gia đình' }
const options = [
  { ingredientId: 4, ingredientName: 'Trứng', defaultUnit: 'quả' },
  { ingredientId: 6, ingredientName: 'Cà chua', defaultUnit: 'g' },
]
const recipe = { recipeId: 37, recipeName: 'Trứng cà chua', categoryId: 8, categoryName: category.categoryName, description: null, imageUrl: null, prepTime: 5, cookTime: 10, totalTime: 15, servings: 2, difficulty: 'Dễ', createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z', ingredients: [{ ingredientId: 4, quantity: 2, unit: 'quả', isRequired: true, notes: null }], steps: [{ stepId: 71, stepNumber: 1, instruction: 'Đập trứng và khuấy đều.', imageUrl: null }] }
let dom, vite, api, AuthContext, AdminRecipes, AdminRecipeForm, createRoot, root, originalAdapter, originalConsoleError
let errors = []

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/admin/recipes', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'FormData', 'Node', 'Event', 'MouseEvent', 'PopStateEvent']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  descriptors.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true, writable: true })
  dom.window.scrollTo = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  ;({ AuthContext } = await vite.ssrLoadModule('/src/context/AuthContext.js'))
  ;({ default: AdminRecipes } = await vite.ssrLoadModule('/src/pages/admin/AdminRecipes.jsx'))
  ;({ default: AdminRecipeForm } = await vite.ssrLoadModule('/src/pages/admin/AdminRecipeForm.jsx'))
  originalAdapter = api.defaults.adapter
  originalConsoleError = console.error
  console.error = (...values) => errors.push(values.map(String).join(' '))
})
after(async () => {
  if (root) await act(async () => root.unmount())
  if (api) api.defaults.adapter = originalAdapter
  if (originalConsoleError) console.error = originalConsoleError
  await vite?.close(); dom?.window.close()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

function pagination(data, page = 1, total = data.length, limit = 12) {
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
}
function reject(config, status, message) {
  const error = new Error(message); error.config = config; error.response = { status, data: { message }, config }; throw error
}
function fixture(handler) {
  const state = { calls: [], recipes: [structuredClone(recipe)] }
  state.adapter = async (config) => {
    const call = { config, path: config.url, method: config.method, query: config.params ?? {}, body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data }
    state.calls.push(call)
    let data = await handler?.(call, state)
    if (data === undefined) {
      if (call.path === '/auth/csrf') data = { csrfToken: 'admin-recipe-fixture-csrf' }
      else if (call.path === '/admin/categories') data = pagination([category])
      else if (call.path === '/admin/ingredients') data = pagination(options)
      else if (call.path === '/admin/recipes' && call.method === 'get') data = pagination(state.recipes)
      else if (call.path === '/admin/recipes' && call.method === 'post') { const saved = { ...call.body, recipeId: 38 }; state.recipes.push(saved); data = { data: saved } }
      else if (call.path === '/admin/recipes/37' && call.method === 'get') data = { data: recipe }
      else if (call.path === '/admin/recipes/37' && call.method === 'patch') data = { data: { ...recipe, ...call.body } }
      else if (call.path === '/admin/recipes/37' && call.method === 'delete') { state.recipes = []; data = { message: 'Đã xóa.' } }
      else throw new Error(`Unexpected admin recipe endpoint ${call.method} ${call.path}`)
    }
    return { data, status: call.method === 'post' ? 201 : 200, statusText: 'OK', headers: {}, config }
  }
  return state
}
async function mount(path, state) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren()
  window.history.replaceState(null, '', path)
  api.defaults.adapter = state.adapter
  errors = []
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(React.StrictMode, {}, React.createElement(AuthContext.Provider, { value: { currentUser: administrator, sessionGeneration: 1 } }, React.createElement(BrowserRouter, {}, React.createElement(Routes, {},
    React.createElement(Route, { path: '/admin/recipes', element: React.createElement(AdminRecipes) }),
    React.createElement(Route, { path: '/admin/recipes/new', element: React.createElement(AdminRecipeForm) }),
    React.createElement(Route, { path: '/admin/recipes/:id/edit', element: React.createElement(AdminRecipeForm) }),
  ))))))
}
async function waitFor(check) {
  let last
  for (let index = 0; index < 100; index += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
    try { check(); return } catch (error) { last = error }
  }
  throw last
}
function field(name) { const element = document.querySelector(`[name="${name}"]`); assert.ok(element, `Field ${name}`); return element }
function button(label, scope = document) {
  const element = [...scope.querySelectorAll('button')].find((node) => node.textContent.trim() === label || node.getAttribute('aria-label') === label)
  assert.ok(element, `Button ${label}`); return element
}
async function click(element) { await act(async () => element.click()) }
async function fill(name, value) {
  const element = field(name)
  await act(async () => {
    const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, String(value))
    element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
async function submit() { await act(async () => document.querySelector('form:not([role="search"])').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
async function ready() { await waitFor(() => assert.ok(document.querySelector('[name="recipeName"]'))) }
function writes(state) { return state.calls.filter((call) => ['post', 'patch', 'delete'].includes(call.method)) }
function clean() { assert.deepEqual(errors, [], 'No React DOM warnings or act errors') }
async function fillValidNew() {
  await fill('recipeName', '  Canh trứng mới  '); await fill('categoryId', 8)
  await fill('ingredients.0.ingredientId', 4); await fill('ingredients.0.quantity', 2)
  await fill('steps.0.instruction', 'Đun nóng nước rồi cho trứng vào.')
}

test('recipe list uses server search, filters, sorting and pagination without hiding rows optimistically', async () => {
  const state = fixture((call) => call.path === '/admin/recipes' && call.method === 'get' ? pagination([recipe], Number(call.query.page), 25, 12) : undefined)
  await mount('/admin/recipes', state)
  await waitFor(() => assert.match(document.body.textContent, /25 món ăn/))
  await act(async () => {
    const input = document.getElementById('admin-recipes-search')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'trứng')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await act(async () => document.querySelector('form[role="search"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  await waitFor(() => assert.equal(state.calls.at(-1).query.search, 'trứng'))
  await click(button('Trang 2'))
  await waitFor(() => assert.equal(state.calls.at(-1).query.page, 2))
  assert.equal(window.location.search, '?search=tr%E1%BB%A9ng&page=2')
  await fill('categoryId', 8)
  await waitFor(() => assert.equal(state.calls.at(-1).query.categoryId, '8'))
  assert.equal(state.calls.at(-1).query.page, 1, 'Changing a filter resets pagination')
  await fill('sort', 'time_asc')
  await waitFor(() => assert.equal(state.calls.at(-1).query.sort, 'time_asc'))
  assert.match(document.querySelector('tbody').textContent, /22\/10\/2026/)
  assert.ok(document.querySelector('a[href="/admin/recipes/37/edit"]'))
  assert.equal(writes(state).length, 0); clean()
})

test('delete dialog requires confirmation, restores focus after cancellation, and retains conflict details', async () => {
  const state = fixture((call) => call.method === 'delete' ? reject(call.config, 409, 'Món đã có lượt yêu thích hoặc đánh giá.') : undefined)
  await mount('/admin/recipes', state)
  await waitFor(() => assert.ok(document.querySelector('table')))
  const trigger = button('Xóa Trứng cà chua'); trigger.focus(); await click(trigger)
  assert.ok(document.querySelector('[role="dialog"]'))
  assert.equal(writes(state).length, 0)
  await click(button('Hủy')); assert.equal(document.activeElement, trigger)
  await click(trigger); await click(button('Xác nhận xóa'))
  await waitFor(() => assert.match(document.querySelector('[role="dialog"]').textContent, /Món đã có lượt yêu thích/))
  const request = writes(state)[0]
  assert.deepEqual(request.body, {}); assert.equal(request.config.headers.get('X-CSRF-Token'), 'admin-recipe-fixture-csrf')
  assert.ok(document.querySelector('tbody').textContent.includes(recipe.recipeName)); clean()
})

test('successful delete reloads API data and shows real empty state only after completion', async () => {
  const state = fixture()
  await mount('/admin/recipes', state)
  await waitFor(() => assert.ok(document.querySelector('table')))
  await click(button('Xóa Trứng cà chua')); await click(button('Xác nhận xóa'))
  await waitFor(() => assert.match(document.body.textContent, /Đã xóa món ăn/))
  await waitFor(() => assert.match(document.body.textContent, /Chưa có công thức phù hợp/))
  assert.equal(document.querySelector('[role="dialog"]'), null); clean()
})

test('new recipe validates required fields, positive quantities, timing and safe image URLs before any write', async () => {
  const state = fixture()
  await mount('/admin/recipes/new', state); await ready(); await submit()
  assert.equal(field('recipeName').getAttribute('aria-invalid'), 'true')
  assert.equal(document.activeElement?.getAttribute('name'), 'recipeName')
  await fillValidNew(); await fill('imageUrl', 'javascript:alert(1)'); await fill('prepTime', 0); await fill('cookTime', 0); await fill('ingredients.0.quantity', '1.234')
  await submit()
  assert.equal(field('imageUrl').getAttribute('aria-invalid'), 'true')
  assert.equal(field('cookTime').getAttribute('aria-invalid'), 'true')
  assert.equal(field('ingredients.0.quantity').getAttribute('aria-invalid'), 'true')
  assert.equal(writes(state).length, 0); clean()
})

test('new recipe serializes one complete aggregate through CSRF and reports success after API', async () => {
  const state = fixture()
  await mount('/admin/recipes/new', state); await ready(); await fillValidNew(); await submit()
  await waitFor(() => assert.equal(window.location.pathname, '/admin/recipes'))
  assert.match(document.body.textContent, /Đã lưu công thức thành công/)
  const request = writes(state)[0]
  assert.equal(request.path, '/admin/recipes'); assert.equal(request.method, 'post')
  assert.deepEqual(request.body, { recipeName: 'Canh trứng mới', categoryId: 8, description: null, imageUrl: null, prepTime: 10, cookTime: 15, servings: 2, difficulty: 'Dễ', ingredients: [{ ingredientId: 4, quantity: 2, unit: 'quả', isRequired: true, notes: null }], steps: [{ stepNumber: 1, instruction: 'Đun nóng nước rồi cho trứng vào.', imageUrl: null }] })
  assert.equal(request.config.headers.get('X-CSRF-Token'), 'admin-recipe-fixture-csrf')
  clean()
})

test('recipe editor disables duplicate ingredient options and requires one mandatory ingredient and cooking step', async () => {
  const state = fixture()
  await mount('/admin/recipes/37/edit', state); await ready()
  await click(button('Thêm nguyên liệu'))
  assert.equal(field('ingredients.1.ingredientId').querySelector('option[value="4"]').disabled, true)
  await click(button('Xóa nguyên liệu 2'))
  await click(document.querySelector('input[type="checkbox"]'))
  await click(button('Xóa bước 1')); await submit()
  assert.match(document.body.textContent, /Cần ít nhất một nguyên liệu bắt buộc/)
  assert.match(document.body.textContent, /Cần ít nhất một bước chế biến/)
  assert.equal(writes(state).length, 0); clean()
})

test('edit strips read-only data and step IDs while preserving sequential order after step move and removal', async () => {
  const state = fixture()
  await mount('/admin/recipes/37/edit', state); await ready()
  await click(button('Thêm bước nấu')); await fill('steps.1.instruction', 'Nêm gia vị.')
  await click(button('Thêm bước nấu')); await fill('steps.2.instruction', 'Dọn ra đĩa.')
  await click(button('Chuyển bước 3 lên')); await click(button('Xóa bước 3'))
  await submit(); await waitFor(() => assert.equal(writes(state).length, 1))
  const request = writes(state)[0]
  assert.equal(request.method, 'patch'); assert.equal(request.path, '/admin/recipes/37')
  assert.deepEqual(request.body.steps, [{ stepNumber: 1, instruction: recipe.steps[0].instruction, imageUrl: null }, { stepNumber: 2, instruction: 'Dọn ra đĩa.', imageUrl: null }])
  for (const key of ['recipeId', 'createdAt', 'updatedAt', 'totalTime', 'categoryName']) assert.equal(Object.hasOwn(request.body, key), false)
  assert.equal(Object.hasOwn(request.body.steps[0], 'stepId'), false); clean()
})

test('failed save keeps complete editable draft, exposes server error and permits a deliberate retry', async () => {
  let deny = true
  const state = fixture((call) => call.method === 'patch' && deny ? reject(call.config, 400, 'Nguyên liệu không còn tồn tại.') : undefined)
  await mount('/admin/recipes/37/edit', state); await ready(); await fill('recipeName', 'Bản nháp giữ lại'); await submit()
  await waitFor(() => assert.match(document.body.textContent, /Nguyên liệu không còn tồn tại/))
  assert.equal(field('recipeName').value, 'Bản nháp giữ lại'); assert.equal(field('steps.0.instruction').value, recipe.steps[0].instruction)
  assert.equal(window.location.pathname, '/admin/recipes/37/edit')
  deny = false; await submit(); await waitFor(() => assert.equal(window.location.pathname, '/admin/recipes'))
  assert.equal(writes(state).length, 2); clean()
})

test('pending save cannot be duplicated and does not claim success before response', async () => {
  let complete
  const state = fixture((call) => call.method === 'patch' ? new Promise((resolve) => { complete = () => resolve({ data: { ...recipe, ...call.body } }) }) : undefined)
  await mount('/admin/recipes/37/edit', state); await ready(); await submit()
  await waitFor(() => assert.equal(typeof complete, 'function'))
  assert.equal(button('Đang lưu…').disabled, true); assert.equal(field('recipeName').matches(':disabled'), true)
  assert.doesNotMatch(document.body.textContent, /Đã lưu công thức thành công/)
  await submit(); assert.equal(writes(state).length, 1)
  await act(async () => complete()); await waitFor(() => assert.equal(window.location.pathname, '/admin/recipes')); clean()
})

test('cancel leaves recipe unchanged and option retrieval includes later server pages', async () => {
  const state = fixture((call) => {
    if (call.path === '/admin/ingredients') return pagination(Number(call.query.page) === 1 ? [options[0]] : [options[1]], Number(call.query.page), 101, 100)
  })
  await mount('/admin/recipes/37/edit', state); await ready()
  assert.ok(field('ingredients.0.ingredientId').querySelector('option[value="6"]'))
  assert.ok(state.calls.some((call) => call.path === '/admin/ingredients' && call.query.page === 2))
  await fill('recipeName', 'Thay đổi chưa lưu')
  await click([...document.querySelectorAll('a')].find((node) => node.textContent === 'Hủy và về danh sách'))
  await waitFor(() => assert.equal(window.location.pathname, '/admin/recipes'))
  assert.equal(writes(state).length, 0); clean()
})

test('form errors on load can retry and unmount aborts CSRF before a stale write', async () => {
  let failed = true, completeCsrf
  const state = fixture((call) => {
    if (call.path === '/admin/recipes/37' && call.method === 'get' && failed) return reject(call.config, 503, 'Chưa thể đọc công thức.')
    if (call.path === '/auth/csrf') return new Promise((resolve) => { completeCsrf = () => resolve({ csrfToken: 'late-fixture-token' }) })
  })
  await mount('/admin/recipes/37/edit', state)
  await waitFor(() => assert.match(document.body.textContent, /Chưa thể đọc công thức/))
  failed = false; await click(button('Thử lại')); await ready(); await submit()
  await waitFor(() => assert.equal(typeof completeCsrf, 'function'))
  await act(async () => root.unmount()); root = null
  await act(async () => completeCsrf())
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(writes(state).length, 0); clean()
})
