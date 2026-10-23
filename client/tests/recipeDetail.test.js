import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Controlled HTTP fixtures belong to tests only. Components, routes, Axios and
// session storage are the production implementations, mounted in StrictMode.
const PANTRY_KEY = 'smartcook:pantry:v1'
const clientRoot = fileURLToPath(new URL('../', import.meta.url))
const globals = new Map()
let dom, vite, App, api, createRoot, root, originalAdapter, originalConsoleError
let consoleErrors = []

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/recipes/101', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent', 'PopStateEvent']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  for (const name of ['requestAnimationFrame', 'cancelAnimationFrame']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name].bind(dom.window) })
  }
  dom.window.scrollTo = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: clientRoot, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  originalAdapter = api.defaults.adapter
  originalConsoleError = console.error
  console.error = (...values) => { consoleErrors.push(values.map(String).join(' ')) }
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

function page(total, limit = 12) {
  return { page: 1, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: false, hasPreviousPage: false }
}

function recipe(id = 101, overrides = {}) {
  const prefix = id === 101 ? '' : ' món khác'
  return {
    recipeId: id, recipeName: `Trứng chiên kiểm thử ${id}`, description: 'Mô tả trong bộ kiểm thử được kiểm soát.',
    imageUrl: null, prepTime: 5, cookTime: 7, totalTime: 12, servings: 2, difficulty: 'Dễ',
    categoryName: 'Món trứng kiểm thử', category: { categoryId: 9, categoryName: 'Món trứng kiểm thử', description: null, imageUrl: null },
    ingredients: [
      { ingredientId: 71 + id * 10, ingredientName: `Trứng gà${prefix}`, ingredientCategory: 'Trứng', defaultUnit: 'quả', quantity: 3, unit: 'quả', isRequired: true, notes: null, imageUrl: null },
      { ingredientId: 34 + id * 10, ingredientName: `Dầu ăn${prefix}`, ingredientCategory: 'Gia vị', defaultUnit: 'ml', quantity: 15, unit: 'ml', isRequired: true, notes: 'Dùng chảo chống dính.', imageUrl: null },
      { ingredientId: 12 + id * 10, ingredientName: `Muối${prefix}`, ingredientCategory: 'Gia vị', defaultUnit: 'g', quantity: 0.333, unit: 'g', isRequired: false, notes: null, imageUrl: null },
    ],
    steps: [
      { stepId: id * 10 + 1, stepNumber: 1, instruction: `Sơ chế trong bộ kiểm thử ${id}.`, imageUrl: null },
      { stepId: id * 10 + 2, stepNumber: 2, instruction: `Chế biến trong bộ kiểm thử ${id}.`, imageUrl: null },
      { stepId: id * 10 + 3, stepNumber: 3, instruction: `Trình bày trong bộ kiểm thử ${id}.`, imageUrl: null },
    ],
    ...overrides,
  }
}

