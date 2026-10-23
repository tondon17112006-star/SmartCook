import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Controlled unit fixtures exercise mounted production routes. Runtime services
// still use the real Axios instance; only its adapter is replaced in this file.
const CATALOG = [
  { ingredientId: 71, ingredientName: 'Trứng gà', ingredientCategory: 'Trứng', defaultUnit: 'quả', imageUrl: null },
  { ingredientId: 34, ingredientName: 'Dầu ăn', ingredientCategory: 'Gia vị', defaultUnit: 'ml', imageUrl: null },
  { ingredientId: 12, ingredientName: 'Cà chua', ingredientCategory: 'Rau củ', defaultUnit: 'g', imageUrl: null },
  { ingredientId: 46, ingredientName: 'Gạo', ingredientCategory: 'Nhóm mới từ API', defaultUnit: 'g', imageUrl: null },
]
const STORAGE_KEY = 'smartcook:pantry:v1'
const clientRoot = fileURLToPath(new URL('../', import.meta.url))
const globals = new Map()
let vite
let dom
let App
let api
let createRoot
let originalAdapter
let mountedRoot
let consoleErrors = []
let originalConsoleError

function installGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/ingredients', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent']) installGlobal(name, dom.window[name])
  installGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  dom.window.scrollTo = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  // Import after DOM installation so React installs its actual input events.
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: clientRoot, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  originalAdapter = api.defaults.adapter
  originalConsoleError = console.error
  console.error = (...arguments_) => { consoleErrors.push(arguments_.map(String).join(' ')) }
})

after(async () => {
  if (mountedRoot) await act(async () => mountedRoot.unmount())
  if (api) api.defaults.adapter = originalAdapter
  if (originalConsoleError) console.error = originalConsoleError
  if (vite) await vite.close()
  dom?.window.close()
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

function pagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit)
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
}

function makeRecipe(id, ready = true, servings = 4) {
  function ingredient(ingredientId, ingredientName, quantity, unit, isAvailable, isRequired = true) {
    return { ingredientId, ingredientName, quantity, adjustedQuantity: quantity * servings / 2, unit, isRequired, isAvailable, notes: null }
  }
  return {
    recipeId: id,
    recipeName: ready ? `Trứng chiên kiểm thử ${id}` : `Cơm cà chua kiểm thử ${id}`,
    categoryName: 'Món kiểm thử', imageUrl: null, description: 'Công thức trong bộ kiểm thử được kiểm soát.',
    prepTime: 5, cookTime: 7, totalTime: 12, servings: 2, requestedServings: servings, difficulty: 'Dễ',
    matchedRequiredCount: ready ? 2 : 1, totalRequiredCount: 2, missingRequiredCount: ready ? 0 : 1,
    matchPercentage: ready ? 100 : 50, status: ready ? 'ready' : 'missing',
    matchedIngredients: ready
      ? [ingredient(34, 'Dầu ăn', 15, 'ml', true), ingredient(71, 'Trứng gà', 3, 'quả', true)]
      : [ingredient(12, 'Cà chua', 250, 'g', true)],
    missingIngredients: ready ? [] : [ingredient(46, 'Gạo', 200, 'g', false)],
    optionalIngredients: [ingredient(98, 'Hành lá', 10, 'g', false, false)],
  }
}

