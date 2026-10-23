import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { createPersonalFixture } from '../../../server/tests/helpers/personal-fixture.js'
import { createFavoriteRouter } from '../../../server/src/routes/favorite.routes.js'
import { createFavoriteRepository } from '../../../server/src/services/favorite.repository.js'
import { createPublicReviewRouter, createReviewRouter } from '../../../server/src/routes/review.routes.js'
import { createReviewRepository } from '../../../server/src/services/review.repository.js'
import { createPantryRouter } from '../../../server/src/routes/pantry.routes.js'
import { createPantryRepository } from '../../../server/src/services/pantry.repository.js'
import { apiRouter } from '../../../server/src/routes/api.routes.js'

// React, the production API clients and HTTP routes all run against SQL Server.
// Only the test transport supplies a cookie jar; browser cookie/visual policy is
// outside jsdom's scope. Every personal row is isolated in a rollback transaction.
test('live React favorites, reviews and pantry persist in SQL and isolate accounts', { timeout: 90000 }, async () => {
  const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/recipes', pretendToBeVisual: true,
  })
  const globals = new Map()
  const calls = []
  const errors = []
  const originalConsoleError = console.error
  let fixture, vite, root, cookies
  try {
    fixture = await createPersonalFixture({ routers: ({ app, security, request }) => {
      app.use('/api/favorites', createFavoriteRouter({ security, repository: createFavoriteRepository({ request }) }))
      const reviews = createReviewRepository({ request })
      app.use('/api/recipes', createPublicReviewRouter({ repository: reviews }))
      app.use('/api', createReviewRouter({ security, repository: reviews }))
      app.use('/api/pantry', createPantryRouter({ security, repository: createPantryRepository({ request }) }))
      app.use('/api', apiRouter)
    } })
    cookies = fixture.userA.cookies
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'MouseEvent', 'PopStateEvent']) {
      globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
    }
    globals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
    dom.window.scrollTo = () => {}
    dom.window.HTMLElement.prototype.scrollIntoView = () => {}
    const { createRoot } = await import('react-dom/client')
    vite = await createServer({
      root: fileURLToPath(new URL('../../', import.meta.url)), appType: 'custom',
      server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error',
    })
    const { default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx')
    const { api } = await vite.ssrLoadModule('/src/services/api.js')
    api.defaults.baseURL = `${fixture.base}/api`
    const http = axios.getAdapter('http')
    api.defaults.adapter = async (request) => {
      calls.push({ path: request.url, method: request.method,
        ...(request.url === '/recipes/suggest' ? { body: typeof request.data === 'string' ? JSON.parse(request.data) : request.data } : {}),
      })
      const requestCookies = cookies
      request.headers.set('Origin', fixture.origin)
      request.headers.set('Cookie', [...requestCookies].map(([name, value]) => `${name}=${value}`).join('; '))
      request.proxy = false
      const response = await http(request)
      for (const cookie of response.headers['set-cookie'] || []) {
        const [name, ...parts] = cookie.split(';')[0].split('=')
        const value = parts.join('=')
        if (value) requestCookies.set(name, value)
        else requestCookies.delete(name)
      }
      return response
    }
    console.error = (...values) => errors.push(values.map(String).join(' '))
    const mainText = () => document.querySelector('main')?.textContent || ''
    const favoriteButtons = () => [...document.querySelectorAll('main button[aria-pressed][aria-label]')]
      .filter((button) => /^(?:Yêu thích|Bỏ yêu thích) /u.test(button.getAttribute('aria-label')))
    const namedHeart = (name) => favoriteButtons().find((button) => button.getAttribute('aria-label') === `Bỏ yêu thích ${name}`
      || button.getAttribute('aria-label') === `Yêu thích ${name}`)
    async function waitFor(check) {
      let failure
      for (let index = 0; index < 400; index += 1) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
        try { check(); return } catch (error) { failure = error }
      }
      throw failure
    }
    async function mount(path, jar = cookies) {
      if (root) await act(async () => root.unmount())
      cookies = jar
      window.history.replaceState(null, '', path)
      root = createRoot(document.getElementById('root'))
      await act(async () => root.render(React.createElement(App)))
    }
    async function click(element) {
      assert.ok(element, 'Expected a visible action in the rendered App')
      await act(async () => element.click())
    }
    async function fillComment(value) {
      const field = document.querySelector('main textarea[name="comment"]')
      assert.ok(field, 'The review form must be available')
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(field, value)
        field.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      })
    }
    async function fillInput(field, value) {
      assert.ok(field, 'The pantry field must be visible')
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(field, value)
        field.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      })
    }
    async function submitForm(form) {
      assert.ok(form, 'The pantry form must be visible')
      await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    }
    async function chooseSelect(field, value) {
      assert.ok(field, 'The pantry selection must be visible')
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(field, String(value))
        field.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      })
    }
    async function submitReview() {
      const form = document.querySelector('main textarea[name="comment"]')?.closest('form')
      assert.ok(form)
      await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    }
    const textButton = (label) => [...document.querySelectorAll('main button')].find((button) => button.textContent === label)
    const favoriteWrites = () => calls.filter(({ path, method }) => path === '/favorites' && method === 'post').length

    await mount('/recipes')
    await waitFor(() => {
      assert.ok(favoriteButtons().length > 0)
      assert.equal(favoriteButtons()[0].disabled, false)
      assert.equal(favoriteButtons()[0].getAttribute('aria-pressed'), 'false')
    })
    const firstHeart = favoriteButtons()[0]
    const recipeName = firstHeart.getAttribute('aria-label').slice('Yêu thích '.length)
    const recipePath = firstHeart.closest('article').querySelector('a[href^="/recipes/"]').getAttribute('href')
    const recipeId = Number(recipePath.split('/').at(-1))
    const initialWrites = favoriteWrites()
    await act(async () => { firstHeart.click(); firstHeart.click() })
    await waitFor(() => assert.equal(namedHeart(recipeName)?.getAttribute('aria-pressed'), 'true'))
    assert.equal(favoriteWrites() - initialWrites, 1, 'A repeated click produces a single actual write')
    assert.deepEqual((await fixture.userA.send('/api/favorites/ids')).body.data, [recipeId])
    assert.deepEqual((await fixture.userB.send('/api/favorites/ids')).body.data, [])

    await click(document.querySelector('header nav[aria-label="Điều hướng chính"] a[href="/favorites"]'))
    await waitFor(() => {
      assert.equal(window.location.pathname, '/favorites')
      assert.match(mainText(), /Món ăn yêu thích/u)
      assert.equal(namedHeart(recipeName)?.getAttribute('aria-pressed'), 'true')
    })
    await click(document.querySelector(`main a[href="${recipePath}"]`))
    await waitFor(() => {
      assert.equal(window.location.pathname, recipePath)
      assert.equal(document.querySelector('main h1')?.textContent, recipeName)
      assert.equal(namedHeart(recipeName)?.getAttribute('aria-pressed'), 'true')
      assert.ok(document.querySelector('main textarea[name="comment"]'))
      assert.match(mainText(), /Chưa có đánh giá nào/u)
    })
    await click(document.querySelector('main input[aria-label="5 sao"]'))
    await fillComment('Món ăn rất vừa miệng và dễ làm.')
    await submitReview()
    await waitFor(() => {
      assert.ok(textButton('Chỉnh sửa đánh giá'))
      assert.match(mainText(), /1 lượt đánh giá/u)
    })
    const mine = (await fixture.userA.send(`/api/recipes/${recipeId}/reviews/mine`)).body.data
    assert.equal(mine.rating, 5)
    assert.equal(mine.comment, 'Món ăn rất vừa miệng và dễ làm.')
    assert.equal((await fixture.userB.send(`/api/recipes/${recipeId}/reviews/mine`)).body.data, null)
    await click(textButton('Chỉnh sửa đánh giá'))
    await click(document.querySelector('main input[aria-label="3 sao"]'))
    await fillComment('Đậm đà sau khi điều chỉnh.')
    await submitReview()
    await waitFor(() => {
      assert.ok(textButton('Chỉnh sửa đánh giá'))
      assert.match(mainText(), /3\/5/u)
      assert.match(mainText(), /Đậm đà sau khi điều chỉnh\./u)
    })
    const summary = (await fixture.send(`/api/recipes/${recipeId}/reviews`)).body.summary
    assert.equal(summary.averageRating, 3)
    assert.equal(summary.reviewCount, 1)
    const reviewDeletesBeforeConfirm = calls.filter(({ path, method }) => path === `/reviews/${mine.reviewId}` && method === 'delete').length
    await click(textButton('Xóa đánh giá'))
    assert.ok(document.querySelector('main [role="group"][aria-label="Xác nhận xóa đánh giá"]'))
    assert.equal(calls.filter(({ path, method }) => path === `/reviews/${mine.reviewId}` && method === 'delete').length, reviewDeletesBeforeConfirm)
    await click(textButton('Xác nhận xóa'))
    await waitFor(() => {
      assert.match(mainText(), /Chưa có đánh giá nào/u)
      assert.ok(document.querySelector('main textarea[name="comment"]'))
    })
    assert.equal((await fixture.userA.send(`/api/recipes/${recipeId}/reviews/mine`)).body.data, null)
    await mount('/favorites')
    await waitFor(() => assert.equal(namedHeart(recipeName)?.getAttribute('aria-pressed'), 'true'))
    const deletesBeforeConfirm = calls.filter(({ method }) => method === 'delete').length
    await click(namedHeart(recipeName))
    const confirmation = document.querySelector('main [role="group"][aria-label^="Xác nhận bỏ yêu thích"]')
    assert.ok(confirmation)
    assert.equal(calls.filter(({ method }) => method === 'delete').length, deletesBeforeConfirm)
    await click([...confirmation.querySelectorAll('button')].find((button) => button.textContent === 'Bỏ yêu thích'))
    await waitFor(() => assert.match(mainText(), /Bạn chưa lưu món ăn nào/u))
    assert.deepEqual((await fixture.userA.send('/api/favorites/ids')).body.data, [])

    // A fresh read verifies persistence and account ownership through actual SQL.
    assert.equal((await fixture.userA.mutate('/api/favorites', { recipeId })).status, 201)
    await mount('/favorites', fixture.userA.cookies)
    await waitFor(() => assert.equal(namedHeart(recipeName)?.getAttribute('aria-pressed'), 'true'))
    await mount('/favorites', fixture.userB.cookies)
    await waitFor(() => assert.match(mainText(), /Bạn chưa lưu món ăn nào/u))
    assert.equal(namedHeart(recipeName), undefined)

    // Drive SQL-backed pantry edits through the actual page, with catalog IDs
    // resolved from production APIs rather than relying on identity values.
    const ingredientsBefore = (await fixture.send('/api/ingredients?limit=100')).body.data
    const namedIngredients = new Map(ingredientsBefore.map((ingredient) => [ingredient.ingredientName, ingredient]))
    const selectedNames = ['Trứng gà', 'Dầu ăn', 'Cà chua']
    const selectedIds = selectedNames.map((name) => {
      assert.ok(namedIngredients.has(name), `The SQL ingredient catalog must contain ${name}`)
      return namedIngredients.get(name).ingredientId
    })
    const expiredIngredient = ingredientsBefore.find((ingredient) => !selectedIds.includes(ingredient.ingredientId))
    assert.ok(expiredIngredient)
    const dateParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const todayParts = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]))
    const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`
    const offsetDate = (offset) => {
      const date = new Date(`${today}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      return date.toISOString().slice(0, 10)
    }
    const soon = offsetDate(2), fresh = offsetDate(7), expired = offsetDate(-1)
    const pantryForm = (editing = false) => document.querySelector(`main form[aria-label="${editing ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}"]`)
    const pantryRow = (name) => [...document.querySelectorAll('main article')].find((article) => article.querySelector('h2')?.textContent === name)
    const namedAction = (label) => [...document.querySelectorAll('main button[aria-label]')].find((button) => button.getAttribute('aria-label') === label)
    async function addPantryIngredient(name, { quantity = '', unit = '', expiryDate = '' } = {}) {
      const form = pantryForm()
      assert.ok(form)
      await fillInput(form.elements.ingredientSearch, name)
      const options = [...form.elements.ingredientId.options].filter((option) => option.value)
      assert.equal(options.length, 1, 'Searching the real catalog narrows the ingredient selection')
      await chooseSelect(form.elements.ingredientId, namedIngredients.get(name).ingredientId)
      await fillInput(form.elements.quantity, quantity)
      await fillInput(form.elements.unit, unit)
      await fillInput(form.elements.expiryDate, expiryDate)
      await submitForm(form)
      await waitFor(() => {
        assert.ok(pantryRow(name), 'The saved pantry row must appear')
        assert.match(mainText(), /Đã thêm nguyên liệu vào tủ\./u)
        assert.equal(pantryForm()?.querySelector('button[type="submit"]')?.disabled, false)
      })
    }
    await mount('/pantry', fixture.userA.cookies)
    await waitFor(() => {
      assert.match(mainText(), /Tủ nguyên liệu đang trống/u)
      assert.ok(pantryForm())
    })
    await addPantryIngredient('Trứng gà', { quantity: '1', unit: 'quả', expiryDate: soon })
    assert.match(pantryRow('Trứng gà').textContent, /Sắp hết hạn/u)
    await addPantryIngredient('Dầu ăn')
    assert.match(pantryRow('Dầu ăn').textContent, /Chưa ghi hạn sử dụng/u)
    await addPantryIngredient('Cà chua', { quantity: '1', unit: 'g', expiryDate: fresh })
    await addPantryIngredient(expiredIngredient.ingredientName, { quantity: '30', unit: expiredIngredient.defaultUnit, expiryDate: expired })
    assert.match(pantryRow(expiredIngredient.ingredientName).textContent, /Đã hết hạn/u)
    await click(namedAction('Sửa Trứng gà'))
    const editing = pantryForm(true)
    assert.equal(editing.elements.quantity.value, '1')
    await fillInput(editing.elements.quantity, '1.25')
    await fillInput(editing.elements.unit, 'kg')
    await fillInput(editing.elements.expiryDate, fresh)
    await submitForm(editing)
    await waitFor(() => {
      assert.match(mainText(), /Đã cập nhật nguyên liệu\./u)
      assert.match(pantryRow('Trứng gà').textContent, /1,25 kg/u)
      assert.match(pantryRow('Trứng gà').textContent, /Còn hạn/u)
    })
    const persisted = (await fixture.userA.send('/api/pantry?limit=100')).body.data
    const eggPantry = persisted.find((item) => item.ingredientId === selectedIds[0])
    assert.deepEqual([eggPantry.quantity, eggPantry.unit, eggPantry.expiryDate], [1.25, 'kg', fresh], 'SQL stores the explicit unit without guessing a conversion')
    assert.equal(persisted.find((item) => item.ingredientId === selectedIds[1]).expiryDate, null)
    assert.equal((await fixture.userB.send('/api/pantry')).body.data.length, 0)
    await mount('/pantry', fixture.userA.cookies)
    await waitFor(() => {
      assert.match(pantryRow('Trứng gà')?.textContent || '', /1,25 kg/u)
      assert.ok(pantryForm())
    })
    await mount('/pantry', fixture.userB.cookies)
    await waitFor(() => assert.match(mainText(), /Tủ nguyên liệu đang trống/u))
    assert.equal(pantryRow('Trứng gà'), undefined)

    // Existing selection controls choose servings. Pantry replaces only IDs;
    // expired rows are omitted, while an unknown expiry remains eligible.
    await mount('/ingredients', fixture.userA.cookies)
    await waitFor(() => assert.ok(document.querySelector('main select')))
    await chooseSelect(document.querySelector('main select'), 4)
    const pantryLink = document.querySelector('header a[href="/pantry"]')
    assert.ok(pantryLink, 'The account navigation exposes the personal pantry')
    await click(pantryLink)
    await waitFor(() => {
      assert.equal(window.location.pathname, '/pantry')
      assert.ok(pantryRow('Trứng gà'))
      assert.equal(textButton('Nấu ăn từ tủ nguyên liệu')?.disabled, false)
      assert.match(mainText(), /Tìm món cho 4 người/u)
    })
    const suggestionsBefore = calls.filter(({ path }) => path === '/recipes/suggest').length
    await click(textButton('Nấu ăn từ tủ nguyên liệu'))
    await waitFor(() => {
      assert.equal(window.location.pathname, '/suggestions')
      assert.match(mainText(), /13 món phù hợp/u)
      assert.match(mainText(), /Định lượng cho 4 người ăn/u)
      assert.match(mainText(), /Bạn vẫn cần kiểm tra lượng thực tế/u)
    })
    const pantrySuggestions = calls.filter(({ path }) => path === '/recipes/suggest').slice(suggestionsBefore)
    assert.ok(pantrySuggestions.length > 0)
    for (const { body } of pantrySuggestions) {
      assert.deepEqual([...body.ingredientIds].sort((first, second) => first - second), [...selectedIds].sort((first, second) => first - second))
      assert.equal(body.servings, 4)
      assert.equal(body.ingredientIds.includes(expiredIngredient.ingredientId), false)
    }
    const summaryNames = [...document.querySelectorAll('ul[aria-label="Nguyên liệu đã chọn"] li')].map((item) => item.textContent)
    assert.deepEqual(summaryNames.sort(), [...selectedNames].sort())
    assert.equal(pantrySuggestions[0].body.ingredientIds.includes(selectedIds[1]), true, 'A pantry ingredient without an expiry is used')
    await click(document.querySelector('header a[href="/pantry"]'))
    await waitFor(() => assert.ok(pantryRow(expiredIngredient.ingredientName)))
    const pantryDeletesBeforeConfirm = calls.filter(({ path, method }) => path.startsWith('/pantry/') && method === 'delete').length
    await click(namedAction(`Xóa ${expiredIngredient.ingredientName}`))
    const pantryConfirmation = document.querySelector('main [role="group"][aria-label^="Xác nhận xóa"]')
    assert.ok(pantryConfirmation)
    assert.equal(calls.filter(({ path, method }) => path.startsWith('/pantry/') && method === 'delete').length, pantryDeletesBeforeConfirm)
    await click([...pantryConfirmation.querySelectorAll('button')].find((button) => button.textContent === 'Xác nhận xóa'))
    await waitFor(() => {
      assert.equal(pantryRow(expiredIngredient.ingredientName), undefined)
      assert.match(mainText(), /Đã xóa nguyên liệu khỏi tủ\./u)
    })
    assert.equal((await fixture.userA.send('/api/pantry')).body.data.length, 3)
    assert.deepEqual((await fixture.send('/api/ingredients?limit=100')).body.data, ingredientsBefore, 'Personal pantry deletion never changes the shared ingredient catalog')

    await mount('/recipes?page=1', new Map())
    await waitFor(() => {
      assert.ok(favoriteButtons().length > 0)
      assert.equal(favoriteButtons()[0].disabled, false)
      assert.ok(document.querySelector('header a[href="/login"]'))
    })
    const writesBeforeGuest = favoriteWrites()
    const guestReturnPath = `${window.location.pathname}${window.location.search}`
    await click(favoriteButtons()[0])
    await waitFor(() => assert.equal(window.location.pathname, '/login'))
    assert.equal(window.history.state?.usr?.from, guestReturnPath)
    assert.equal(favoriteWrites(), writesBeforeGuest, 'Guest navigation never creates a favorite')
    const xss = '<img src=x onerror="window.__reviewXss = 1"><script>window.__reviewXss = 2</script>'
    assert.equal((await fixture.userB.mutate(`/api/recipes/${recipeId}/reviews`, { rating: 4, comment: xss })).status, 201)
    await mount(recipePath, new Map())
    await waitFor(() => {
      assert.match(mainText(), /Đăng nhập để đánh giá/u)
      assert.ok(mainText().includes(xss), 'Review HTML is displayed as text')
    })
    const reviewSection = document.querySelector(`section[aria-labelledby="recipe-reviews-${recipeId}"]`)
    assert.equal(reviewSection.querySelector('img, script'), null)
    assert.equal(window.__reviewXss, undefined)
    assert.equal(reviewSection.textContent.includes(fixture.userA.user.email), false)
    assert.equal(reviewSection.textContent.includes(fixture.userB.user.email), false)
    assert.equal(document.querySelector('main textarea[name="comment"]'), null)
    assert.equal(window.localStorage.length, 0)
    assert.deepEqual(errors, [], 'React renders without warnings or act errors')
  } finally {
    try {
      try { if (root) await act(async () => root.unmount()) }
      finally {
        console.error = originalConsoleError
        try { await vite?.close() }
        finally { await fixture?.close() }
      }
    } finally {
      dom.window.close()
      for (const [name, descriptor] of globals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete globalThis[name]
      }
    }
  }
})
