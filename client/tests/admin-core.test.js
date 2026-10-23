import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Only the HTTP adapter is controlled. Real App, guards, session context,
// layouts, forms, dialogs and Axios/CSRF services are mounted together.
const admin = { userId: 82, fullName: 'Quản trị kiểm thử', email: 'admin.fixture@example.test', phone: null, avatar: null, role: 'Admin', createdAt: '2026-10-22T03:00:00Z' }
const descriptors = new Map()
let dom, vite, App, api, root, createRoot, oldAdapter, previousError
let reactErrors = []
before(async () => {
  dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', { url: 'http://localhost/admin', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PopStateEvent']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] })
  }
  descriptors.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  dom.window.scrollTo = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  ;({ createRoot } = await import('react-dom/client'))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' })
  ;({ default: App } = await vite.ssrLoadModule('/tests/helpers/IngredientFlowApp.jsx'))
  ;({ api } = await vite.ssrLoadModule('/src/services/api.js'))
  oldAdapter = api.defaults.adapter
  previousError = console.error
  console.error = (...values) => reactErrors.push(values.map(String).join(' '))
})
after(async () => {
  if (root) await act(async () => root.unmount())
  api.defaults.adapter = oldAdapter
  console.error = previousError
  await vite?.close()
  dom?.window.close()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})
