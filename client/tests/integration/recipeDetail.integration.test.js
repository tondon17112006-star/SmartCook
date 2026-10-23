import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const baseURL = process.env.SMARTCOOK_TEST_API_URL || 'http://127.0.0.1:5000/api'

async function getJSON(path) {
  const response = await fetch(`${baseURL}${path}`)
  assert.equal(response.status, 200, `Live API ${path}`)
  return response.json()
}

test('live SQL catalog contains 20 recipe details with 80 correctly ordered cooking steps and original quantities', { timeout: 30000 }, async () => {
  const collection = await getJSON('/recipes?limit=100')
  assert.equal(collection.pagination.total, 20)
  const details = await Promise.all(collection.data.map(async (recipe) => (await getJSON(`/recipes/${recipe.recipeId}`)).data))
  assert.equal(details.length, 20)
  assert.equal(details.reduce((sum, recipe) => sum + recipe.steps.length, 0), 80)
  for (const recipe of details) {
    assert.equal(Number.isInteger(recipe.servings) && recipe.servings > 0, true)
    assert.ok(recipe.ingredients.length)
    assert.deepEqual(recipe.steps.map((step) => step.stepNumber), [...recipe.steps].sort((first, second) => first.stepNumber - second.stepNumber).map((step) => step.stepNumber))
    for (const ingredient of recipe.ingredients) assert.equal(Number.isFinite(ingredient.quantity) && ingredient.quantity > 0, true)
  }
})

