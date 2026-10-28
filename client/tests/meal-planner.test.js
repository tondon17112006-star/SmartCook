import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { addCalendarDays, formatWeekRange, startOfWeek, todayInVietnam, weekDates } from '../src/utilities/mealPlannerDates.js'

let dom, vite, root, createRoot, BrowserRouter, AuthContext, MealPlanner, AddMealDialog, api, service, originalAdapter
const descriptors = new Map()
const session = { currentUser: { userId: 1, fullName: 'Người thử', role: 'User' }, isAuthenticated: true, sessionGeneration: 1 }
const week = '2026-10-26'
const recipes = [{ recipeId: 1, recipeName: 'Trứng chiên', imageUrl: null, totalTime: 15, servings: 2, categoryId: 1 }, { recipeId: 2, recipeName: 'Canh cà chua', imageUrl: null, totalTime: 20, servings: 4, categoryId: 2 }]
before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/meal-planner', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PopStateEvent']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  descriptors.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  dom.window.scrollTo = () => {}
  ;({ createRoot } = await import('react-dom/client'))
  ;({ BrowserRouter } = await import('react-router-dom'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: MealPlanner } = await vite.ssrLoadModule('/src/pages/MealPlanner.jsx'))
  ;({ default: AddMealDialog } = await vite.ssrLoadModule('/src/components/meal-planner/AddMealDialog.jsx'))
  ;({ AuthContext } = await vite.ssrLoadModule('/src/context/AuthContext.js'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  service = await vite.ssrLoadModule('/src/services/mealPlannerService.js')
  originalAdapter = api.defaults.adapter
})
after(async () => {
  if (root) await act(async () => root.unmount())
  api.defaults.adapter = originalAdapter
  await vite?.close(); dom?.window.close()
  for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
})
function failure(config, status, message) { const error = new Error(message); error.config = config; error.response = { status, data: { message }, config }; throw error }
function fixture({ initial = [], handler } = {}) {
  const state = { calls: [], items: initial, nextId: 20 }
  state.adapter = async (config) => {
    const call = { path: config.url, method: config.method, params: config.params || {}, body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data, config }
    state.calls.push(call)
    const response = (data) => ({ data, status: 200, statusText: 'OK', headers: {}, config })
    if (handler) { const result = await handler(call, state); if (result !== undefined) return response(result) }
    if (call.path === '/auth/csrf') return response({ csrfToken: 'meal-csrf' })
    if (call.path === '/categories') return response({ data: [{ categoryId: 1, categoryName: 'Món trứng' }, { categoryId: 2, categoryName: 'Món canh' }] })
    if (call.path === '/recipes' || call.path === '/favorites') {
      const rows = (call.path === '/favorites' ? recipes.slice(1) : recipes).filter((row) => (!call.params.search || row.recipeName.includes(call.params.search)) && (!call.params.categoryId || String(row.categoryId) === call.params.categoryId))
      return response({ data: rows, pagination: { page: 1, limit: 6, total: rows.length, totalPages: rows.length ? 1 : 0 } })
    }
    if (call.path === '/meal-plans' && call.method === 'get') {
      const dates = weekDates(call.params.weekStart), items = state.items.filter((item) => dates.includes(item.mealDate))
      return response({ data: { mealPlanId: items.length ? 1 : null, weekStart: dates[0], weekEnd: dates[6], days: dates.map((date) => ({ date, meals: Object.fromEntries(['Breakfast', 'Lunch', 'Dinner'].map((type) => [type, items.filter((item) => item.mealDate === date && item.mealType === type)])) })), summary: { itemCount: items.length, mealCount: new Set(items.map((item) => `${item.mealDate}:${item.mealType}`)).size, dayCount: new Set(items.map((item) => item.mealDate)).size, ingredientCount: items.length ? 1 : 0 } } })
    }
    if (call.path === '/meal-plans/shopping-list') {
      const items = state.items.filter((item) => weekDates(call.params.weekStart).includes(item.mealDate))
      return response({ data: { weekStart: call.params.weekStart, weekEnd: addCalendarDays(call.params.weekStart, 6), items: items.length ? [{ ingredientId: 1, ingredientName: 'Trứng gà', ingredientCategory: 'Trứng', unit: 'quả', totalQuantity: String(items.reduce((sum, item) => sum + item.servings, 0)), recipeCount: 1, plannedItemCount: items.length, recipes }] : [] } })
    }
    assert.equal(config.headers.get('X-CSRF-Token'), 'meal-csrf')
    assert.equal(config.headers.get('Content-Type'), 'application/json')
    if (call.method === 'post') {
      const recipe = recipes.find((item) => item.recipeId === call.body.recipeId)
      const item = { ...recipe, ...call.body, mealPlanItemId: state.nextId++, mealPlanId: 1, originalServings: recipe.servings, sortOrder: 0 }
      state.items.push(item); return response({ data: item })
    }
    const id = Number(call.path.split('/').at(-1)), index = state.items.findIndex((item) => item.mealPlanItemId === id)
    if (call.method === 'patch') { state.items[index] = { ...state.items[index], ...call.body }; return response({ data: state.items[index] }) }
    if (call.method === 'delete') { assert.deepEqual(call.body, {}); state.items.splice(index, 1); return response({ message: 'Đã xóa.' }) }
    throw new Error(`Unhandled ${call.method} ${call.path}`)
  }
  return state
}
const planned = (overrides = {}) => ({ ...recipes[0], mealPlanItemId: 10, mealPlanId: 1, mealDate: week, mealType: 'Lunch', servings: 2, originalServings: 2, sortOrder: 0, ...overrides })
async function mount(state, { path = `/meal-planner?weekStart=${week}`, auth = session, component = MealPlanner, props = {} } = {}) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren(); window.history.replaceState(null, '', path)
  api.defaults.adapter = state.adapter
  root = createRoot(document.getElementById('root'))
  await render(auth, component, props)
}
async function render(auth = session, component = MealPlanner, props = {}) { await act(async () => root.render(React.createElement(BrowserRouter, null, React.createElement(AuthContext.Provider, { value: auth }, React.createElement(component, props))))) }
async function waitFor(check) { let last; for (let index = 0; index < 100; index += 1) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) }); try { check(); return } catch (error) { last = error } } throw last }
const text = () => document.body.textContent
function button(label, scope = document) { const node = [...scope.querySelectorAll('button')].find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label); assert.ok(node, `Button ${label}`); return node }
const dialog = () => document.querySelector('[role="dialog"]')
async function click(node) { await act(async () => node.click()) }
async function change(node, value) {
  assert.ok(node)
  await act(async () => { const prototype = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value); node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) })
}
async function submit(form) { await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
async function ready() { await waitFor(() => assert.ok(document.querySelector('[aria-label="Lịch nấu ăn 7 ngày"]'))) }
const writes = (state) => state.calls.filter((call) => ['post', 'patch', 'delete'].includes(call.method))

test('MP empty calendar renders seven days,21meals, real zero summary and required-only empty shopping', async () => {
  await mount(fixture()); await ready()
  assert.match(text(), /Bạn chưa lên lịch nấu ăn cho tuần này/u)
  assert.equal(document.querySelectorAll('[aria-label="Lịch nấu ăn 7 ngày"] > section').length, 7)
  assert.equal(document.querySelectorAll('[aria-label="Lịch nấu ăn 7 ngày"] section[aria-label*="ngày"]').length, 21)
  assert.match(text(), /Danh sách đi chợ đang trống/u)
  assert.equal(document.querySelectorAll('[aria-label="Thống kê tuần"] > div').length, 4)
})
test('MP previous/next/current week navigation loads server data and marks Vietnam today', async () => {
  const state = fixture(); await mount(state); await ready()
  await click(button('Tuần sau')); await ready(); assert.match(text(), /02\/11\/2026 – 08\/11\/2026/u)
  await click(button('Tuần trước')); await ready(); assert.match(text(), /26\/10\/2026 – 01\/11\/2026/u)
  await click(button('Tuần này')); await ready()
  assert.ok(text().includes(formatWeekRange(startOfWeek(todayInVietnam()))))
  assert.equal(document.querySelectorAll('[aria-current="date"]').length, 1)
  assert.equal(state.calls.filter((call) => call.path === '/meal-plans').length, week === startOfWeek(todayInVietnam()) ? 3 : 4)
})
test('MP current-week action rechecks Vietnam midnight without waiting for the refresh timer', async () => {
  const RealDate = globalThis.Date
  let instant = RealDate.parse('2026-11-01T16:59:59Z')
  class ClockDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [instant])) }
    static now() { return instant }
  }
  try {
    globalThis.Date = ClockDate
    const state = fixture(); await mount(state); await ready()
    assert.equal(todayInVietnam(), '2026-11-01')
    instant = RealDate.parse('2026-11-01T17:00:01Z')
    await click(button('Tuần này'))
    assert.equal(new URLSearchParams(window.location.search).get('weekStart'), '2026-11-02')
    await ready()
    assert.ok(state.calls.some((call) => call.path === '/meal-plans' && call.params.weekStart === '2026-11-02'))
    assert.equal(document.querySelector('[aria-current="date"] h2')?.textContent, 'Thứ Hai')
  } finally { globalThis.Date = RealDate }
})
test('MP loading/error/retry never reports a failed load as an empty successful week', async () => {
  let release
  let fail = true
  const state = fixture({ handler: async (call) => { if (call.path === '/meal-plans' && fail) { await new Promise((resolve) => { release = resolve }); return failure(call.config, 503, 'SQL tạm gián đoạn') } } })
  await mount(state); await waitFor(() => assert.equal(typeof release, 'function'))
  assert.match(text(), /Đang tải lịch nấu ăn/u)
  await act(async () => release()); await waitFor(() => assert.match(text(), /SQL tạm gián đoạn/u))
  assert.doesNotMatch(text(), /Bạn chưa lên lịch nấu ăn cho tuần này/u)
  fail = false; await click(button('Thử lại')); await ready()
})
test('MP add dialog searches/filter recipes, supports Favorites, validates servings and refreshes calendar/shopping after SQL success', async () => {
  const state = fixture(); await mount(state); await ready()
  await click(button('Thêm món bữa trưa ngày 26/10/2026'))
  await waitFor(() => assert.ok(dialog()?.querySelector('[name="search"]')))
  await change(dialog().querySelector('[name="search"]'), 'Canh'); await submit(dialog().querySelector('form'))
  await waitFor(() => assert.ok(state.calls.some((call) => call.path === '/recipes' && call.params.search === 'Canh')))
  await click(button('Món yêu thích', dialog())); await waitFor(() => assert.ok(state.calls.some((call) => call.path === '/favorites')))
  await click([...dialog().querySelectorAll('button')].find((node) => node.textContent.includes('Canh cà chua') && node.hasAttribute('aria-pressed')))
  await change(dialog().querySelector('[name="servings"]'), '21'); await submit(dialog().querySelector('form'))
  assert.match(text(), /1 đến 20/u); assert.equal(writes(state).length, 0)
  await change(dialog().querySelector('[name="servings"]'), '3'); await click(button('Thêm vào lịch', dialog())); await ready()
  await waitFor(() => assert.equal(dialog(), null))
  assert.equal(state.items[0].recipeId, 2); assert.equal(state.items[0].servings, 3); assert.equal(state.items[0].mealType, 'Lunch')
  await waitFor(() => assert.match(text(), /Đã mua 0\/1/u))
  assert.match(text(), /3 quả/u); assert.match(text(), /Đã thêm món vào lịch nấu ăn/u)
})
test('MP mutation409 preserves entered data, allows retry and never claims success early', async () => {
  let fail = true
  const state = fixture({ handler: (call) => { if (fail && call.method === 'post') return failure(call.config, 409, 'Món đã có trong bữa ăn.') } })
  let saved = 0
  await mount(state, { component: AddMealDialog, props: { recipe: recipes[0], initialServings: 5, mealDate: week, onClose: () => {}, onSaved: () => { saved += 1 } } })
  await click(button('Thêm vào lịch')); await waitFor(() => assert.match(text(), /Món đã có trong bữa ăn/u))
  assert.equal(dialog().querySelector('[name="servings"]').value, '5'); assert.equal(saved, 0)
  fail = false; await click(button('Thêm vào lịch')); await waitFor(() => assert.equal(saved, 1))
})
test('MP picker category filter, pagination, no-result and recipe error/retry use the real service query', async () => {
  let fail = false
  const state = fixture({ handler: (call) => {
    if (call.path !== '/recipes') return undefined
    if (fail) return failure(call.config, 503, 'Chưa đọc được công thức')
    if (call.params.search === 'không tồn tại') return { data: [], pagination: { page: 1, limit: 6, total: 0, totalPages: 0 } }
    const page = Number(call.params.page)
    return { data: page === 2 ? [recipes[1]] : [recipes[0]], pagination: { page, limit: 6, total: 7, totalPages: 2 } }
  } })
  await mount(state); await ready(); await click(button('Thêm món vào lịch'))
  await waitFor(() => assert.ok(dialog()?.querySelector('[aria-label="Trang sau"]')))
  await click(button('Trang sau', dialog()))
  await waitFor(() => assert.ok(dialog().textContent.includes('Canh cà chua')))
  await change(dialog().querySelector('select[id$="-category"]'), '2')
  await waitFor(() => assert.ok(state.calls.some((call) => call.path === '/recipes' && call.params.categoryId === '2' && call.params.page === 1)))
  await change(dialog().querySelector('[name="search"]'), 'không tồn tại'); await submit(dialog().querySelector('form'))
  await waitFor(() => assert.match(dialog().textContent, /Không tìm thấy công thức/u))
  fail = true; await change(dialog().querySelector('[name="search"]'), 'Canh'); await submit(dialog().querySelector('form'))
  await waitFor(() => assert.match(dialog().textContent, /Chưa đọc được công thức/u))
  fail = false; await click(button('Thử lại', dialog()))
  await waitFor(() => assert.match(dialog().textContent, /Trứng chiên/u))
})
test('MP pending add cannot double submit, close or claim success before the response', async () => {
  let release, saved = 0, closed = 0
  const state = fixture({ handler: async (call) => { if (call.method === 'post') { await new Promise((resolve) => { release = resolve }); return { data: planned({ mealPlanItemId: 20 }) } } } })
  await mount(state, { component: AddMealDialog, props: { recipe: recipes[0], mealDate: week, onClose: () => { closed += 1 }, onSaved: () => { saved += 1 } } })
  const form = dialog().querySelector('form')
  await submit(form); await submit(form)
  await waitFor(() => assert.equal(typeof release, 'function'))
  assert.equal(writes(state).length, 1); assert.equal(saved, 0)
  assert.equal(button('Đang thêm…').disabled, true)
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(closed, 0)
  await act(async () => release()); await waitFor(() => assert.equal(saved, 1))
})
test('MP edit preserves recipe link servings and updates shopping after moving to another week', async () => {
  const state = fixture({ initial: [planned()] }); await mount(state); await ready()
  assert.equal(document.querySelector('a[href*="source=meal-planner"]').getAttribute('href'), '/recipes/1?servings=2&source=meal-planner')
  assert.ok(document.querySelector('a[href$="&cook=1"]'))
  await click(button('Sửa Trứng chiên ngày 26/10/2026'))
  await change(dialog().querySelector('[name="servings"]'), '4'); await change(dialog().querySelector('[name="mealDate"]'), '2026-11-03'); await change(dialog().querySelector('[name="mealType"]'), 'Dinner')
  await click(button('Lưu thay đổi', dialog())); await waitFor(() => assert.equal(dialog(), null)); await ready()
  assert.equal(state.items[0].mealType, 'Dinner'); assert.equal(state.items[0].servings, 4)
  await waitFor(() => assert.match(text(), /Danh sách đi chợ đang trống/u))
  await click(button('Tuần sau')); await ready(); assert.ok(document.querySelector('a[href="/recipes/1?servings=4&source=meal-planner"]'))
})
test('MP delete requires confirmation, supports cancel and removes only scheduled item', async () => {
  const state = fixture({ initial: [planned()] }); await mount(state); await ready()
  await click(button('Xóa Trứng chiên ngày 26/10/2026')); assert.equal(writes(state).length, 0)
  await click(button('Hủy', dialog())); assert.equal(state.items.length, 1)
  await click(button('Xóa Trứng chiên ngày 26/10/2026')); await click(button('Xác nhận xóa', dialog()))
  await waitFor(() => assert.equal(dialog(), null)); await ready(); assert.equal(state.items.length, 0)
  assert.match(text(), /Đã xóa món khỏi lịch nấu ăn/u)
  assert.equal(writes(state)[0].path, '/meal-plans/items/10')
})
test('MP shopping checkmarks are temporary and copy reports real Clipboard success or manual fallback', async () => {
  const state = fixture({ initial: [planned()] }); await mount(state); await ready()
  await waitFor(() => assert.ok(document.querySelector('#shopping-list input[type="checkbox"]')))
  await click(document.querySelector('#shopping-list input')); assert.match(text(), /Đã mua 1\/1/u)
  let copied
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { copied = value } } })
  await click(button('Sao chép danh sách')); await waitFor(() => assert.match(text(), /Đã sao chép danh sách đi chợ/u)); assert.match(copied, /\[x\] Trứng gà: 2 quả/u)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } })
  await click(button('Sao chép danh sách')); await waitFor(() => assert.ok(document.querySelector('#shopping-list textarea')))
  assert.equal(document.activeElement, document.querySelector('#shopping-list textarea')); assert.match(text(), /Chưa thể sao chép tự động/u)
  await click(button('Tuần sau')); await ready(); await click(button('Tuần trước')); await ready()
  await waitFor(() => assert.match(text(), /Đã mua 0\/1/u))
})
test('MP dialog supports Escape, focus containment and restoring the opener', async () => {
  await mount(fixture()); await ready()
  const opener = button('Thêm món bữa sáng ngày 26/10/2026'); opener.focus(); await click(opener)
  await waitFor(() => assert.ok(dialog()?.contains(document.activeElement)))
  const focusable = [...dialog().querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter((node) => !node.hidden)
  focusable.at(-1).focus()
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
  assert.equal(document.activeElement, focusable[0])
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(dialog(), null); assert.equal(document.activeElement, opener); assert.equal(document.body.style.overflow, '')
})
test('MP session change clears drafts and aborts pending CSRF before any personal write', async () => {
  let release, csrfSignal
  const state = fixture({ handler: async (call) => { if (call.path === '/auth/csrf') { csrfSignal = call.config.signal; await new Promise((resolve) => { release = resolve }); return { csrfToken: 'meal-csrf' } } } })
  let saved = 0
  const props = { recipe: recipes[0], initialServings: 3, mealDate: week, onClose: () => {}, onSaved: () => { saved += 1 } }
  await mount(state, { component: AddMealDialog, props }); await click(button('Thêm vào lịch'))
  await waitFor(() => assert.equal(typeof release, 'function'))
  await render({ ...session, currentUser: { ...session.currentUser, userId: 2 }, sessionGeneration: 2 }, AddMealDialog, props)
  assert.equal(csrfSignal.aborted, true)
  await act(async () => release()); assert.equal(writes(state).length, 0); assert.equal(saved, 0)
  await render({ currentUser: null, isAuthenticated: false, sessionGeneration: 3 }, AddMealDialog, props); assert.equal(dialog(), null)
})
test('MP new account discards an old pending calendar response and closes private drafts', async () => {
  let release, oldSignal, first = true
  const state = fixture({ handler: async (call) => {
    if (call.path === '/meal-plans' && first) {
      first = false; oldSignal = call.config.signal
      await new Promise((resolve) => { release = resolve })
      return { data: { mealPlanId: 1, weekStart: week, weekEnd: '2026-11-01', days: weekDates(week).map((date) => ({ date, meals: { Breakfast: [], Lunch: date === week ? [planned()] : [], Dinner: [] } })), summary: { itemCount: 1, mealCount: 1, dayCount: 1, ingredientCount: 1 } } }
    }
  } })
  await mount(state); await waitFor(() => assert.equal(typeof release, 'function'))
  const next = { ...session, currentUser: { ...session.currentUser, userId: 2 }, sessionGeneration: 2 }
  await render(next); await ready(); assert.equal(oldSignal.aborted, true)
  await act(async () => release()); assert.match(text(), /Bạn chưa lên lịch nấu ăn cho tuần này/u)
  assert.equal(document.querySelector('a[href*="source=meal-planner"]'), null)
  await click(button('Thêm món vào lịch')); await waitFor(() => assert.ok(dialog()))
  await change(dialog().querySelector('[name="servings"]'), '9')
  await render({ ...next, sessionGeneration: 3 }); await ready()
  assert.equal(dialog(), null)
})
test('MP service uses private cookie requests, supplied AbortSignal and JSON/CSRF for all writes', async () => {
  const state = fixture(); api.defaults.adapter = state.adapter
  const signal = new AbortController().signal
  assert.equal((await service.getMealPlan(week, { signal })).days.length, 7)
  assert.deepEqual((await service.getShoppingList(week, { signal })).items, [])
  const item = await service.addMealPlanItem({ recipeId: 1, mealDate: week, mealType: 'Breakfast', servings: 2 }, { signal })
  await service.updateMealPlanItem(item.mealPlanItemId, { servings: 3 }, { signal })
  await service.deleteMealPlanItem(item.mealPlanItemId, { signal })
  assert.equal(writes(state).length, 3)
  for (const call of state.calls) { assert.equal(call.config.signal, signal); assert.equal(call.config.withCredentials, true) }
})