function reject(config, status, message) {
  const error = new Error(message)
  error.config = config
  error.response = { status, data: { message }, config }
  throw error
}
function fixture({ session = { ...admin }, handler } = {}) {
  const state = { session, calls: [], categories: Array.from({ length: 12 }, (_, index) => ({ categoryId: index + 1, categoryName: `Danh mục ${String(index + 1).padStart(2, '0')}`, description: `Mô tả ${index + 1}`, imageUrl: null, recipeCount: index === 0 ? 2 : 0 })),
    ingredients: [{ ingredientId: 1, ingredientName: 'Cà chua', ingredientCategory: 'Rau củ', defaultUnit: 'quả', imageUrl: null, recipeCount: 1, pantryCount: 0 }, { ingredientId: 2, ingredientName: 'Trứng', ingredientCategory: 'Trứng sữa', defaultUnit: 'quả', imageUrl: null, recipeCount: 0, pantryCount: 0 }],
    users: [admin, { ...admin, userId: 83, fullName: 'Người dùng thường', email: 'user.fixture@example.test', phone: '0901234567', role: 'User' }],
    recipes: [{ recipeId: 1, recipeName: 'Canh cà chua', categoryId: 1, categoryName: 'Danh mục 01', totalTime: 20, difficulty: 'Dễ', servings: 2, createdAt: admin.createdAt }, { recipeId: 2, recipeName: 'Trứng luộc', categoryId: 2, categoryName: 'Danh mục 02', totalTime: 10, difficulty: 'Dễ', servings: 1, createdAt: admin.createdAt }],
    reviews: [{ reviewId: 1, recipeId: 1, recipeName: 'Canh cà chua', userId: 83, fullName: 'Người dùng thường', rating: 5, comment: '<script>không chạy</script>', createdAt: admin.createdAt }, { reviewId: 2, recipeId: 2, recipeName: 'Trứng luộc', userId: 82, fullName: admin.fullName, rating: 3, comment: 'Góp ý thử', createdAt: admin.createdAt }], nextId: 100 }
  state.adapter = async (config) => {
    const call = { path: config.url, method: config.method, body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data, params: config.params || {}, config }
    state.calls.push(call)
    const response = (data) => ({ data, status: 200, statusText: 'OK', headers: {}, config })
    if (handler) { const result = await handler(call, state); if (result !== undefined) return response(result) }
    if (call.path === '/auth/me') return state.session ? response({ data: state.session }) : reject(config, 401, 'Bạn cần đăng nhập.')
    if (call.path === '/auth/csrf') return response({ csrfToken: 'admin-controlled-csrf' })
    if (call.path === '/favorites/ids') return response({ data: [] })
    if (call.path === '/auth/logout') { state.session = null; return response({ message: 'Đã đăng xuất.' }) }
    if (call.path === '/categories') return response({ data: [] })
    if (call.path === '/recipes') return response({ data: [], pagination: { page: 1, total: 0, totalPages: 0, limit: 12 } })
    if (!state.session) return reject(config, 401, 'Phiên đăng nhập đã kết thúc.')
    if (state.session.role !== 'Admin') return reject(config, 403, 'Không có quyền quản trị.')
    if (call.path === '/admin/dashboard') return response({ data: { totals: { recipeCount: state.recipes.length, ingredientCount: state.ingredients.length, categoryCount: state.categories.length, userCount: state.users.length, reviewCount: state.reviews.length, favoriteCount: 0 }, mostFavorited: [], mostReviewed: state.recipes.map((row) => ({ ...row, count: 1 })), newestRecipes: state.recipes } })
    const match = /^\/admin\/(categories|ingredients|users|reviews|recipes)(?:\/(\d+))?$/u.exec(call.path)
    if (!match) throw new Error(`Unexpected admin-test endpoint ${call.path}`)
    const [, resource, rawId] = match, id = Number(rawId), idField = { categories: 'categoryId', ingredients: 'ingredientId', users: 'userId', reviews: 'reviewId', recipes: 'recipeId' }[resource]
    const nameField = { categories: 'categoryName', ingredients: 'ingredientName', users: 'fullName', reviews: 'recipeName', recipes: 'recipeName' }[resource]
    if (call.method === 'get') {
      if (rawId) { const item = state[resource].find((row) => row[idField] === id); return item ? response({ data: item }) : reject(config, 404, 'Không tìm thấy tài khoản.') }
      const params = call.params, page = Number(params.page || 1), limit = Number(params.limit || 10)
      let rows = state[resource].filter((row) => !params.search || `${row[nameField]} ${row.email || ''} ${row.comment || ''}`.toLocaleLowerCase('vi-VN').includes(params.search.toLocaleLowerCase('vi-VN')))
      for (const key of ['ingredientCategory', 'role', 'recipeId', 'rating']) if (params[key]) rows = rows.filter((row) => String(row[key]) === String(params[key]))
      return response({ data: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) } })
    }
    assert.equal(config.headers.get('X-CSRF-Token'), 'admin-controlled-csrf')
    assert.equal(config.headers.get('Content-Type'), 'application/json')
    if (call.method === 'post' || call.method === 'patch') {
      if (state[resource].some((row) => row[idField] !== id && row[nameField] === call.body[nameField])) return reject(config, 409, 'Tên đã tồn tại.')
      if (rawId) { const index = state[resource].findIndex((row) => row[idField] === id); state[resource][index] = { ...state[resource][index], ...call.body }; return response({ data: state[resource][index] }) }
      const item = { ...call.body, [idField]: state.nextId++, recipeCount: 0, pantryCount: 0 }
      state[resource].unshift(item)
      return response({ data: item })
    }
    if (call.method === 'delete') {
      assert.deepEqual(call.body, {})
      const item = state[resource].find((row) => row[idField] === id)
      if (item.recipeCount || item.pantryCount) return reject(config, 409, 'Dữ liệu đang được sử dụng nên không thể xóa.')
      state[resource] = state[resource].filter((row) => row[idField] !== id)
      return response({ message: 'Đã xóa.' })
    }
    throw new Error('Unexpected method')
  }
  return state
}
async function mount(path, state) {
  if (root) await act(async () => root.unmount())
  document.getElementById('root').replaceChildren()
  window.localStorage.clear(); window.sessionStorage.clear()
  window.history.replaceState(null, '', path)
  api.defaults.adapter = state.adapter
  reactErrors = []
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(App)))
}
async function waitFor(check) {
  let last
  for (let count = 0; count < 100; count += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
    try { check(); return } catch (error) { last = error }
  }
  throw last
}
function text() { return document.body.textContent }
function main() { return document.querySelector('main') }
function dialog() { const item = document.querySelector('[role="dialog"]'); assert.ok(item, 'Dialog exists'); return item }
function button(label, scope = document) {
  const item = [...scope.querySelectorAll('button')].find((node) => node.textContent.trim() === label || node.getAttribute('aria-label') === label)
  assert.ok(item, `Button ${label}`)
  return item
}
async function click(item) { await act(async () => item.click()) }
async function change(element, value) {
  assert.ok(element, 'Editable field exists')
  await act(async () => {
    const prototype = element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
async function fill(name, value, scope = dialog()) { await change(scope.querySelector(`[name="${name}"]`), value) }
async function submit(scope = dialog()) { await act(async () => scope.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))) }
async function ready() { await waitFor(() => assert.ok(main()?.querySelector('table'))) }
function writes(state) { return state.calls.filter((call) => ['post', 'patch', 'delete'].includes(call.method)) }
function noErrors() { assert.deepEqual(reactErrors, [], 'No React DOM or act warnings') }

test('10A guest is redirected and User gets403 without loading any admin endpoint', async () => {
  const guest = fixture({ session: null })
  await mount('/admin/categories', guest)
  await waitFor(() => assert.equal(window.location.pathname, '/login'))
  assert.equal(guest.calls.some((call) => call.path.startsWith('/admin/')), false)
  const regular = fixture({ session: { ...admin, role: 'User' } })
  await mount('/admin/users', regular)
  await waitFor(() => assert.match(text(), /Khu vực dành cho quản trị viên/))
  assert.equal(regular.calls.some((call) => call.path.startsWith('/admin/')), false)
  noErrors()
})
test('10A separate layout has active navigation, tablet collapse and mobile drawer that navigates and restores scrolling', async () => {
  const state = fixture()
  await mount('/admin', state)
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/))
  assert.equal(document.querySelector('footer'), null)
  assert.equal(document.title, 'Tổng quan · Quản trị SmartCook')
  assert.ok(document.querySelector('aside nav a[aria-current="page"][href="/admin"]'))
  assert.match(document.querySelector('aside').className, /w-20 lg:w-64/u)
  await click(button('Thu gọn thanh bên'))
  assert.ok(button('Mở rộng thanh bên'))
  assert.doesNotMatch(document.querySelector('aside').className, /lg:w-64/u)
  const toggle = button('Mở menu quản trị')
  await click(toggle)
  assert.equal(toggle.getAttribute('aria-expanded'), 'true')
  assert.equal(document.body.style.overflow, 'hidden')
  assert.equal(dialog().getAttribute('aria-modal'), 'true')
  await click(dialog().querySelector('a[href="/admin/categories"]'))
  await ready()
  assert.equal(window.location.pathname, '/admin/categories')
  assert.equal(document.title, 'Danh mục · Quản trị SmartCook')
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.equal(document.body.style.overflow, '')
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  assert.ok(main().classList.contains('min-w-0'))
  noErrors()
})
test('10A admin logout preserves session on failure then uses existing CSRF logout and returns to website', async () => {
  let fail = true
  const state = fixture({ handler: (call) => { if (call.path === '/auth/logout' && fail) return reject(call.config, 503, 'Chưa thể đăng xuất.') } })
  await mount('/admin', state)
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/))
  await click(button('Đăng xuất', document.querySelector('aside')))
  assert.match(text(), /Chưa thể đăng xuất/u)
  assert.equal(window.location.pathname, '/admin')
  assert.ok(state.session)
  fail = false
  await click(button('Đăng xuất', document.querySelector('aside')))
  await waitFor(() => assert.equal(window.location.pathname, '/'))
  assert.equal(state.session, null)
  assert.doesNotMatch(document.title, /Quản trị SmartCook/u)
  const request = state.calls.filter((call) => call.path === '/auth/logout').at(-1)
  assert.equal(request.config.headers.get('X-CSRF-Token'), 'admin-controlled-csrf')
  noErrors()
})
test('10A mobile drawer displays logout failure inside its modal and allows a successful retry', async () => {
  let fail = true, failLogout
  const state = fixture({ handler: (call) => {
    if (call.path === '/auth/logout' && fail) return new Promise((resolve, rejectPromise) => {
      failLogout = () => { try { reject(call.config, 503, 'Chưa thể đăng xuất. Vui lòng thử lại.') } catch (error) { rejectPromise(error) } }
    })
  } })
  await mount('/admin', state)
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/u))
  await click(button('Mở menu quản trị'))
  const drawer = dialog()
  await click(button('Đăng xuất', drawer))
  await waitFor(() => assert.equal(typeof failLogout, 'function'))
  assert.equal(drawer.getAttribute('aria-busy'), 'true')
  assert.equal(button('Đang đăng xuất…', drawer).disabled, true)
  assert.equal(drawer.querySelector('[role="alert"]'), null)
  await act(async () => failLogout())
  await waitFor(() => assert.match(dialog().querySelector('[role="alert"]')?.textContent || '', /Chưa thể đăng xuất\. Vui lòng thử lại\./u))
  assert.equal(dialog(), drawer, 'Failure keeps the same drawer open')
  assert.equal(drawer.getAttribute('aria-busy'), 'false')
  assert.equal(button('Đăng xuất', drawer).disabled, false)
  assert.equal(document.querySelectorAll('[role="alert"]').length, 1, 'The visible modal owns the error announcement')
  assert.equal(window.location.pathname, '/admin')
  assert.equal(state.session.userId, admin.userId)
  assert.ok(document.querySelector(`header a[aria-label="Hồ sơ của ${admin.fullName}"]`))
  fail = false
  await click(button('Đăng xuất', drawer))
  await waitFor(() => assert.equal(window.location.pathname, '/'))
  assert.equal(state.session, null)
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.equal(document.body.style.overflow, '')
  const requests = state.calls.filter((call) => call.path === '/auth/logout')
  assert.equal(requests.length, 2)
  assert.ok(requests.every((call) => call.config.headers.get('X-CSRF-Token') === 'admin-controlled-csrf'))
  noErrors()
})
test('10B dashboard renders API totals, rankings and zero groups without fabricated activity', async () => {
  const state = fixture()
  await mount('/admin', state)
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/))
  assert.equal(main().querySelectorAll('article').length, 6)
  assert.equal(main().querySelector('article p.text-3xl').textContent, '2')
  assert.match(text(), /Chưa có dữ liệu trong nhóm này/u)
  assert.ok(main().querySelector('a[href="/admin/recipes/1/edit"]'))
  assert.equal(state.calls.filter((call) => call.path === '/admin/dashboard').length, 1)
  const empty = fixture({ handler: (call) => call.path === '/admin/dashboard' ? { data: { totals: { recipeCount: 0, ingredientCount: 0, categoryCount: 0, userCount: 0, reviewCount: 0, favoriteCount: 0 }, mostFavorited: [], mostReviewed: [], newestRecipes: [] } } : undefined })
  await mount('/admin', empty)
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/))
  assert.deepEqual([...main().querySelectorAll('article p.text-3xl')].map((node) => node.textContent), ['0', '0', '0', '0', '0', '0'])
  assert.equal(main().querySelectorAll('ol').length, 0)
  noErrors()
})
test('10B dashboard shows pending then real error and retries the server request', async () => {
  let complete, failure = true
  const state = fixture({ handler: (call) => {
    if (call.path === '/admin/dashboard' && failure) return new Promise((resolve, rejectPromise) => { complete = () => { try { reject(call.config, 503, 'SQL Server tạm thời chưa sẵn sàng.') } catch (error) { rejectPromise(error) } } })
  } })
  await mount('/admin', state)
  await waitFor(() => assert.equal(typeof complete, 'function'))
  assert.match(text(), /Đang tải thống kê quản trị/u)
  assert.equal(main().querySelector('article'), null)
  await act(async () => complete())
  assert.match(text(), /SQL Server tạm thời chưa sẵn sàng/u)
  failure = false
  await click(button('Thử lại'))
  await waitFor(() => assert.match(text(), /Góc nhìn tổng thể/))
  noErrors()
})
test('10D category DataTable provides headers, local horizontal scroll, search, pagination and empty state', async () => {
  const state = fixture()
  await mount('/admin/categories', state)
  await ready()
  assert.equal(main().querySelectorAll('tbody tr').length, 10)
  assert.equal(main().querySelectorAll('th[scope="col"]').length, 4)
  assert.ok(main().querySelector('[role="region"]').classList.contains('overflow-x-auto'))
  assert.equal(main().querySelector('caption').textContent, 'Danh sách danh mục')
  await click(button('Trang 2'))
  await waitFor(() => assert.equal(main().querySelectorAll('tbody tr').length, 2))
  assert.equal(state.calls.filter((call) => call.path === '/admin/categories').at(-1).params.page, 2)
  await fill('search', 'không có', main())
  await submit(main())
  await waitFor(() => assert.match(text(), /Chưa có danh mục phù hợp/u))
  assert.equal(state.calls.filter((call) => call.path === '/admin/categories').at(-1).params.page, 1)
  await click(button('Xóa bộ lọc'))
  await ready()
  noErrors()
})
test('10D category form validates required name and safe image URL before any write', async () => {
  const state = fixture()
  await mount('/admin/categories', state)
  await ready()
  await click(button('Thêm danh mục'))
  await submit()
  assert.equal(dialog().querySelector('[name="categoryName"]').getAttribute('aria-invalid'), 'true')
  assert.equal(document.activeElement.name, 'categoryName')
  await fill('categoryName', 'Danh mục mới')
  await fill('imageUrl', 'javascript:alert(1)')
  await submit()
  assert.equal(dialog().querySelector('[name="imageUrl"]').getAttribute('aria-invalid'), 'true')
  assert.equal(writes(state).length, 0)
  await click(button('Hủy', dialog()))
  assert.equal(document.querySelector('[role="dialog"]'), null)
  noErrors()
})
test('10D create and edit categories only after API success; cancel leaves original rows intact', async () => {
  const state = fixture()
  await mount('/admin/categories', state)
  await ready()
  await click(button('Thêm danh mục'))
  await fill('categoryName', '  Món thử mới  ')
  await fill('description', 'Mô tả vừa thêm')
  await fill('imageUrl', '/images/category.webp')
  await submit()
  await waitFor(() => assert.match(text(), /Đã thêm danh mục/u))
  await ready()
  assert.deepEqual(writes(state)[0].body, { categoryName: 'Món thử mới', description: 'Mô tả vừa thêm', imageUrl: '/images/category.webp' })
  await click(button('Sửa Món thử mới'))
  await fill('categoryName', 'Bản nháp chưa lưu')
  await click(button('Hủy', dialog()))
  assert.ok(button('Sửa Món thử mới'))
  assert.equal(writes(state).length, 1)
  await click(button('Sửa Món thử mới'))
  await fill('categoryName', 'Món thử đã sửa')
  await submit()
  await waitFor(() => assert.match(text(), /Đã cập nhật danh mục/u))
  await ready()
  assert.ok(button('Sửa Món thử đã sửa'))
  assert.equal(writes(state).at(-1).method, 'patch')
  noErrors()
})
test('10D form blocks duplicate submit and pending close, then preserves draft on server conflict', async () => {
  let complete
  const state = fixture({ handler: (call) => {
    if (call.path === '/admin/categories' && call.method === 'post') return new Promise((resolve, rejectPromise) => { complete = () => { try { reject(call.config, 409, 'Tên danh mục đã tồn tại.') } catch (error) { rejectPromise(error) } } })
  } })
  await mount('/admin/categories', state)
  await ready()
  await click(button('Thêm danh mục'))
  await fill('categoryName', 'Tên xung đột')
  await submit()
  await waitFor(() => assert.equal(typeof complete, 'function'))
  assert.equal(button('Đang lưu…', dialog()).disabled, true)
  assert.equal(button('Hủy', dialog()).disabled, true)
  await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.ok(dialog())
  await submit()
  assert.equal(writes(state).length, 1)
  await act(async () => complete())
  assert.match(dialog().textContent, /Tên danh mục đã tồn tại/u)
  assert.equal(dialog().querySelector('[name="categoryName"]').value, 'Tên xung đột')
  assert.doesNotMatch(main().textContent, /Đã thêm danh mục/u)
  noErrors()
})
test('10D ConfirmDialog traps focus, defaults to cancel, restores focus and respects linked-data409', async () => {
  const state = fixture()
  await mount('/admin/categories', state)
  await ready()
  const trigger = button('Xóa Danh mục 01')
  trigger.focus()
  await click(trigger)
  assert.equal(document.activeElement, button('Hủy', dialog()))
  const confirm = button('Xác nhận xóa', dialog())
  confirm.focus()
  await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
  assert.equal(document.activeElement, button('Đóng', dialog()))
  await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.equal(document.activeElement, trigger)
  assert.equal(writes(state).length, 0)
  await click(trigger)
  await click(button('Xác nhận xóa', dialog()))
  assert.match(dialog().textContent, /đang được sử dụng/u)
  assert.ok(button('Xóa Danh mục 01', main()))
  assert.doesNotMatch(main().textContent, /Đã xóa danh mục/u)
  await click(button('Hủy', dialog()))
  await click(button('Xóa Danh mục 02'))
  await click(button('Xác nhận xóa', dialog()))
  await waitFor(() => assert.match(text(), /Đã xóa danh mục/u))
  await ready()
  assert.equal(main().querySelector('[aria-label="Xóa Danh mục 02"]'), null)
  noErrors()
})
test('10E ingredients filter by group and support validated create/edit/delete with unchanged existing recipe units', async () => {
  const state = fixture()
  await mount('/admin/ingredients', state)
  await ready()
  await fill('ingredientCategory', 'Rau củ', main())
  await submit(main())
  await waitFor(() => assert.equal(main().querySelectorAll('tbody tr').length, 1))
  assert.equal(state.calls.filter((call) => call.path === '/admin/ingredients').at(-1).params.ingredientCategory, 'Rau củ')
  await click(button('Xóa bộ lọc'))
  await ready()
  await click(button('Thêm nguyên liệu'))
  await submit()
  assert.equal(dialog().querySelectorAll('[aria-invalid="true"]').length, 3)
  await fill('ingredientName', 'Nấm mới')
  await fill('ingredientCategory', 'Rau củ')
  await fill('defaultUnit', 'g')
  await submit()
  await waitFor(() => assert.match(text(), /Đã thêm nguyên liệu/u))
  await ready()
  await click(button('Sửa Nấm mới'))
  await fill('defaultUnit', 'kg')
  await submit()
  await waitFor(() => assert.match(text(), /Đã cập nhật nguyên liệu/u))
  await ready()
  assert.equal(state.ingredients.find((row) => row.ingredientName === 'Nấm mới').defaultUnit, 'kg')
  assert.equal(state.ingredients.find((row) => row.ingredientName === 'Cà chua').defaultUnit, 'quả')
  await click(button('Xóa Nấm mới'))
  await click(button('Xác nhận xóa', dialog()))
  await waitFor(() => assert.match(text(), /Đã xóa nguyên liệu/u))
  noErrors()
})
test('10F users list searches, filters role and loads safe read-only profile details', async () => {
  const state = fixture()
  await mount('/admin/users', state)
  await ready()
  await change(main().querySelector('#admin-users-role'), 'User')
  await waitFor(() => assert.equal(main().querySelectorAll('tbody tr').length, 1))
  await click(button('Xem hồ sơ Người dùng thường'))
  await waitFor(() => assert.match(dialog().textContent, /0901234567/u))
  assert.match(dialog().textContent, /user.fixture@example.test/u)
  assert.equal(dialog().querySelector('input'), null)
  assert.doesNotMatch(text(), /PasswordHash|Đổi quyền|Reset mật khẩu/u)
  await click(button('Đóng', dialog()))
  await fill('search', 'không tồn tại', main())
  await submit(main())
  await waitFor(() => assert.match(text(), /Chưa có tài khoản phù hợp/u))
  assert.equal(writes(state).length, 0)
  noErrors()
})
test('10F reviews filter recipe/rating, escape comments, require confirmation and delete only after success', async () => {
  const state = fixture()
  await mount('/admin/reviews', state)
  await ready()
  assert.match(main().textContent, /<script>không chạy<\/script>/u)
  assert.equal(main().querySelector('script'), null)
  await change(main().querySelector('#admin-reviews-rating'), '5')
  await waitFor(() => assert.equal(main().querySelectorAll('tbody tr').length, 1))
  await change(main().querySelector('#admin-reviews-recipe'), '1')
  await waitFor(() => assert.equal(state.calls.filter((call) => call.path === '/admin/reviews').at(-1).params.recipeId, '1'))
  await click(button('Xóa đánh giá của Người dùng thường về Canh cà chua'))
  assert.equal(writes(state).length, 0)
  await click(button('Hủy', dialog()))
  assert.equal(writes(state).length, 0)
  await click(button('Xóa đánh giá của Người dùng thường về Canh cà chua'))
  await click(button('Xác nhận xóa', dialog()))
  await waitFor(() => assert.match(text(), /Đã xóa đánh giá/u))
  await waitFor(() => assert.match(text(), /Chưa có đánh giá phù hợp/u))
  assert.equal(state.recipes.length, 2)
  assert.equal(writes(state)[0].path, '/admin/reviews/1')
  noErrors()
})
test('10G data error retries and expired Admin API401 clears the existing session through the guard', async () => {
  let offline = true
  const state = fixture({ handler: (call) => { if (call.path === '/admin/categories' && offline) return reject(call.config, 503, 'Chưa tải được danh mục từ SQL Server.') } })
  await mount('/admin/categories', state)
  await waitFor(() => assert.match(text(), /Chưa tải được danh mục từ SQL Server/u))
  offline = false
  await click(button('Thử lại'))
  await ready()
  state.session = null
  await click(button('Trang 2'))
  await waitFor(() => assert.equal(window.location.pathname, '/login'))
  assert.equal(document.querySelector('aside'), null)
  assert.equal(window.history.state.usr.from, '/admin/categories')
  noErrors()
})
test('10G navigating away aborts a pending CSRF lookup before any old Admin mutation is sent', async () => {
  let complete
  const state = fixture({ handler: (call) => {
    if (call.path === '/auth/csrf') return new Promise((resolve) => { complete = () => resolve({ csrfToken: 'old-csrf' }) })
  } })
  await mount('/admin/categories', state)
  await ready()
  await click(button('Thêm danh mục'))
  await fill('categoryName', 'Không được lưu sau khi rời trang')
  await submit()
  await waitFor(() => assert.equal(typeof complete, 'function'))
  await click(document.querySelector('aside a[href="/admin/users"]'))
  await ready()
  await act(async () => complete())
  assert.equal(writes(state).length, 0)
  assert.equal(window.location.pathname, '/admin/users')
  assert.doesNotMatch(text(), /Đã thêm danh mục/u)
  noErrors()
})