// jsdom tests mounted DOM behavior against real Axios/Express/SQL Server. It
// deliberately makes no claims about visual layout or native browser focus.
test('live Suggestions → Detail keeps servings4, scales original SQL quantities, cooks, restores and resets session progress', { timeout: 30000 }, async () => {
  const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:5173/ingredients', pretendToBeVisual: true })
  const globals = new Map()
  let vite, root, api, interceptor
  const originalConsoleError = console.error
  const consoleErrors = []
  const requests = []
  try {
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent']) {
      globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
    }
    for (const name of ['requestAnimationFrame', 'cancelAnimationFrame']) {
      globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name].bind(dom.window) })
    }
    globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
    dom.window.scrollTo = () => {}
    dom.window.HTMLElement.prototype.scrollIntoView = () => {}
    const { createRoot } = await import('react-dom/client')
    vite = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
    const { default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx')
    ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
    api.defaults.baseURL = baseURL
    interceptor = api.interceptors.request.use((config) => { requests.push({ url: config.url, method: config.method, params: config.params }); return config })
    console.error = (...values) => { consoleErrors.push(values.map(String).join(' ')) }
    const main = () => document.querySelector('main')
    const text = () => main()?.textContent || ''
    const byLabel = (label) => { const element = document.querySelector(`[aria-label="${label}"]`); assert.ok(element, label); return element }
    const byText = (label) => { const element = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label); assert.ok(element, label); return element }
    const servings = () => Number(byLabel('Số người ăn').textContent.match(/\d+/)?.[0])
    const ingredientRow = (name) => byLabel(`Đã chuẩn bị ${name}`).closest('li')
    async function click(element) { assert.ok(element); await act(async () => element.click()) }
    async function waitFor(assertion) {
      let lastError
      for (let attempt = 0; attempt < 300; attempt += 1) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
        try { assertion(); return } catch (error) { lastError = error }
      }
      throw lastError
    }
    async function mount() {
      root = createRoot(document.getElementById('root'))
      await act(async () => root.render(React.createElement(App)))
    }
    await mount()
    await waitFor(() => assert.match(text(), /64 nguyên liệu để bạn lựa chọn/))
    for (const name of ['Trứng gà', 'Dầu ăn', 'Cà chua']) await click(byLabel(`Chọn ${name}`))
    const servingsSelect = main().querySelector('select')
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(servingsSelect, '4')
      servingsSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
    await click(byText('Tìm món ăn phù hợp'))
    await waitFor(() => assert.match(text(), /13 món phù hợp/))
    await click(document.querySelector('a[aria-label="Xem công thức Trứng chiên"]'))
    await waitFor(() => assert.equal(main().querySelector('h1')?.textContent, 'Trứng chiên'))
    const recipeId = Number(window.location.pathname.split('/').at(-1))
    let actualRecipe
    await act(async () => { actualRecipe = (await getJSON(`/recipes/${recipeId}`)).data })
    assert.equal(actualRecipe.recipeName, 'Trứng chiên')
    assert.equal(actualRecipe.servings, 2)
    assert.equal(servings(), 4)
    assert.match(ingredientRow('Trứng gà').textContent, /6 quả/)
    assert.match(ingredientRow('Dầu ăn').textContent, /30 ml/)
    assert.deepEqual([...main().querySelectorAll('input[aria-label^="Hoàn thành bước"]')].map((input) => input.getAttribute('aria-label')), actualRecipe.steps.map((step) => `Hoàn thành bước ${step.stepNumber}`))
    await waitFor(() => assert.ok(main().querySelectorAll('a[aria-label^="Xem công thức "]').length >= 3))
    assert.equal(main().querySelector('a[aria-label="Xem công thức Trứng chiên"]'), null)
    assert.equal(requests.some((request) => request.url === '/recipes' && request.params?.categoryId === actualRecipe.category.categoryId), true)
    await click(byLabel('Đã chuẩn bị Trứng gà'))
    await click(byLabel(`Hoàn thành bước ${actualRecipe.steps[0].stepNumber}`))
    await click(byText('Bắt đầu nấu'))
    assert.equal(byText('Bước trước').disabled, true)
    assert.match(text(), new RegExp(actualRecipe.steps[0].instruction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await click(byText('Bước tiếp theo'))
    await click(byText('Đánh dấu hoàn thành'))
    await click(byText('Thoát chế độ nấu'))
    await click(byLabel('Tăng số người ăn'))
    assert.equal(servings(), 5)
    assert.match(ingredientRow('Trứng gà').textContent, /7,5 quả/)
    const key = `smartcook:cooking:v1:${recipeId}`
    const beforeReload = JSON.parse(window.sessionStorage.getItem(key))
    assert.equal(beforeReload.servings, 5)
    assert.equal(beforeReload.preparedIds.length, 1)
    assert.equal(beforeReload.completedIds.length, 2)
    assert.equal(beforeReload.currentStepId, actualRecipe.steps[1].stepId)
    await act(async () => root.unmount())
    root = null
    await mount()
    await waitFor(() => assert.equal(main().querySelector('h1')?.textContent, 'Trứng chiên'))
    assert.equal(servings(), 5)
    assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, true)
    assert.equal(byLabel(`Hoàn thành bước ${actualRecipe.steps[0].stepNumber}`).checked, true)
    assert.equal(byLabel(`Hoàn thành bước ${actualRecipe.steps[1].stepNumber}`).checked, true)
    await click(byText('Bắt đầu nấu'))
    assert.equal(main().querySelector('h2').textContent, `Bước ${actualRecipe.steps[1].stepNumber}`)
    for (let index = 2; index < actualRecipe.steps.length; index += 1) {
      await click(byText('Bước tiếp theo'))
      await click(byText('Đánh dấu hoàn thành'))
    }
    assert.match(text(), /Chúc mừng/)
    assert.match(text(), /4\s*\/\s*4 bước đã hoàn thành\s*[–—-]\s*100%/)
    await click(byText('Xem toàn bộ công thức'))
    assert.equal([...main().querySelectorAll('input[aria-label^="Hoàn thành bước"]')].every((input) => input.checked), true)
    await click(byText('Làm lại từ đầu'))
    assert.equal(byLabel('Đã chuẩn bị Trứng gà').checked, false)
    assert.equal([...main().querySelectorAll('input[aria-label^="Hoàn thành bước"]')].every((input) => !input.checked), true)
    assert.match(text(), /0\s*\/\s*4 bước đã hoàn thành\s*[–—-]\s*0%/)
    assert.equal(requests.some((request) => request.url === `/recipes/${recipeId}`), true)
    assert.equal(requests.every((request) => request.method === 'get' || (request.method === 'post' && request.url === '/recipes/suggest')), true, 'Progress changes never write to SQL Server')
    assert.deepEqual(consoleErrors, [])
    console.log(`Live detail verified: recipeId=${recipeId}, ${actualRecipe.ingredients.length} ingredients, ${actualRecipe.steps.length} steps, suggestion servings4 → manual5 → restored5 → completed100% → reset0%`)
  } finally {
    if (root) await act(async () => root.unmount())
    if (api && interceptor !== undefined) api.interceptors.request.eject(interceptor)
    console.error = originalConsoleError
    await vite?.close()
    dom.window.close()
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
