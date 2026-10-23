import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import React, { act } from 'react'
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { createAdminFixture } from '../../../server/tests/helpers/admin-fixture.js'

// Only the session DTO projects Admin in this fixture. All feature data and
// credentials run through HTTP and SQL; cleanup rolls the outer SQL tx back.
test('live React Admin dashboard and CRUD forms use SQL, preserve guards, and roll back all fixture rows', { timeout: 90000 }, async () => {
  const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/admin', pretendToBeVisual: true })
  const globals = new Map(), errors = [], calls = []
  const originalConsoleError = console.error
  let fixture, vite, root, cookies
  try {
    fixture = await createAdminFixture()
    cookies = fixture.admin.cookies
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'MouseEvent', 'PopStateEvent', 'KeyboardEvent']) {
      globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
    }
    globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
    window.scrollTo = () => {}
    dom.window.HTMLElement.prototype.scrollIntoView = () => {}
    const { createRoot } = await import('react-dom/client')
    vite = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
    const { default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx')
    const { api } = await vite.ssrLoadModule('/src/services/api.js')
    api.defaults.baseURL = `${fixture.base}/api`
    const transport = axios.getAdapter('http')
    api.defaults.adapter = async (request) => {
      calls.push({ url: request.url, method: request.method })
      const jar = cookies
      request.headers.set('Origin', fixture.origin)
      request.headers.set('Cookie', [...jar].map(([key, value]) => `${key}=${value}`).join('; '))
      request.proxy = false
      const response = await transport(request)
      for (const item of response.headers['set-cookie'] || []) {
        const [key, ...parts] = item.split(';')[0].split('='), value = parts.join('=')
        if (value) jar.set(key, value); else jar.delete(key)
      }
      return response
    }
    console.error = (...values) => errors.push(values.map(String).join(' '))
    const content = () => document.querySelector('main')?.textContent || ''
    const button = (text, within = document) => [...within.querySelectorAll('button')].find((node) => node.textContent.trim() === text)
    async function waitFor(check) {
      let last
      for (let index = 0; index < 400; index++) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
        try { check(); return } catch (error) { last = error }
      }
      throw last
    }
    async function click(element) { assert.ok(element, 'Expected an actionable Admin control'); await act(async () => element.click()) }
    async function sqlCall(action) {
      let result
      // HTTP oracles may resolve while the UI's reload is still in flight.
      // Keep those asynchronous React updates inside the test's act boundary.
      await act(async () => { result = await action() })
      return result
    }
    async function fill(name, value) {
      const scope = document.querySelector('[role="dialog"]') || document
      const field = scope.querySelector(`[name="${name}"]`)
      assert.ok(field, `Expected Admin field ${name}`)
      const prototype = field.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : field.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, String(value))
        field.dispatchEvent(new dom.window.Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
      })
    }
    async function submit(form) {
      assert.ok(form, 'Expected an Admin form')
      await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    }
    async function mount(path, jar = cookies) {
      if (root) await act(async () => root.unmount())
      cookies = jar
      window.history.replaceState(null, '', path)
      root = createRoot(document.getElementById('root'))
      await act(async () => root.render(React.createElement(App)))
    }
    async function menu(path) {
      await click(document.querySelector(`nav[aria-label="Menu quản trị"] a[href="${path}"]`))
      await waitFor(() => assert.equal(window.location.pathname, path))
    }
    const tag = `DOM SQL ${randomBytes(7).toString('hex')}`
    await mount('/admin')
    await waitFor(() => assert.match(content(), /Món ăn mới thêm/u))
    assert.ok(calls.some((call) => call.url === '/admin/dashboard'))
    assert.equal(Boolean(document.querySelector('footer')), false, 'Admin has a separate layout')

    await menu('/admin/categories')
    await waitFor(() => assert.ok(button('Thêm danh mục')))
    await click(button('Thêm danh mục'))
    await fill('categoryName', `${tag} danh mục`)
    await submit(document.querySelector('[role="dialog"] form'))
    await waitFor(() => { assert.equal(Boolean(document.querySelector('[role="dialog"]')), false); assert.match(content(), new RegExp(tag)) })
    const category = (await sqlCall(() => fixture.admin.send(`/api/admin/categories?search=${encodeURIComponent(tag)}`))).body.data[0]

    await menu('/admin/ingredients')
    await waitFor(() => assert.ok(button('Thêm nguyên liệu')))
    await click(button('Thêm nguyên liệu'))
    await fill('ingredientName', `${tag} nguyên liệu`)
    await fill('ingredientCategory', tag)
    await fill('defaultUnit', 'gam')
    await submit(document.querySelector('[role="dialog"] form'))
    await waitFor(() => assert.equal(Boolean(document.querySelector('[role="dialog"]')), false))
    const ingredient = (await sqlCall(() => fixture.admin.send(`/api/admin/ingredients?search=${encodeURIComponent(tag)}`))).body.data[0]
    assert.ok(ingredient)

    await menu('/admin/recipes')
    await waitFor(() => assert.ok(document.querySelector('a[href="/admin/recipes/new"]')))
    await click(document.querySelector('a[href="/admin/recipes/new"]'))
    await waitFor(() => assert.ok(document.querySelector('[name="recipeName"]')))
    await fill('recipeName', `${tag} món`)
    await fill('categoryId', category.categoryId)
    await fill('ingredients.0.ingredientId', ingredient.ingredientId)
    await fill('ingredients.0.quantity', '2.5')
    await fill('steps.0.instruction', 'Chuẩn bị và nấu chín.')
    await submit(document.querySelector('main form'))
    await waitFor(() => { assert.equal(window.location.pathname, '/admin/recipes'); assert.match(content(), /Đã lưu công thức thành công/u) })
    const createdRecipe = (await sqlCall(() => fixture.admin.send(`/api/admin/recipes?search=${encodeURIComponent(tag)}`))).body.data[0]
    const recipeId = createdRecipe.recipeId
    await click(document.querySelector(`a[href="/admin/recipes/${recipeId}/edit"]`))
    await waitFor(() => assert.equal(document.querySelector('[name="recipeName"]')?.value, `${tag} món`))
    await fill('recipeName', `${tag} món đã sửa`)
    await submit(document.querySelector('main form'))
    await waitFor(() => { assert.equal(window.location.pathname, '/admin/recipes'); assert.match(content(), /Đã lưu công thức thành công/u) })
    assert.equal((await sqlCall(() => fixture.guest.send(`/api/recipes/${recipeId}`))).body.data.recipeName, `${tag} món đã sửa`)

    const review = await sqlCall(() => fixture.ordinary.mutate(`/api/recipes/${recipeId}/reviews`, { rating: 3, comment: `${tag} bình luận` }))
    assert.equal(review.status, 201)
    await menu('/admin/reviews')
    await waitFor(() => assert.match(content(), new RegExp(`${tag} bình luận`)))
    const reviewRow = [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes(`${tag} bình luận`))
    await click(reviewRow.querySelector('button[aria-label^="Xóa"]'))
    await waitFor(() => assert.ok(document.querySelector('[role="dialog"]')))
    await click(button('Xác nhận xóa', document.querySelector('[role="dialog"]')))
    await waitFor(() => assert.equal(Boolean(document.querySelector('[role="dialog"]')), false))
    assert.equal((await sqlCall(() => fixture.guest.send(`/api/recipes/${recipeId}/reviews`))).body.summary.reviewCount, 0)

    await menu('/admin/users')
    await waitFor(() => assert.match(content(), new RegExp(fixture.ordinary.user.email.replaceAll('.', '\\.'))))
    assert.equal(Boolean(document.querySelector('input[name="role"]')), false)
    assert.doesNotMatch(content(), /PasswordHash/u)

    await menu('/admin/recipes')
    await waitFor(() => assert.match(content(), new RegExp(`${tag} món đã sửa`)))
    const recipeRow = [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes(`${tag} món đã sửa`))
    await click(recipeRow.querySelector('button[aria-label^="Xóa"]'))
    await click(button('Xác nhận xóa', document.querySelector('[role="dialog"]')))
    await waitFor(() => assert.equal(Boolean(document.querySelector('[role="dialog"]')), false))
    assert.equal((await sqlCall(() => fixture.guest.send(`/api/recipes/${recipeId}`))).status, 404)

    for (const [resource, text] of [['categories', `${tag} danh mục`], ['ingredients', `${tag} nguyên liệu`]]) {
      await menu(`/admin/${resource}`)
      // New ingredients may be beyond page1: searching uses the actual API.
      const search = document.querySelector('input[type="search"]')
      if (search) { await fill(search.name, tag); await submit(search.closest('form')) }
      await waitFor(() => assert.match(content(), new RegExp(text)))
      const row = [...document.querySelectorAll('tbody tr')].find((node) => node.textContent.includes(text))
      await click(row.querySelector('button[aria-label^="Xóa"]'))
      await click(button('Xác nhận xóa', document.querySelector('[role="dialog"]')))
      await waitFor(() => assert.equal(Boolean(document.querySelector('[role="dialog"]')), false))
    }
    assert.ok(calls.some((call) => call.url === '/auth/csrf'))
    assert.ok(calls.some((call) => call.url === '/admin/recipes' && call.method === 'post'))
    const oldCookies = new Map(fixture.admin.cookies)
    await click(button('Đăng xuất'))
    await waitFor(() => assert.equal(window.location.pathname, '/'))
    assert.equal((await sqlCall(() => fixture.admin.send('/api/admin/check', { cookies: oldCookies }))).status, 401)
    await mount('/admin', fixture.ordinary.cookies)
    await waitFor(() => assert.match(document.getElementById('root').textContent, /Khu vực dành cho quản trị viên/u))
    await mount('/admin', new Map())
    await waitFor(() => assert.equal(window.location.pathname, '/login'))
    assert.deepEqual(errors, [])
  } finally {
    if (root) await act(async () => root.unmount())
    console.error = originalConsoleError
    await vite?.close()
    dom.window.close()
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]
    }
    await fixture?.close()
  }
})
