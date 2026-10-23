import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Real app and Axios adapter against the running Backend/SQL Server.
// jsdom verifies DOM behavior, not browser layout or native keyboard behavior.
test('live ingredient selection → suggestions → filters/pagination/detail/reload uses SQL Server', { timeout: 20000 }, async () => {
  const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:5173/ingredients' })
  const globals = new Map()
  let vite, root, api, interceptor
  const originalConsoleError = console.error
  const consoleErrors = []
  const requests = []
  try {
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'IS_REACT_ACT_ENVIRONMENT']) {
      globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[name] })
    }
    dom.window.scrollTo = () => {}
    dom.window.HTMLElement.prototype.scrollIntoView = () => {}
    const { createRoot } = await import('react-dom/client')
    vite = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
    const { default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx')
    ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
    api.defaults.baseURL = process.env.SMARTCOOK_TEST_API_URL || 'http://127.0.0.1:5000/api'
    interceptor = api.interceptors.request.use((config) => {
      if (config.url === '/recipes/suggest') requests.push(structuredClone(config.data))
      return config
    })
    console.error = (...values) => { consoleErrors.push(values.map(String).join(' ')) }
    const main = () => document.querySelector('main')
    const text = () => main()?.textContent || ''
    const button = (label) => [...main().querySelectorAll('button')].find((item) => item.textContent.trim() === label)
    async function click(element) { assert.ok(element); await act(async () => element.click()) }
    async function waitFor(assertion) {
      let lastError
      for (let attempt = 0; attempt < 200; attempt += 1) {
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
    for (const name of ['Trứng gà', 'Dầu ăn', 'Cà chua']) await click(main().querySelector(`button[aria-label="Chọn ${name}"]`))
    const servings = main().querySelector('select')
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(servings, '4')
      servings.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
    const saved = JSON.parse(window.sessionStorage.getItem('smartcook:pantry:v1'))
    assert.equal(saved.ingredientIds.length, 3)
    assert.equal(saved.servings, 4)
    await click(button('Tìm món ăn phù hợp'))
    await waitFor(() => assert.match(text(), /13 món phù hợp/))
    assert.deepEqual(requests[0], { ingredientIds: [...saved.ingredientIds].sort((a, b) => a - b), servings: 4, page: 1, limit: 12 })
    assert.equal(main().querySelectorAll('article').length, 12)
    const first = main().querySelector('article')
    for (const pattern of [/Trứng chiên/, /100%/, /Đủ loại nguyên liệu chính/, /6 quả/, /30 ml/]) assert.match(first.textContent, pattern)
    await click(main().querySelector('button[aria-label="Trang sau"]'))
    await waitFor(() => assert.match(text(), /Trang 2 \/ 2/))
    assert.equal(main().querySelectorAll('article').length, 1)
    assert.equal(main().querySelector('button[aria-label="Trang sau"]').disabled, true)
    await click(main().querySelector('input[value="ready"]'))
    await waitFor(() => assert.match(text(), /2 món đủ loại nguyên liệu bắt buộc/))
    assert.match(text(), /Đã lọc trên toàn bộ 13 món phù hợp/)
    assert.equal(main().querySelectorAll('article').length, 2)
    const requestsAfterReady = requests.length
    await click(main().querySelector('input[value="missing"]'))
    assert.match(text(), /11 món còn thiếu nguyên liệu/)
    assert.equal(main().querySelectorAll('article').length, 11)
    assert.equal(requests.length, requestsAfterReady)
    await click(main().querySelector('input[value="ready"]'))
    const detailLink = main().querySelector('article h3 a')
    const expectedName = detailLink.textContent
    await click(detailLink)
    await waitFor(() => assert.equal(main().querySelector('h1').textContent, expectedName))
    assert.ok(main().querySelector('ol li'))
    await act(async () => root.unmount())
    root = null
    window.history.replaceState(null, '', '/suggestions')
    await mount()
    await waitFor(() => assert.match(text(), /13 món phù hợp/))
    assert.match(text(), /Định lượng cho 4 người ăn/)
    assert.deepEqual(JSON.parse(window.sessionStorage.getItem('smartcook:pantry:v1')), saved)
    await click(document.querySelector('header a[aria-label="SmartCook — Trang chủ"]'))
    await waitFor(() => {
      assert.match(main().querySelector('h1').textContent, /Hôm nay bạn muốn nấu món gì\?/)
      assert.equal(main().querySelectorAll('article').length, 8)
      assert.equal(main().querySelectorAll('a[aria-label^="Khám phá danh mục "]').length, 8)
    })
    await click(main().querySelector('a[href="/recipes"]'))
    await waitFor(() => {
      assert.match(text(), /20 công thức/)
      assert.equal(main().querySelectorAll('article').length, 12)
    })
    assert.deepEqual(consoleErrors, [])
    console.log(`Live DOM verified: ingredients=${saved.ingredientIds.join(',')}, servings=4, total=13, ready=2, missing=11`)
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