function createAdapter({ recipes = [makeRecipe(101), makeRecipe(102, false)], ingredientHandler, suggestionHandler } = {}) {
  const calls = []
  const adapter = async (config) => {
    if (/^\/recipes\/\d+\/reviews$/u.test(config.url)) return { data: { data: [], summary: { averageRating: 0, reviewCount: 0 }, pagination: pagination(1, 20, 0) }, status: 200, statusText: 'OK', headers: {}, config }
    if (config.url === '/auth/me') {
      const error = new Error('Guest fixture')
      error.config = config
      error.response = { status: 401, data: { message: 'Vui lòng đăng nhập.' } }
      throw error
    }
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const call = { url: config.url, method: config.method, body, params: config.params, signal: config.signal }
    calls.push(call)
    let data
    if (config.url === '/ingredients') {
      data = ingredientHandler ? await ingredientHandler(call) : { data: CATALOG, pagination: pagination(config.params.page, config.params.limit, CATALOG.length) }
    } else if (config.url === '/recipes/suggest') {
      data = suggestionHandler ? await suggestionHandler(call) : {
        data: recipes.slice((body.page - 1) * body.limit, body.page * body.limit).map((recipe) => makeRecipe(recipe.recipeId, recipe.status === 'ready', body.servings)),
        pagination: pagination(body.page, body.limit, recipes.length),
      }
    } else if (/^\/recipes\/\d+$/.test(config.url)) {
      const recipeId = Number(config.url.split('/').at(-1))
      const recipe = makeRecipe(recipeId)
      data = { data: {
        ...recipe, category: { categoryId: 1, categoryName: recipe.categoryName, description: null, imageUrl: null },
        ingredients: [...recipe.matchedIngredients, ...recipe.missingIngredients, ...recipe.optionalIngredients].map((ingredient) => ({ ...ingredient, ingredientCategory: 'Nhóm kiểm thử', imageUrl: null, defaultUnit: ingredient.unit })),
        steps: [{ stepId: 1, stepNumber: 1, instruction: 'Nấu theo hướng dẫn trong bộ kiểm thử.', imageUrl: null }],
      } }
    } else throw new Error(`Unexpected unit-test API request: ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return { adapter, calls, suggestions: () => calls.filter((call) => call.url === '/recipes/suggest') }
}

async function mount(path, fixture, { saved = null, preserveSession = false } = {}) {
  if (mountedRoot) await act(async () => mountedRoot.unmount())
  mountedRoot = null
  document.getElementById('root').replaceChildren()
  if (!preserveSession) window.sessionStorage.clear()
  if (saved !== null) window.sessionStorage.setItem(STORAGE_KEY, saved)
  window.history.replaceState(null, '', path)
  api.defaults.adapter = fixture.adapter
  consoleErrors = []
  mountedRoot = createRoot(document.getElementById('root'))
  await act(async () => mountedRoot.render(React.createElement(App)))
}

async function waitFor(assertion, label) {
  let lastError
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
    try { assertion(); return } catch (error) { lastError = error }
  }
  throw new Error(`${label}: ${lastError?.message}`)
}

function main() { return document.querySelector('main') }
function text() { return main().textContent }
function byLabel(label, tag = 'button') {
  const element = main().querySelector(`${tag}[aria-label="${label}"]`)
  assert.ok(element, `Expected ${tag}: ${label}`)
  return element
}
function byText(value, tag = 'button', scope = main()) {
  const element = [...scope.querySelectorAll(tag)].find((item) => item.textContent.trim() === value)
  assert.ok(element, `Expected ${tag} text: ${value}`)
  return element
}
async function click(element) { await act(async () => element.click()) }
async function enter(input, value) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')
    descriptor.set.call(input, value)
    input.dispatchEvent(new window.Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
function savedPantry(ingredientIds, servings = 2) { return JSON.stringify({ version: 1, ingredientIds, servings }) }
function ingredientCards() { return [...main().querySelectorAll('button[aria-pressed]')].filter((button) => button.hasAttribute('aria-label')) }
function assertNoReactErrors() { assert.deepEqual(consoleErrors, [], 'No React render, act or DOM errors') }

test('mounted IngredientFinder searches complete catalog, selects/toggles/chips/clears, and submits numeric IDs with servings4', async () => {
  const fixture = createAdapter()
  await mount('/ingredients', fixture)
  await waitFor(() => assert.equal(ingredientCards().length, 4), 'catalog rendered')
  assert.match(text(), /Trong bếp bạn có gì\?/)
  assert.equal(byText('Tìm món ăn phù hợp').disabled, true)
  assert.equal(fixture.calls.length, 1)

  const search = main().querySelector('input[placeholder="Tìm nguyên liệu: trứng, thịt, cà chua..."]')
  await enter(search, 'TRỨNG'.normalize('NFD'))
  assert.equal(ingredientCards().length, 1)
  assert.match(ingredientCards()[0].textContent, /Trứng gà/)
  await click(byLabel('Xóa nội dung tìm nguyên liệu'))
  assert.equal(document.activeElement, search)
  assert.equal(ingredientCards().length, 4)
  await click(byText('Nhóm mới từ API'))
  assert.equal(ingredientCards().length, 1)
  assert.match(ingredientCards()[0].textContent, /Gạo/)
  await click(byText('Tất cả'))
  assert.equal(ingredientCards().length, 4)

  await click(byLabel('Chọn Trứng gà'))
  assert.equal(main().querySelector('button[aria-pressed][aria-label="Bỏ chọn Trứng gà"]').getAttribute('aria-pressed'), 'true')
  assert.equal(byText('Tìm món ăn phù hợp').disabled, false)
  await click(byLabel('Chọn Dầu ăn'))
  assert.equal(main().querySelectorAll('ul[aria-label="Nguyên liệu đã chọn"] li').length, 2)
  await click(main().querySelector('button[aria-pressed="true"][aria-label="Bỏ chọn Trứng gà"]'))
  assert.equal(main().querySelectorAll('ul[aria-label="Nguyên liệu đã chọn"] li').length, 1)
  await click(byLabel('Chọn Trứng gà'))
  await click(main().querySelector('ul[aria-label="Nguyên liệu đã chọn"] button[aria-label="Bỏ chọn Dầu ăn"]'))
  assert.equal(main().querySelectorAll('ul[aria-label="Nguyên liệu đã chọn"] li').length, 1)
  await click(byText('Xóa tất cả'))
  assert.equal(byText('Tìm món ăn phù hợp').disabled, true)
  assert.equal(main().querySelectorAll('ul[aria-label="Nguyên liệu đã chọn"] li').length, 0)

  await click(byLabel('Chọn Trứng gà'))
  await click(byLabel('Chọn Dầu ăn'))
  await click(byLabel('Chọn Cà chua'))
  await enter(main().querySelector('select'), '4')
  const persisted = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY))
  assert.deepEqual(persisted, { version: 1, ingredientIds: [71, 34, 12], servings: 4 })
  assert.equal(new Set(persisted.ingredientIds).size, persisted.ingredientIds.length)
  assert.equal(fixture.calls.length, 1, 'local search/toggles do not repeatedly fetch the catalog')
  await click(byText('Tìm món ăn phù hợp'))
  await waitFor(() => assert.match(text(), /2 món phù hợp/), 'suggestions rendered')
  assert.equal(window.location.pathname, '/suggestions')
  assert.equal(fixture.suggestions().length, 1)
  assert.deepEqual(fixture.suggestions()[0].body, { ingredientIds: [12, 34, 71], servings: 4, page: 1, limit: 12 })
  assert.match(text(), /100%/)
  assert.match(text(), /50%/)
  assert.match(text(), /Đủ loại nguyên liệu chính/)
  assert.match(text(), /Cần thêm 1 loại nguyên liệu bắt buộc/)
  assert.match(text(), /6 quả/)
  assert.match(text(), /30 ml/)
  assert.match(text(), /400 g/)
  assert.match(text(), /Gia vị \/ nguyên liệu tùy chọn/)
  assert.equal(main().querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 101"]').getAttribute('href'), '/recipes/101')

  await click(byText('Thay đổi nguyên liệu', 'a'))
  await waitFor(() => assert.ok(byLabel('Bỏ chọn Trứng gà')), 'return to ingredient finder')
  assert.equal(main().querySelector('select').value, '4')
  assert.equal(main().querySelectorAll('ul[aria-label="Nguyên liệu đã chọn"] li').length, 3)
  assert.equal(fixture.calls.filter((call) => call.url === '/ingredients').length, 1, 'provider remains mounted between ingredient routes')
  await click(byText('Tìm món ăn phù hợp'))
  await waitFor(() => assert.match(text(), /2 món phù hợp/), 'suggestions revisited')
  await mount('/suggestions', fixture, { preserveSession: true })
  await waitFor(() => assert.match(text(), /2 món phù hợp/), 'reload restores session')
  assert.match(text(), /Định lượng cho 4 người ăn/)
  assert.equal(fixture.suggestions().at(-1).body.servings, 4)
  assert.deepEqual(fixture.suggestions().at(-1).body.ingredientIds, [12, 34, 71])
  await click(main().querySelector('a[aria-label="Xem công thức Trứng chiên kiểm thử 101"]'))
  await waitFor(() => assert.match(main().querySelector('h1').textContent, /Trứng chiên kiểm thử 101/), 'detail route')
  assert.equal(window.location.pathname, '/recipes/101')
  assertNoReactErrors()
})

test('mounted route restores stale IDs safely, reports corrupt storage and blocks empty suggestions', async () => {
  let fixture = createAdapter()
  await mount('/suggestions', fixture, { saved: savedPantry([71, 999], 4) })
  await waitFor(() => assert.match(text(), /2 món phù hợp/), 'valid subset restored')
  assert.match(text(), /Một số nguyên liệu đã lưu không còn/)
  assert.deepEqual(fixture.suggestions()[0].body.ingredientIds, [71])
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)).ingredientIds, [71])
  fixture = createAdapter()
  await mount('/suggestions', fixture, { saved: '{bad json' })
  await waitFor(() => assert.match(text(), /Căn bếp của bạn có những gì\?/), 'corrupt state recovered')
  assert.match(text(), /Lựa chọn đã lưu không còn hợp lệ/)
  assert.equal(fixture.suggestions().length, 0)
  await click(byText('Chọn nguyên liệu', 'a'))
  await waitFor(() => assert.equal(ingredientCards().length, 4), 'empty ingredient finder')
  assert.equal(byText('Tìm món ăn phù hợp').disabled, true)
  assert.equal(main().querySelector('select').value, '2')
  assertNoReactErrors()
})

test('mounted IngredientFinder handles catalog failure with retry and shows a useful search empty state', async () => {
  let failure = true
  const fixture = createAdapter({ ingredientHandler: () => {
    if (failure) throw new Error('unit controlled network failure')
    return { data: CATALOG, pagination: pagination(1, 100, CATALOG.length) }
  } })
  await mount('/ingredients', fixture, { saved: savedPantry([71]) })
  await waitFor(() => assert.match(text(), /Chưa thể tải nguyên liệu/), 'catalog error rendered')
  assert.equal(byText('Tìm món ăn phù hợp').disabled, true)
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)).ingredientIds, [71], 'catalog network error does not erase selection')
  failure = false
  await click(byText('Thử lại'))
  await waitFor(() => assert.equal(ingredientCards().length, 4), 'catalog retry succeeded')
  assert.equal(main().querySelector('button[aria-pressed="true"][aria-label="Bỏ chọn Trứng gà"]').getAttribute('aria-pressed'), 'true')
  await enter(main().querySelector('input[inputmode="search"]'), 'không tìm thấy nguyên liệu này')
  assert.match(text(), /Chưa tìm thấy nguyên liệu này/)
  await click(byText('Xóa bộ lọc', 'button', main().querySelector('[role="status"]')))
  assert.equal(ingredientCards().length, 4)
  assertNoReactErrors()
})

test('mounted Suggestions retries network failures and displays the real empty response without stale cards', async () => {
  let failure = true
  const fixture = createAdapter({ suggestionHandler: ({ body }) => {
    if (failure) throw new Error('unit controlled suggestion network failure')
    return { data: [], pagination: pagination(body.page, body.limit, 0) }
  } })
  await mount('/suggestions', fixture, { saved: savedPantry([71], 4) })
  await waitFor(() => assert.match(text(), /Chưa tải được món phù hợp/), 'suggestion error rendered')
  assert.match(text(), /Không thể kết nối để tải dữ liệu/)
  assert.equal(main().querySelectorAll('article').length, 0)
  failure = false
  await click(byText('Thử lại'))
  await waitFor(() => assert.match(text(), /Chưa tìm thấy món phù hợp/), 'suggestion empty state rendered')
  assert.match(text(), /0 món phù hợp/)
  assert.equal(fixture.suggestions().length, 2)
  assert.equal(main().querySelectorAll('article').length, 0)
  assert.ok(byText('Chọn thêm nguyên liệu', 'a'))
  assertNoReactErrors()
})

test('mounted pagination follows API pages, full-set ready/missing filters load all pages and reuse the complete collection', async () => {
  const recipes = Array.from({ length: 53 }, (_, index) => makeRecipe(201 + index, index % 2 === 0))
  const fixture = createAdapter({ recipes })
  await mount('/suggestions', fixture, { saved: savedPantry([71, 34, 12], 4) })
  await waitFor(() => assert.match(text(), /53 món phù hợp/), 'first API page rendered')
  assert.equal(main().querySelectorAll('article').length, 12)
  assert.equal(byLabel('Trang trước').disabled, true)
  const pageOneIds = [...main().querySelectorAll('article h3 a')].map((item) => item.getAttribute('href'))
  await click(byLabel('Trang sau'))
  await waitFor(() => assert.match(text(), /Trang 2 \/ 5/), 'second API page rendered')
  const pageTwoIds = [...main().querySelectorAll('article h3 a')].map((item) => item.getAttribute('href'))
  assert.equal(pageTwoIds.some((id) => pageOneIds.includes(id)), false)
  assert.deepEqual(fixture.suggestions().map((call) => call.body.page), [1, 2])
  await click(byLabel('Trang 5'))
  await waitFor(() => assert.match(text(), /Trang 5 \/ 5/), 'last API page rendered')
  assert.equal(main().querySelectorAll('article').length, 5)
  assert.equal(byLabel('Trang sau').disabled, true)

  await click(main().querySelector('input[value="ready"]'))
  await waitFor(() => assert.match(text(), /27 món đủ loại nguyên liệu bắt buộc/), 'ready filter complete')
  assert.match(text(), /Đã lọc trên toàn bộ 53 món phù hợp/)
  assert.equal(main().querySelectorAll('article').length, 12)
  assert.deepEqual(fixture.suggestions().slice(-2).map((call) => ({ page: call.body.page, limit: call.body.limit })), [{ page: 1, limit: 50 }, { page: 2, limit: 50 }])
  const callCount = fixture.suggestions().length
  await click(byLabel('Trang sau'))
  assert.match(text(), /Trang 2 \/ 3/)
  assert.equal(fixture.suggestions().length, callCount, 'filtered pages reuse the full set')
  await click(main().querySelector('input[value="missing"]'))
  assert.match(text(), /26 món còn thiếu nguyên liệu/)
  assert.match(text(), /Trang 1 \/ 3/)
  assert.equal(fixture.suggestions().length, callCount, 'switching ready/missing reuses the complete collection')
  assert.equal([...main().querySelectorAll('article')].every((article) => article.textContent.includes('Cần thêm 1 loại nguyên liệu bắt buộc')), true)
  await click(byText('Thay đổi nguyên liệu', 'a'))
  await click(byLabel('Chọn Gạo'))
  await click(byText('Tìm món ăn phù hợp'))
  await waitFor(() => assert.match(text(), /Trang 1 \/ 5/), 'changed selection resets page and status')
  assert.deepEqual(fixture.suggestions().at(-1).body, { ingredientIds: [12, 34, 46, 71], servings: 4, page: 1, limit: 12 })
  assertNoReactErrors()
})

test('mounted requests abort obsolete selection and never replace current results with an earlier response', async () => {
  let finishOld
  const fixture = createAdapter({ suggestionHandler: ({ body }) => {
    if (body.ingredientIds.length === 1) return new Promise((resolve) => { finishOld = () => resolve({ data: [makeRecipe(901)], pagination: pagination(body.page, body.limit, 1) }) })
    return { data: [makeRecipe(902, false)], pagination: pagination(body.page, body.limit, 1) }
  } })
  await mount('/suggestions', fixture, { saved: savedPantry([71], 4) })
  await waitFor(() => assert.equal(typeof finishOld, 'function'), 'old request started')
  assert.match(text(), /Đang tìm món ngon/)
  await click(byText('Thay đổi nguyên liệu', 'a'))
  await click(byLabel('Chọn Dầu ăn'))
  await click(byText('Tìm món ăn phù hợp'))
  await waitFor(() => assert.match(text(), /Cơm cà chua kiểm thử 902/), 'new request completed')
  assert.equal(fixture.suggestions()[0].signal.aborted, true)
  await act(async () => { finishOld(); await Promise.resolve() })
  assert.match(text(), /Cơm cà chua kiểm thử 902/)
  assert.doesNotMatch(text(), /Trứng chiên kiểm thử 901/)
  assert.equal(main().querySelectorAll('article').length, 1)
  assertNoReactErrors()
})
