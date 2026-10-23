import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { ingredientGroups } from '../src/utilities/pantryState.js'

let vite
let loadIngredientCatalog

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: 'error',
  })
  ;({ loadIngredientCatalog } = await vite.ssrLoadModule('/src/services/ingredientService.js'))
})

after(async () => { await vite?.close() })

// Controlled fixtures exercise pagination and failure handling only. Production
// still uses the actual Axios instance and SQL Server ingredients endpoint.
function ingredient(id) {
  return {
    ingredientId: id,
    ingredientName: `Nguyên liệu kiểm thử ${id}`,
    ingredientCategory: id > 100 ? 'Nhóm chỉ có ở trang sau' : 'Nhóm trang đầu',
    defaultUnit: 'g',
    imageUrl: null,
  }
}

function ingredientPage(page, total = 125) {
  const limit = 100
  const totalPages = Math.ceil(total / limit)
  return {
    data: Array.from({ length: Math.min(limit, Math.max(0, total - (page - 1) * limit)) }, (_, index) => ingredient((page - 1) * limit + index + 1)),
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  }
}

function createClient(transform = (body) => body) {
  const calls = []
  return {
    calls,
    async get(path, options) {
      calls.push({ path, ...options })
      return { data: await transform(ingredientPage(options.params.page), options.params.page) }
    },
  }
}

test('ingredient service reads all 125 DTOs and derives groups from the final page as well', async () => {
  const client = createClient()
  const controller = new AbortController()
  const catalog = await loadIngredientCatalog(controller.signal, client)
  assert.equal(catalog.length, 125)
  assert.equal(new Set(catalog.map((item) => item.ingredientId)).size, 125)
  assert.deepEqual(client.calls.map((call) => call.params), [{ page: 1, limit: 100 }, { page: 2, limit: 100 }])
  assert.ok(client.calls.every((call) => call.path === '/ingredients' && call.signal === controller.signal))
  assert.equal(catalog.at(-1).ingredientId, 125)
  assert.ok(ingredientGroups(catalog).includes('Nhóm chỉ có ở trang sau'))
  assert.equal(ingredientGroups(catalog).length, 2)
})

test('an empty API catalog resolves only after validating zero-result metadata', async () => {
  const client = createClient(() => ingredientPage(1, 0))
  assert.deepEqual(await loadIngredientCatalog(undefined, client), [])
  assert.equal(client.calls.length, 1)
})

test('inconsistent page, limit, totalPages and navigation flags fail closed', async () => {
  const mutations = [
    (body) => { body.pagination.page = 2 },
    (body) => { body.pagination.limit = 20 },
    (body) => { body.pagination.totalPages = 3 },
    (body) => { body.pagination.hasNextPage = false },
    (body) => { body.pagination.hasPreviousPage = true },
    (body) => { delete body.pagination.hasNextPage },
  ]
  for (const mutate of mutations) {
    const client = createClient((body) => { mutate(body); return body })
    await assert.rejects(() => loadIngredientCatalog(undefined, client), /phản hồi chưa đầy đủ/)
    assert.equal(client.calls.length, 1)
  }
  const badSecondPage = createClient((body, page) => {
    if (page === 2) body.pagination.hasPreviousPage = false
    return body
  })
  await assert.rejects(() => loadIngredientCatalog(undefined, badSecondPage), /phản hồi chưa đầy đủ/)
})

test('changing total between otherwise valid pages never exposes a partial catalog', async () => {
  const client = createClient((body, page) => page === 2 ? ingredientPage(2, 126) : body)
  await assert.rejects(() => loadIngredientCatalog(undefined, client), /phản hồi chưa đầy đủ/)
  assert.deepEqual(client.calls.map((call) => call.params.page), [1, 2])
})

test('truncated first or final page rejects rather than deriving groups or reconciling saved IDs', async () => {
  for (const truncatedPage of [1, 2]) {
    const client = createClient((body, page) => {
      if (page === truncatedPage) body.data.pop()
      return body
    })
    await assert.rejects(() => loadIngredientCatalog(undefined, client), /phản hồi chưa đầy đủ/)
    assert.equal(client.calls.length, truncatedPage)
  }
})

test('duplicate IDs within one page or across multiple pages reject the complete response', async () => {
  const duplicateFirstPage = createClient((body, page) => {
    if (page === 1) body.data[1].ingredientId = body.data[0].ingredientId
    return body
  })
  await assert.rejects(() => loadIngredientCatalog(undefined, duplicateFirstPage), /phản hồi chưa đầy đủ/)
  const duplicateAcrossPages = createClient((body, page) => {
    if (page === 2) body.data[0].ingredientId = 1
    return body
  })
  await assert.rejects(() => loadIngredientCatalog(undefined, duplicateAcrossPages), /phản hồi chưa đầy đủ/)
  assert.equal(duplicateAcrossPages.calls.length, 2)
})

test('invalid ingredient DTO fields cannot enter the shared pantry catalog', async () => {
  const mutations = [
    (item) => { item.ingredientId = '1' },
    (item) => { item.ingredientId = 2147483648 },
    (item) => { item.ingredientName = ' ' },
    (item) => { item.ingredientCategory = null },
    (item) => { item.defaultUnit = null },
    (item) => { delete item.imageUrl },
  ]
  for (const mutate of mutations) {
    const client = createClient((body) => { mutate(body.data[0]); return body })
    await assert.rejects(() => loadIngredientCatalog(undefined, client), /phản hồi chưa đầy đủ/)
    assert.equal(client.calls.length, 1)
  }
})

test('network failure on a later page preserves the original error and returns no incomplete catalog', async () => {
  const networkError = new Error('Controlled network failure')
  const client = createClient((body, page) => {
    if (page === 2) throw networkError
    return body
  })
  await assert.rejects(() => loadIngredientCatalog(undefined, client), (error) => error === networkError)
  assert.equal(client.calls.length, 2)
})

test('cancellation prevents a first GET and discards a late response before further pages', async () => {
  const beforeStart = new AbortController()
  beforeStart.abort()
  const untouchedClient = createClient()
  await assert.rejects(() => loadIngredientCatalog(beforeStart.signal, untouchedClient), { name: 'AbortError' })
  assert.equal(untouchedClient.calls.length, 0)

  const pending = new AbortController()
  let finishRequest
  const delayedClient = createClient((body) => new Promise((resolve) => { finishRequest = () => resolve(body) }))
  const result = loadIngredientCatalog(pending.signal, delayedClient)
  assert.equal(typeof finishRequest, 'function')
  pending.abort()
  finishRequest()
  await assert.rejects(() => result, { name: 'AbortError' })
  assert.equal(delayedClient.calls.length, 1, 'late response must not start page two')
})
