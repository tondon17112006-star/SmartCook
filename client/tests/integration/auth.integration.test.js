import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { getPool, closePool, sql } from '../../../server/src/config/database.js'
import { getAuthConfig } from '../../../server/src/config/auth.js'
import { createAuthSecurity } from '../../../server/src/utilities/auth-security.js'
import { createUserRepository } from '../../../server/src/services/user.repository.js'
import { createAuthRouter } from '../../../server/src/routes/auth.routes.js'
import { createAdminRouter } from '../../../server/src/routes/admin.routes.js'
import { createFavoriteRouter } from '../../../server/src/routes/favorite.routes.js'
import { createFavoriteRepository } from '../../../server/src/services/favorite.repository.js'
import { createPublicReviewRouter, createReviewRouter } from '../../../server/src/routes/review.routes.js'
import { createReviewRepository } from '../../../server/src/services/review.repository.js'
import { apiRouter } from '../../../server/src/routes/api.routes.js'
import { errorHandler } from '../../../server/src/middlewares/error-handler.js'

const express = createRequire(new URL('../../../server/package.json', import.meta.url))('express')

// Real HTTP + SQL Server. The test transport holds cookies like a browser;
// jsdom does not verify actual browser cookie policy, visual layout or HTTPS.
test('live React register/login/profile/reload/logout/guards use real HTTP and SQL rollback', { timeout: 30000 }, async () => {
  const origin = 'http://127.0.0.1:5173'
  const config = getAuthConfig({ JWT_SECRET: randomBytes(48).toString('hex'), PASSWORD_PEPPER: randomBytes(48).toString('hex'), CLIENT_ORIGIN: origin })
  const email = `ui-${randomBytes(12).toString('hex')}@example.test`
  const password = `Cụm mật khẩu dài ${randomBytes(16).toString('hex')}`
  const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: `${origin}/profile`, pretendToBeVisual: true })
  const globals = new Map(), cookies = new Map(), calls = []
  const originalConsoleError = console.error
  const errors = []
  let transaction, server, vite, root, baseline
  let queryQueue = Promise.resolve()
  try {
    const pool = await getPool()
    baseline = (await pool.request().query('SELECT COUNT_BIG(*) AS total FROM dbo.Users;')).recordset[0].total
    transaction = new sql.Transaction(pool)
    await transaction.begin()
    const request = async () => {
      const query = new sql.Request(transaction)
      const execute = query.query.bind(query)
      // This rollback fixture has one ODBC connection. The production pool
      // supports concurrent requests; serialize only this test transaction.
      query.query = (...args) => {
        const result = queryQueue.then(() => execute(...args))
        queryQueue = result.catch(() => {})
        return result
      }
      return query
    }
    const repository = createUserRepository({ request })
    const security = createAuthSecurity({ config, repository })
    const app = express()
    app.use(express.json())
    app.use('/api/auth', createAuthRouter({ security }))
    app.use('/api/admin', createAdminRouter({ security }))
    app.use('/api/favorites', createFavoriteRouter({ security, repository: createFavoriteRepository({ request }) }))
    const reviewRepository = createReviewRepository({ request })
    app.use('/api/recipes', createPublicReviewRouter({ repository: reviewRepository }))
    app.use('/api', createReviewRouter({ security, repository: reviewRepository }))
    app.use('/api', apiRouter)
    app.use(errorHandler)
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const base = `http://127.0.0.1:${server.address().port}/api`
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'MouseEvent', 'PopStateEvent']) {
      globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
    }
    globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
    dom.window.scrollTo = () => {}
    dom.window.HTMLElement.prototype.scrollIntoView = () => {}
    const { createRoot } = await import('react-dom/client')
    vite = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
    const { default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx')
    const { api } = await vite.ssrLoadModule('/src/services/api.js')
    api.defaults.baseURL = base
    const http = axios.getAdapter('http')
    api.defaults.adapter = async (request) => {
      calls.push({ path: request.url, method: request.method })
      request.headers.set('Origin', origin)
      request.headers.set('Cookie', [...cookies].map(([key,value]) => `${key}=${value}`).join('; '))
      request.proxy = false
      const response = await http(request)
      for (const cookie of response.headers['set-cookie'] || []) {
        const [name, ...value] = cookie.split(';')[0].split('=')
        if (value.join('=')) cookies.set(name, value.join('=')); else cookies.delete(name)
      }
      return response
    }
    console.error = (...values) => errors.push(values.map(String).join(' '))
    const text = () => document.querySelector('main')?.textContent || ''
    const field = (name) => document.querySelector(`main input[name="${name}"]`)
    async function waitFor(check) {
      let failure
      for (let n = 0; n < 250; n += 1) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
        try { check(); return } catch (error) { failure = error }
      }
      throw failure
    }
    async function mount(path) {
      if (root) await act(async () => root.unmount())
      window.history.replaceState(null, '', path)
      root = createRoot(document.getElementById('root'))
      await act(async () => root.render(React.createElement(App)))
    }
    async function fill(name, value) {
      assert.ok(field(name), `Missing field ${name}`)
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(field(name), value)
        field(name).dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      })
    }
    async function submit() { await act(async () => document.querySelector('main form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }
    await mount('/profile')
    await waitFor(() => { assert.equal(window.location.pathname, '/login'); assert.ok(field('email')) })
    await act(async () => document.querySelector('main a[href="/register"]').click())
    await fill('fullName', 'Người thử giao diện')
    await fill('email', email)
    await fill('password', password)
    await fill('confirmPassword', password)
    await submit()
    await waitFor(() => assert.match(text(), /Đăng ký thành công/))
    assert.equal(cookies.has(config.cookieName), false)
    assert.equal(field('email').value, email)
    assert.equal(field('password').value, '')
    assert.equal((await repository.findByEmail(email)).role, 'User')
    await fill('password', password)
    await submit()
    await waitFor(() => { assert.equal(window.location.pathname, '/profile'); assert.ok(field('fullName')) })
    assert.ok(cookies.has(config.cookieName))
    await fill('fullName', 'Thông tin đã cập nhật')
    await fill('phone', '0912345678')
    await submit()
    await waitFor(() => assert.match(text(), /Đã cập nhật hồ sơ/))
    assert.equal((await repository.findByEmail(email)).phone, '0912345678')
    window.sessionStorage.setItem('smartcook:pantry:v1', '{"version":1,"ingredientIds":[64],"servings":2}')
    window.sessionStorage.setItem('smartcook:cooking:v1:8', '{"version":1,"servings":2}')
    const saved = { ...window.sessionStorage }
    await mount('/profile')
    await waitFor(() => assert.equal(field('fullName')?.value, 'Thông tin đã cập nhật'))
    assert.ok(calls.filter((call) => call.path === '/auth/me').length >= 2)
    await mount('/admin')
    await waitFor(() => assert.match(text(), /Khu vực dành cho quản trị viên/))
    assert.equal(calls.some((call) => call.path === '/admin/check'), false)
    // Admin now has an independent layout. A denied User returns to the public
    // profile before using that layout's existing Navbar logout action.
    await mount('/profile')
    await waitFor(() => assert.equal(field('fullName')?.value, 'Thông tin đã cập nhật'))
    const oldCookie = `${config.cookieName}=${cookies.get(config.cookieName)}`
    await act(async () => document.querySelector('header button[aria-label="Đăng xuất"]').click())
    await waitFor(() => assert.equal(window.location.pathname, '/'))
    assert.equal(cookies.has(config.cookieName), false)
    assert.equal((await fetch(`${base}/auth/me`, { headers: { Cookie: oldCookie } })).status, 401)
    assert.deepEqual({ ...window.sessionStorage }, saved)
    assert.equal(window.localStorage.length, 0)
    await mount('/profile')
    await waitFor(() => { assert.equal(window.location.pathname, '/login'); assert.ok(field('password')) })
    assert.equal(field('password').value, '')
    assert.deepEqual(errors, [], 'React renders without warnings or act errors')
  } finally {
    try {
      try {
        if (root) await act(async () => root.unmount())
      } finally {
        console.error = originalConsoleError
        try {
          await vite?.close()
        } finally {
          try {
            if (server) await new Promise((resolve) => server.close(resolve))
          } finally {
            try {
              await queryQueue
              if (transaction) await transaction.rollback()
            } finally {
              try {
                if (baseline !== undefined) {
                  const pool = await getPool()
                  const result = await pool.request().query('SELECT COUNT_BIG(*) AS total FROM dbo.Users;')
                  assert.equal(String(result.recordset[0].total), String(baseline), 'No persistent test account')
                }
              } finally { await closePool() }
            }
          }
        }
      }
    } finally {
      try {
        dom.window.close()
      } finally {
        // Restore the test process even when SQL rollback or verification fails.
        for (const [name, descriptor] of globals) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor)
          else delete globalThis[name]
        }
      }
    }
  }
})