function createFixture({ detail = recipe(), detailHandler, related = [recipe(), recipe(102), recipe(103), recipe(104)] } = {}) {
  const calls = []
  const adapter = async (config) => {
    if (/^\/recipes\/\d+\/reviews$/u.test(config.url)) return { data: { data: [], summary: { averageRating: 0, reviewCount: 0 }, pagination: page(0, 20) }, status: 200, statusText: 'OK', headers: {}, config }
    if (config.url === '/auth/me') {
      const error = new Error('Guest fixture')
      error.config = config
      error.response = { status: 401, data: { message: 'Vui lòng đăng nhập.' } }
      throw error
    }
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const call = { url: config.url, method: config.method, params: config.params, body, signal: config.signal }
    calls.push(call)
    let data
    if (/^\/recipes\/\d+$/.test(config.url)) {
      const id = Number(config.url.split('/').at(-1))
      data = detailHandler ? await detailHandler(id, call) : { data: id === detail.recipeId ? detail : recipe(id) }
    } else if (config.url === '/recipes') {
      data = { data: related, pagination: page(related.length, config.params?.limit) }
    } else if (config.url === '/ingredients') {
      data = { data: [{ ingredientId: 71, ingredientName: 'Trứng gà', ingredientCategory: 'Trứng', defaultUnit: 'quả', imageUrl: null }], pagination: page(1, 100) }
    } else if (config.url === '/recipes/suggest') {
      data = { data: [{ ...detail, requestedServings: body.servings, matchPercentage: 100, status: 'ready', matchedRequiredCount: 1, totalRequiredCount: 1, missingRequiredCount: 0, matchedIngredients: [], missingIngredients: [], optionalIngredients: [] }], pagination: page(1) }
    } else throw new Error(`Unexpected detail-test API request: ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return { calls, adapter }
}

async function mount(path, fixture, { preserveSession = false, saved = {} } = {}) {
  if (root) await act(async () => root.unmount())
  root = null
  document.getElementById('root').replaceChildren()
  if (!preserveSession) window.sessionStorage.clear()
  for (const [key, value] of Object.entries(saved)) window.sessionStorage.setItem(key, value)
  // null simulates reload of the SAME history entry (including Router state).
  if (path !== null) window.history.replaceState(null, '', path)
  api.defaults.adapter = fixture.adapter
  consoleErrors = []
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(App)))
}

async function waitFor(assertion, label = 'detail state') {
  let lastError
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
    try { assertion(); return } catch (error) { lastError = error }
  }
  throw new Error(`${label}: ${lastError?.message}`)
}

function main() { return document.querySelector('main') }
function text() { return document.body.textContent }
function byText(label, tag = 'button', scope = document) {
  const element = [...scope.querySelectorAll(tag)].find((item) => item.textContent.trim() === label)
  assert.ok(element, `Expected ${tag}: ${label}`)
  return element
}
function byLabel(label, scope = document) {
  const element = scope.querySelector(`[aria-label="${label}"]`)
  assert.ok(element, `Expected accessible label: ${label}`)
  return element
}
function ingredientRow(name) { return byLabel(`Đã chuẩn bị ${name}`).closest('li') }
function selectedServings() { return Number(byLabel('Số người ăn').textContent.match(/\d+/)?.[0]) }
async function click(element) { assert.ok(element); await act(async () => element.click()) }
async function loaded(name = 'Trứng chiên kiểm thử 101') { await waitFor(() => assert.equal(main().querySelector('h1')?.textContent, name), 'recipe loaded') }
function noReactErrors() { assert.deepEqual(consoleErrors, [], 'No React render, DOM, hydration or act errors') }
function storageKey(id = 101) { return `smartcook:cooking:v1:${id}` }

test('detail renders actual API DTO, labeled ingredient checklist, ordered instructions, metadata and related API recipes', async () => {
  const fixture = createFixture()
  await mount('/recipes/101', fixture)
  await loaded()
  for (const pattern of [/Mô tả trong bộ kiểm thử/, /Món trứng kiểm thử/, /5 phút/, /7 phút/, /12 phút/, /Dễ/, /Khẩu phần gốc/, /2 người/]) assert.match(text(), pattern)
  assert.match(ingredientRow('Trứng gà').textContent, /3 quả/)
  assert.match(ingredientRow('Dầu ăn').textContent, /15 ml/)
  assert.match(ingredientRow('Dầu ăn').textContent, /Dùng chảo chống dính/)
  assert.match(ingredientRow('Muối').textContent, /Tùy chọn/)
  assert.equal(document.querySelectorAll('input[type="checkbox"][aria-label^="Đã chuẩn bị"]').length, 3)
  assert.deepEqual([...document.querySelectorAll('input[aria-label^="Hoàn thành bước"]')].map((element) => element.getAttribute('aria-label')), ['Hoàn thành bước 1', 'Hoàn thành bước 2', 'Hoàn thành bước 3'])
  await waitFor(() => assert.ok(document.querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 102"]')), 'related recipes')
  assert.equal(document.querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 101"]'), null, 'related section excludes current recipe')
  assert.equal(fixture.calls.some((call) => call.url === '/recipes' && call.params?.categoryId === 9), true, 'related request prioritizes API category')
  assert.equal(document.querySelector('nav[aria-label="Đường dẫn trang"] a[href="/recipes"]').textContent, 'Khám phá món ăn')
  assert.ok(byText('Bắt đầu nấu'))
  assert.ok(byText('Quay lại', 'a'))
  noReactErrors()
})

test('servings selector uses original quantities on every change, decimal formatting and limits 1–20', async () => {
  const fixture = createFixture()
  await mount('/recipes/101', fixture)
  await loaded()
  assert.equal(selectedServings(), 2)
  await click(byLabel('Tăng số người ăn'))
  assert.equal(selectedServings(), 3)
  assert.match(ingredientRow('Trứng gà').textContent, /4,5 quả/)
  await click(byLabel('Tăng số người ăn'))
  assert.match(ingredientRow('Trứng gà').textContent, /6 quả/)
  assert.match(ingredientRow('Dầu ăn').textContent, /30 ml/)
  await click(byLabel('Giảm số người ăn'))
  await click(byLabel('Giảm số người ăn'))
  assert.equal(selectedServings(), 2)
  assert.match(ingredientRow('Trứng gà').textContent, /3 quả/)
  assert.match(ingredientRow('Muối').textContent, /0,33\d? g/)
  await click(byLabel('Giảm số người ăn'))
  assert.equal(selectedServings(), 1)
  assert.equal(byLabel('Giảm số người ăn').disabled, true)
  await click(byLabel('Giảm số người ăn'))
  assert.equal(selectedServings(), 1)
  for (let count = 1; count < 20; count += 1) await click(byLabel('Tăng số người ăn'))
  assert.equal(selectedServings(), 20)
  assert.equal(byLabel('Tăng số người ăn').disabled, true)
  await click(byLabel('Tăng số người ăn'))
  assert.equal(selectedServings(), 20)
  assert.match(ingredientRow('Trứng gà').textContent, /30 quả/)
  assert.match(ingredientRow('Dầu ăn').textContent, /150 ml/)
  assert.doesNotMatch(text(), /NaN|Infinity/)
  assert.equal(fixture.calls.filter((call) => call.method !== 'get').length, 0, 'scaling never writes to Backend')
  noReactErrors()
})

test('ingredient and step toggles update accessible controls and real progress, including unchecking', async () => {
  await mount('/recipes/101', createFixture())
  await loaded()
  await click(byLabel('Đã chuẩn bị Trứng gà'))
  assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, true)
  assert.match(text(), /1\s*\/\s*3 nguyên liệu/)
  assert.match(ingredientRow('Trứng gà').textContent, /Đã chuẩn bị/)
  await click(byLabel('Đã chuẩn bị Trứng gà'))
  assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, false)
  await click(byLabel('Hoàn thành bước 2'))
  assert.equal(byLabel('Hoàn thành bước 2').checked, true)
  assert.match(text(), /1\s*\/\s*3 bước đã hoàn thành\s*[–—-]\s*33%/)
  assert.equal(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '33')
  await click(byLabel('Hoàn thành bước 2'))
  assert.match(text(), /0\s*\/\s*3 bước đã hoàn thành\s*[–—-]\s*0%/)
  noReactErrors()
})

test('Cooking Mode focuses one step, supports previous/next and completion, then exits without losing progress', async () => {
  await mount('/recipes/101', createFixture())
  await loaded()
  await click(byText('Bắt đầu nấu'))
  await waitFor(() => assert.ok(byText('Thoát chế độ nấu')), 'cooking mode open')
  const mode = document.querySelector('[role="dialog"]') || main()
  assert.match(mode.textContent, /Sơ chế trong bộ kiểm thử 101/)
  assert.doesNotMatch(mode.textContent, /Chế biến trong bộ kiểm thử 101|Trình bày trong bộ kiểm thử 101/)
  assert.equal(byText('Bước trước').disabled, true)
  await click(byText('Bước tiếp theo'))
  assert.match(mode.textContent, /Chế biến trong bộ kiểm thử 101/)
  await click(byText('Bước trước'))
  assert.match(mode.textContent, /Sơ chế trong bộ kiểm thử 101/)
  await click(byText('Đánh dấu hoàn thành'))
  await click(byText('Bước tiếp theo'))
  await click(byText('Đánh dấu hoàn thành'))
  await click(byText('Bước tiếp theo'))
  assert.equal(byText('Bước tiếp theo').disabled, true)
  await click(byText('Đánh dấu hoàn thành'))
  assert.match(mode.textContent, /3\s*\/\s*3 bước đã hoàn thành\s*[–—-]\s*100%/)
  assert.match(mode.textContent, /Chúc mừng|Hoàn thành món ăn/i)
  await click(byText('Xem toàn bộ công thức'))
  await waitFor(() => assert.equal([...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Thoát chế độ nấu'), false), 'cooking mode closed')
  assert.equal([...document.querySelectorAll('input[aria-label^="Hoàn thành bước"]')].every((element) => element.checked), true)
  noReactErrors()
})

test('Escape closes the focused cooking panel and restores focus, without exiting when closing the shared navbar menu', async () => {
  await mount('/recipes/101', createFixture())
  await loaded()
  await click(byText('Bắt đầu nấu'))
  const menuButton = document.querySelector('header button[aria-label="Mở menu"]')
  await click(menuButton)
  await act(async () => {
    menuButton.focus()
    menuButton.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  assert.equal(menuButton.getAttribute('aria-expanded'), 'false')
  assert.ok(byText('Thoát chế độ nấu'))
  const heading = main().querySelector('h2')
  await act(async () => {
    heading.focus()
    heading.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await waitFor(() => assert.equal(document.activeElement, byText('Bắt đầu nấu')), 'focus restored after Escape')
  noReactErrors()
})

test('session reload restores selected servings, checklist, completed steps and the current cooking step', async () => {
  const fixture = createFixture()
  await mount('/recipes/101', fixture)
  await loaded()
  await click(byLabel('Tăng số người ăn'))
  await click(byLabel('Đã chuẩn bị Trứng gà'))
  await click(byLabel('Hoàn thành bước 1'))
  await click(byText('Bắt đầu nấu'))
  await click(byText('Bước tiếp theo'))
  await click(byText('Thoát chế độ nấu'))
  const saved = JSON.parse(window.sessionStorage.getItem(storageKey()))
  assert.equal(saved.recipeId, 101)
  assert.equal(saved.servings, 3)
  assert.deepEqual(saved.preparedIds, [1081])
  assert.deepEqual(saved.completedIds, [1011])
  assert.equal(saved.currentStepId, 1012)
  await mount(null, fixture, { preserveSession: true })
  await loaded()
  assert.equal(selectedServings(), 3)
  assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, true)
  assert.equal(byLabel('Hoàn thành bước 1').checked, true)
  await click(byText('Bắt đầu nấu'))
  assert.match((document.querySelector('[role="dialog"]') || main()).textContent, /Chế biến trong bộ kiểm thử 101/)
  await click(byText('Thoát chế độ nấu'))
  noReactErrors()
})

test('each recipe has independent progress and reset clears only the current recipe progress', async () => {
  const fixture = createFixture()
  await mount('/recipes/101', fixture)
  await loaded()
  await click(byLabel('Đã chuẩn bị Trứng gà'))
  await click(byLabel('Hoàn thành bước 1'))
  const savedFirst = window.sessionStorage.getItem(storageKey())
  await click(document.querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 102"]'))
  await loaded('Trứng chiên kiểm thử 102')
  assert.equal(byLabel('Đã chuẩn bị Trứng gà món khác').checked, false)
  assert.equal(byLabel('Hoàn thành bước 1').checked, false)
  await click(byLabel('Đã chuẩn bị Trứng gà món khác'))
  await click(byLabel('Hoàn thành bước 2'))
  await click(byText('Làm lại từ đầu'))
  assert.equal(byLabel('Đã chuẩn bị Trứng gà món khác').checked, false)
  assert.equal(byLabel('Hoàn thành bước 2').checked, false)
  assert.match(text(), /0\s*\/\s*3 bước đã hoàn thành\s*[–—-]\s*0%/)
  assert.equal(window.sessionStorage.getItem(storageKey()), savedFirst)
  await click(document.querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 101"]'))
  await loaded()
  assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, true)
  assert.equal(byLabel('Hoàn thành bước 1').checked, true)
  noReactErrors()
})

test('stale session IDs and invalid current step are reconciled with the current recipe DTO', async () => {
  const saved = JSON.stringify({ version: 1, recipeId: 101, servings: 4, preparedIds: [1081, 99999], completedIds: [1012, 99999], currentStepId: 99999, lastSuggestionEntry: null })
  await mount('/recipes/101', createFixture(), { saved: { [storageKey()]: saved } })
  await loaded()
  assert.equal(selectedServings(), 4)
  assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, true)
  assert.equal(byLabel('Hoàn thành bước 2').checked, true)
  const reconciled = JSON.parse(window.sessionStorage.getItem(storageKey()))
  assert.deepEqual(reconciled.preparedIds, [1081])
  assert.deepEqual(reconciled.completedIds, [1012])
  assert.equal(reconciled.currentStepId, 1011)
  noReactErrors()
})

test('invalid recipe URLs never request details and API 404 renders a useful Vietnamese empty state', async () => {
  for (const path of ['/recipes/0', '/recipes/abc', '/recipes/2147483648']) {
    const fixture = createFixture()
    await mount(path, fixture)
    await waitFor(() => assert.match(text(), /Đường dẫn món ăn chưa hợp lệ/))
    assert.equal(fixture.calls.length, 0)
    assert.ok(document.querySelector('a[href="/recipes"]'))
    noReactErrors()
  }
  const fixture = createFixture({ detailHandler: () => { const error = new Error('not found'); error.response = { status: 404, data: { message: 'Không tìm thấy món ăn.' } }; throw error } })
  await mount('/recipes/999', fixture)
  await waitFor(() => assert.match(text(), /Không tìm thấy món ăn/))
  assert.equal(document.querySelector('button')?.textContent === 'Bắt đầu nấu', false)
  assert.ok(document.querySelector('a[href="/recipes"]'))
  noReactErrors()
})

test('detail network failure preserves saved progress and can retry a successful API response', async () => {
  let fail = true
  const fixture = createFixture({ detailHandler: () => {
    if (fail) throw new Error('controlled network failure')
    return { data: recipe() }
  } })
  const saved = JSON.stringify({ version: 1, recipeId: 101, servings: 4, preparedIds: [1081], completedIds: [1011], currentStepId: 1012, lastSuggestionEntry: null })
  await mount('/recipes/101', fixture, { saved: { [storageKey()]: saved } })
  await waitFor(() => assert.match(text(), /Chưa thể mở công thức/))
  assert.equal(window.sessionStorage.getItem(storageKey()), saved)
  fail = false
  await click(byText('Thử lại'))
  await loaded()
  assert.equal(selectedServings(), 4)
  assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, true)
  assert.equal(byLabel('Hoàn thành bước 1').checked, true)
  noReactErrors()
})

test('missing ingredients or steps give clear messages and no fabricated content; absent related recipes are hidden', async () => {
  const fixture = createFixture({ detail: recipe(101, { ingredients: [], steps: [] }), related: [recipe()] })
  await mount('/recipes/101', fixture)
  await loaded()
  assert.match(text(), /nguyên liệu.*đang được cập nhật/i)
  assert.match(text(), /bước.*đang được cập nhật/i)
  assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 0)
  const start = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Bắt đầu nấu')
  assert.equal(!start || start.disabled, true)
  assert.doesNotMatch(text(), /Có thể bạn cũng thích/)
  assert.doesNotMatch(text(), /NaN|Infinity/)
  noReactErrors()
})

test('invalid original servings blocks unsafe scaling and image failure uses the existing neutral placeholder', async () => {
  for (const servings of [0, null, 'invalid']) {
    await mount('/recipes/101', createFixture({ detail: recipe(101, { servings, imageUrl: 'https://example.invalid/controlled-test-image.jpg' }), related: [] }))
    await loaded()
    assert.doesNotMatch(text(), /NaN|Infinity/)
    assert.match(text(), /khẩu phần.*chưa hợp lệ|khẩu phần.*không hợp lệ/i)
    assert.equal(byLabel('Tăng số người ăn').disabled, true)
    assert.equal(byLabel('Giảm số người ăn').disabled, true)
    const image = main().querySelector('img[alt="Trứng chiên kiểm thử 101"]')
    assert.ok(image)
    await act(async () => image.dispatchEvent(new window.Event('error')))
    assert.ok(main().querySelector('[role="img"][aria-label="Trứng chiên kiểm thử 101. Ảnh đang cập nhật."]'))
    noReactErrors()
  }
})

test('Suggestions links carry selected servings4; manual changes survive reload of that same history entry', async () => {
  const fixture = createFixture()
  const olderProgress = { version: 1, recipeId: 101, servings: 6, preparedIds: [1081], completedIds: [1011], currentStepId: 1012, lastSuggestionEntry: 'an-older-suggestion-entry' }
  await mount('/suggestions', fixture, { saved: {
    [PANTRY_KEY]: JSON.stringify({ version: 1, ingredientIds: [71], servings: 4 }),
    [storageKey()]: JSON.stringify(olderProgress),
  } })
  await waitFor(() => assert.ok(document.querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 101"]')), 'suggestion card')
  await click(document.querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 101"]'))
  await loaded()
  assert.equal(window.location.pathname, '/recipes/101')
  assert.equal(window.history.state.usr.from, '/suggestions')
  assert.equal(window.history.state.usr.suggestedServings, 4)
  assert.equal(selectedServings(), 4, 'new Suggestions entry overrides older saved servings6 once')
  assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, true, 'new servings preserve recipe checklist')
  assert.equal(byLabel('Hoàn thành bước 1').checked, true)
  assert.match(ingredientRow('Trứng gà').textContent, /6 quả/)
  await click(byLabel('Tăng số người ăn'))
  assert.equal(selectedServings(), 5)
  await mount(null, fixture, { preserveSession: true })
  await loaded()
  assert.equal(selectedServings(), 5, 'reload does not replay the previous suggestion selection over a manual edit')
  assert.match(ingredientRow('Trứng gà').textContent, /7,5 quả/)
  noReactErrors()
})
