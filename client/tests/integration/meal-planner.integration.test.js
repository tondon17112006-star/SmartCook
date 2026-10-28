import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import React, { act } from 'react'
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { createMealPlanFixture } from '../../../server/tests/helpers/meal-plan-fixture.js'

// Real App, Axios, Express authentication and SQL. Only the test transport owns
// a cookie jar; it does not simulate browser cookie or visual layout policies.
// Users and every private fixture row stay inside an outer rollback transaction.
test('live Meal Planner React→HTTP→SQL persists weeks, scales shopping and cooking, isolates users and preserves Pantry', { timeout: 90000 }, async () => {
  const week = '2026-10-26', nextWeek = '2026-11-02'
  const path = (date = week) => `/meal-planner?weekStart=${date}`
  const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: `http://localhost:5173${path()}`, pretendToBeVisual: true })
  const globals = new Map(), errors = [], calls = []
  const originalConsoleError = console.error
  let fixture, vite, root, cookies, owner
  try {
    fixture = await createMealPlanFixture()
    owner = fixture.createClient()
    const credentials = { email: `planner-ui-${randomBytes(12).toString('hex')}@example.test`, password: randomBytes(36).toString('base64url') }
    assert.equal((await owner.register({ fullName: 'Người thử lịch tuần', ...credentials })).status, 201)
    cookies = owner.cookies
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PopStateEvent']) {
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
    vite = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
    const { default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx')
    const { api } = await vite.ssrLoadModule('/src/services/api.js')
    api.defaults.baseURL = `${fixture.base}/api`
    const transport = axios.getAdapter('http')
    api.defaults.adapter = async (request) => {
      calls.push({ path: request.url, method: request.method, params: request.params })
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
    const main = () => document.querySelector('main')
    const content = () => main()?.textContent || ''
    const dialog = () => document.querySelector('[role="dialog"]')
    const button = (label, scope = document) => [...scope.querySelectorAll('button')].find((node) => node.textContent.trim() === label || node.getAttribute('aria-label') === label)
    const mealCard = () => [...main().querySelectorAll('article')].find((node) => node.querySelector('a')?.textContent === 'Trứng chiên')
    const shoppingRow = (name) => [...document.querySelectorAll('#shopping-list li')].find((node) => node.querySelector('label > span > span')?.textContent === name)
    const servings = () => Number(document.querySelector('output[aria-label="Số người ăn"]')?.textContent.match(/\d+/u)?.[0])
    async function waitFor(check) {
      let last
      for (let attempt = 0; attempt < 400; attempt++) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
        try { check(); return } catch (error) { last = error }
      }
      throw last
    }
    async function click(element) { assert.ok(element, 'Expected an actionable Meal Planner control'); await act(async () => element.click()) }
    async function sqlCall(action) { let result; await act(async () => { result = await action() }); return result }
    async function change(name, value) {
      const field = (dialog() || document).querySelector(`[name="${name}"]`)
      assert.ok(field, `Expected field ${name}`)
      const prototype = field.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, String(value))
        field.dispatchEvent(new dom.window.Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
      })
    }
    async function submitMeal() {
      const form = dialog()?.querySelector('[name="mealDate"]')?.closest('form')
      assert.ok(form, 'The meal form is visible')
      await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    }
    async function addRecipe(name, mealType, servings, date = week) {
      await click(button('Thêm món vào lịch'))
      await waitFor(() => assert.ok(dialog()?.querySelector('[name="search"]')))
      await change('search', name)
      await act(async () => dialog().querySelector('[name="search"]').closest('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
      let selection
      await waitFor(() => {
        selection = [...dialog().querySelectorAll('[aria-label="Chọn công thức"] button')].find((node) => node.textContent.includes(name))
        assert.ok(selection)
      })
      await click(selection)
      await change('mealDate', date); await change('mealType', mealType); await change('servings', servings)
      await submitMeal()
    }
    async function mount(location, jar = cookies) {
      if (root) await act(async () => root.unmount())
      cookies = jar
      window.history.replaceState(null, '', location)
      root = createRoot(document.getElementById('root'))
      await act(async () => root.render(React.createElement(App)))
    }
    const mealReads = () => calls.filter((call) => call.path === '/meal-plans').length
    await mount(path(), owner.cookies)
    await waitFor(() => assert.equal(window.location.pathname, '/login'))
    assert.equal(mealReads(), 0, 'A guest guard does not request private meal data')
    await change('email', credentials.email); await change('password', credentials.password)
    await act(async () => document.querySelector('main form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    await waitFor(() => { assert.equal(window.location.pathname, '/meal-planner'); assert.match(content(), /Bạn chưa lên lịch nấu ăn cho tuần này/u) })
    assert.ok(cookies.has(fixture.config.cookieName), 'UI login sets a real authenticated session cookie')

    await mount('/pantry', owner.cookies)
    await waitFor(() => { assert.equal(window.location.pathname, '/meal-planner'); assert.match(content(), /Lịch nấu ăn của tôi/u) })
    const navbar = document.querySelector('header nav[aria-label="Điều hướng chính"]')
    assert.ok(navbar?.querySelector('a[href="/meal-planner"]'))
    assert.match(navbar.querySelector('a[href="/meal-planner"]').textContent, /Lịch nấu ăn/u)
    assert.equal(Boolean(document.querySelector('header a[href="/pantry"]')), false, 'The main Navbar replaces Pantry with Meal Planner')
    await mount(path(), owner.cookies)
    await waitFor(() => assert.match(content(), /Bạn chưa lên lịch nấu ăn cho tuần này/u))
    assert.equal(document.querySelectorAll('section[aria-label^="Sáng ngày"]').length, 7)
    assert.equal(document.querySelectorAll('section[aria-label^="Trưa ngày"]').length, 7)
    assert.equal(document.querySelectorAll('section[aria-label^="Tối ngày"]').length, 7)
    const found = await sqlCall(() => fixture.guest.send(`/api/recipes?search=${encodeURIComponent('Trứng chiên')}`))
    const recipe = found.body.data.find((row) => row.recipeName === 'Trứng chiên')
    assert.ok(recipe)
    const detail = (await sqlCall(() => fixture.guest.send(`/api/recipes/${recipe.recipeId}`))).body.data
    assert.equal(detail.servings, 2)
    const egg = detail.ingredients.find((row) => row.ingredientName === 'Trứng gà')
    assert.ok(egg)
    // A huge quantity in the legacy Pantry must never reduce the shopping sum.
    assert.equal((await sqlCall(() => owner.mutate('/api/pantry', { ingredientId: egg.ingredientId, quantity: 999, unit: 'quả' }))).status, 201)
    assert.equal((await sqlCall(() => owner.mutate('/api/favorites', { recipeId: recipe.recipeId }))).status, 201)

    await click(button('Thêm món vào lịch'))
    await click(button('Món yêu thích', dialog()))
    await waitFor(() => assert.ok(button('Trứng chiên', dialog()) || dialog().querySelector('[aria-label="Chọn công thức"] button')))
    const selection = [...dialog().querySelectorAll('[aria-label="Chọn công thức"] button')].find((node) => node.textContent.includes('Trứng chiên'))
    await click(selection)
    await change('mealDate', week)
    await change('mealType', 'Lunch')
    await change('servings', '4')
    await submitMeal()
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.ok(mealCard()); assert.match(shoppingRow('Trứng gà')?.textContent || '', /6 quả/u) })
    let actual = (await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${week}`))).body.data
    assert.equal(actual.summary.itemCount, 1)
    const item = actual.days[0].meals.Lunch[0]
    assert.equal(item.recipeId, recipe.recipeId); assert.equal(item.servings, 4)
    let shopping = (await sqlCall(() => owner.send(`/api/meal-plans/shopping-list?weekStart=${week}`))).body.data.items
    assert.equal(shopping.find((row) => row.ingredientId === egg.ingredientId).totalQuantity, '6')

    // Exercise Breakfast and two different recipes in one Lunch through React,
    // then return to the original single-item state for Cooking Mode regression.
    await addRecipe('Trứng chiên', 'Breakfast', '2')
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.match(shoppingRow('Trứng gà')?.textContent || '', /9 quả/u) })
    await addRecipe('Rau muống xào tỏi', 'Lunch', '3')
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.match(shoppingRow('Rau muống')?.textContent || '', /500 g/u) })
    actual = (await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${week}`))).body.data
    assert.equal(actual.days[0].meals.Breakfast.length, 1)
    assert.equal(actual.days[0].meals.Lunch.length, 2)
    assert.equal(document.querySelector('section[aria-label="Trưa ngày 26/10/2026"]').querySelectorAll('article').length, 2)
    assert.match(shoppingRow('Dầu ăn').textContent, /70 ml/u)

    // The actual SQL duplicate is a 409: keep the draft and never announce a
    // successful insert. The server week and UI retain the same three items.
    await addRecipe('Trứng chiên', 'Lunch', '7')
    await waitFor(() => assert.match(dialog()?.textContent || '', /Món ăn đã có trong bữa này/u))
    assert.equal(dialog().querySelector('[name="servings"]').value, '7')
    assert.doesNotMatch(content(), /Đã thêm món vào lịch nấu ăn/u)
    assert.equal((await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${week}`))).body.data.summary.itemCount, 3)
    await click(button('Hủy', dialog()))

    await click(button('Sửa Rau muống xào tỏi ngày 26/10/2026'))
    await change('mealDate', nextWeek); await change('mealType', 'Dinner'); await change('servings', '6')
    await submitMeal()
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.equal(Boolean(shoppingRow('Rau muống')), false); assert.match(shoppingRow('Dầu ăn')?.textContent || '', /45 ml/u) })
    actual = (await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${nextWeek}`))).body.data
    assert.equal(actual.days[0].meals.Dinner[0].recipeName, 'Rau muống xào tỏi')
    assert.equal(actual.days[0].meals.Dinner[0].servings, 6)
    await click(button('Tuần sau'))
    await waitFor(() => assert.match(shoppingRow('Rau muống')?.textContent || '', /1[.\s]?000 g/u))
    await mount(path(nextWeek))
    await waitFor(() => assert.ok(button('Xóa Rau muống xào tỏi ngày 02/11/2026')))
    await click(button('Xóa Rau muống xào tỏi ngày 02/11/2026')); await click(button('Xác nhận xóa', dialog()))
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.match(content(), /Danh sách đi chợ đang trống/u) })
    assert.equal((await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${nextWeek}`))).body.data.summary.itemCount, 0)
    await click(button('Tuần trước'))
    await waitFor(() => assert.ok(document.querySelector('section[aria-label="Sáng ngày 26/10/2026"] article')))
    await click(document.querySelector('section[aria-label="Sáng ngày 26/10/2026"] button[aria-label^="Xóa"]'))
    await click(button('Xác nhận xóa', dialog()))
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.match(shoppingRow('Trứng gà')?.textContent || '', /6 quả/u) })

    await click(shoppingRow('Trứng gà').querySelector('input'))
    assert.equal(shoppingRow('Trứng gà').querySelector('input').checked, true)
    await click(button('Sao chép danh sách'))
    await waitFor(() => assert.ok(document.querySelector('#shopping-list textarea')))
    assert.match(document.querySelector('#shopping-list textarea').value, /\[x\] Trứng gà: 6 quả/u)
    await mount(path())
    await waitFor(() => { assert.ok(mealCard()); assert.match(shoppingRow('Trứng gà')?.textContent || '', /6 quả/u) })
    assert.equal(shoppingRow('Trứng gà').querySelector('input').checked, false, 'Reload clears transient bought flags while SQL plans persist')

    await click(mealCard().querySelector('button[aria-label^="Sửa"]'))
    await change('servings', '3'); await change('mealDate', '2026-10-27'); await change('mealType', 'Dinner')
    await submitMeal()
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.match(shoppingRow('Trứng gà')?.textContent || '', /4,5 quả/u) })
    actual = (await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${week}`))).body.data
    assert.equal(actual.days[0].meals.Lunch.length, 0)
    assert.equal(actual.days[1].meals.Dinner[0].mealPlanItemId, item.mealPlanItemId)
    assert.equal(actual.days[1].meals.Dinner[0].servings, 3)
    await click(button('Tuần sau'))
    await waitFor(() => { assert.equal(new URLSearchParams(window.location.search).get('weekStart'), nextWeek); assert.match(content(), /Bạn chưa lên lịch nấu ăn cho tuần này/u) })
    await click(button('Tuần trước'))
    await waitFor(() => assert.ok(mealCard()))

    await click([...mealCard().querySelectorAll('a')].find((node) => node.textContent === 'Xem công thức'))
    await waitFor(() => { assert.equal(document.querySelector('main h1')?.textContent, 'Trứng chiên'); assert.equal(servings(), 3) })
    const preparedEgg = () => document.querySelector('input[aria-label="Đã chuẩn bị Trứng gà"]')
    assert.match(preparedEgg().closest('li').textContent, /4,5 quả/u)
    await click(preparedEgg())
    await click(document.querySelector(`input[aria-label="Hoàn thành bước ${detail.steps[0].stepNumber}"]`))
    await click(button('Bắt đầu nấu'))
    await click(button('Bước tiếp theo')); await click(button('Đánh dấu hoàn thành'))
    await click(button('Thoát chế độ nấu'))
    const progressKey = `smartcook:cooking:v1:${recipe.recipeId}`
    const progress = JSON.parse(window.sessionStorage.getItem(progressKey))
    assert.equal(progress.servings, 3); assert.equal(progress.completedIds.length, 2); assert.equal(progress.preparedIds.length, 1)
    await mount(`${window.location.pathname}${window.location.search}`)
    await waitFor(() => assert.equal(servings(), 3))
    assert.equal(preparedEgg().checked, true)
    assert.equal(document.querySelector(`input[aria-label="Hoàn thành bước ${detail.steps[0].stepNumber}"]`).checked, true)

    await waitFor(() => assert.ok(button('Thêm vào lịch nấu ăn')))
    await click(button('Thêm vào lịch nấu ăn'))
    assert.equal(dialog().querySelector('[name="servings"]').value, '3')
    await change('mealDate', nextWeek); await change('mealType', 'Breakfast'); await change('servings', '2')
    await submitMeal()
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.match(content(), /Đã thêm món vào lịch nấu ăn/u) })
    const following = (await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${nextWeek}`))).body.data
    assert.equal(following.days[0].meals.Breakfast[0].servings, 2)
    assert.equal(following.days[0].meals.Breakfast[0].recipeId, recipe.recipeId)
    await mount(path(nextWeek))
    await waitFor(() => assert.ok(mealCard()))
    await click([...mealCard().querySelectorAll('a')].find((node) => node.textContent.trim() === 'Bắt đầu nấu'))
    await waitFor(() => assert.match(content(), /Chế độ nấu ăn/u))
    assert.equal(JSON.parse(window.sessionStorage.getItem(progressKey)).servings, 2)
    assert.equal(JSON.parse(window.sessionStorage.getItem(progressKey)).completedIds.length, 2, 'Planner navigation preserves old cooking progress')

    await mount(path(), fixture.admin.cookies)
    await waitFor(() => assert.match(content(), /Bạn chưa lên lịch nấu ăn cho tuần này/u))
    assert.equal(Boolean(mealCard()), false, 'Another SQL user cannot see the owner calendar')
    assert.equal((await sqlCall(() => fixture.admin.send(`/api/meal-plans/shopping-list?weekStart=${week}`))).body.data.items.length, 0)
    await mount(path(), owner.cookies)
    await waitFor(() => assert.ok(mealCard()))
    await click(mealCard().querySelector('button[aria-label^="Xóa"]'))
    await click(button('Hủy', dialog()))
    assert.equal((await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${week}`))).body.data.summary.itemCount, 1)
    await click(mealCard().querySelector('button[aria-label^="Xóa"]'))
    await click(button('Xác nhận xóa', dialog()))
    await waitFor(() => { assert.equal(Boolean(dialog()), false); assert.match(content(), /Bạn chưa lên lịch nấu ăn cho tuần này/u); assert.match(content(), /Danh sách đi chợ đang trống/u) })
    shopping = (await sqlCall(() => owner.send(`/api/meal-plans/shopping-list?weekStart=${week}`))).body.data.items
    assert.deepEqual(shopping, [])
    const pantry = (await sqlCall(() => owner.send('/api/pantry'))).body.data
    assert.equal(pantry.length, 1); assert.equal(pantry[0].quantity, 999)
    assert.deepEqual((await sqlCall(() => owner.send('/api/favorites/ids'))).body.data, [recipe.recipeId])
    assert.equal(window.localStorage.length, 0)
    assert.ok(calls.some((call) => call.path === '/favorites' && call.method === 'get'))
    assert.ok(calls.some((call) => call.path === '/meal-plans/items' && call.method === 'post'))
    assert.ok(calls.some((call) => call.path === `/meal-plans/items/${item.mealPlanItemId}` && call.method === 'patch'))
    assert.ok(calls.some((call) => call.path === `/meal-plans/items/${item.mealPlanItemId}` && call.method === 'delete'))
    await mount('/legacy-pantry')
    await waitFor(() => { assert.match(content(), /Tủ nguyên liệu của tôi/u); assert.match(content(), /Trứng gà/u); assert.match(content(), /999 quả/u) })
    assert.equal(window.location.pathname, '/legacy-pantry', 'An authenticated compatibility page preserves access to old Pantry data')
    await mount(path(nextWeek))
    await waitFor(() => assert.ok(mealCard()))
    const oldCookie = `${fixture.config.cookieName}=${cookies.get(fixture.config.cookieName)}`
    await click(document.querySelector('header button[aria-label="Đăng xuất"]'))
    await waitFor(() => assert.equal(window.location.pathname, '/'))
    assert.equal(cookies.has(fixture.config.cookieName), false)
    assert.equal((await sqlCall(() => owner.send(`/api/meal-plans?weekStart=${nextWeek}`, { headers: { Cookie: oldCookie } }))).status, 401)
    const readsAfterLogout = mealReads()
    await mount(path(nextWeek))
    await waitFor(() => assert.equal(window.location.pathname, '/login'))
    assert.equal(mealReads(), readsAfterLogout, 'Logged-out React guards never request private planner data')
    assert.equal(Boolean(mealCard()), false)
    assert.deepEqual(errors, [], 'React renders the live SQL flow without warnings or uncaught exceptions')
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
