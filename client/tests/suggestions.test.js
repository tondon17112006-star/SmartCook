import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectSuggestionPages,
  filterSuggestionCollection,
  MAX_FILTER_RESULTS,
  SUGGESTION_PAGE_SIZE,
  SuggestionCollectionError,
  validateSuggestionPage,
} from '../src/utilities/suggestions.js'

// Controlled DTOs exercise page boundaries without replacing the application's API.
function recipesFixture(count) {
  return Array.from({ length: count }, (_, index) => ({
    recipeId: count - index,
    recipeName: `Công thức kiểm thử ${count - index}`,
    imageUrl: null,
    categoryName: 'Nhóm kiểm thử',
    status: index % 3 === 0 ? 'ready' : 'missing',
    matchPercentage: index % 3 === 0 ? 100 : 50,
    totalTime: 10 + index,
    servings: 2,
    requestedServings: 4,
    matchedRequiredCount: index % 3 === 0 ? 2 : 1,
    totalRequiredCount: 2,
    missingRequiredCount: index % 3 === 0 ? 0 : 1,
    matchedIngredients: [],
    missingIngredients: [],
    optionalIngredients: [],
  }))
}

function responsePage(recipes, page, limit) {
  const totalPages = Math.ceil(recipes.length / limit)
  return {
    data: recipes.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total: recipes.length,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  }
}

function isCollectionError(error) {
  return error instanceof SuggestionCollectionError && error.code === 'INCOMPLETE_RESULTS'
}

for (const count of [13, 60, 110]) {
  test(`collecting ${count} ranked recipes loads every API page before filtering status`, async () => {
    const recipes = recipesFixture(count)
    const calls = []
    const collection = await collectSuggestionPages(async (page, limit) => {
      calls.push([page, limit])
      return responsePage(recipes, page, limit)
    })

    assert.deepEqual(calls, Array.from({ length: Math.ceil(count / 50) }, (_, index) => [index + 1, 50]))
    assert.equal(collection.complete, true)
    assert.equal(collection.pagination.total, count)
    assert.deepEqual(collection.data, recipes, 'rank and DTO identities must survive collection')
    for (const status of ['all', 'ready', 'missing']) {
      const expected = status === 'all' ? recipes : recipes.filter((recipe) => recipe.status === status)
      const first = filterSuggestionCollection(collection, status, 1)
      assert.equal(first.pagination.total, expected.length, 'total must describe all pages, not only the visible page')
      assert.equal(first.unfilteredTotal, count)
      assert.equal(first.pagination.limit, SUGGESTION_PAGE_SIZE)
      assert.deepEqual(first.data, expected.slice(0, SUGGESTION_PAGE_SIZE))
      const assembled = []
      for (let page = 1; page <= first.pagination.totalPages; page += 1) {
        const result = filterSuggestionCollection(collection, status, page)
        assert.equal(result.pagination.page, page)
        assembled.push(...result.data)
      }
      assert.deepEqual(assembled, expected, 'filtered pagination must preserve ranking without duplicates or skipped rows')
    }
  })
}

test('status filters use API status even when a missing recipe rounds to 100 percent', async () => {
  const recipes = recipesFixture(2)
  recipes[1] = { ...recipes[1], matchPercentage: 100, matchedRequiredCount: 199, totalRequiredCount: 200, missingRequiredCount: 1 }
  const collection = await collectSuggestionPages(async (page, limit) => responsePage(recipes, page, limit))
  assert.deepEqual(filterSuggestionCollection(collection, 'ready', 1).data.map((recipe) => recipe.recipeId), [recipes[0].recipeId])
  assert.deepEqual(filterSuggestionCollection(collection, 'missing', 1).data.map((recipe) => recipe.recipeId), [recipes[1].recipeId])
  assert.throws(() => filterSuggestionCollection(collection, 'unknown', 1), /Bộ lọc/)
})

test('a partial collection cannot be presented as a whole-dataset status filter', () => {
  const page = responsePage(recipesFixture(60), 1, 50)
  for (const complete of [false, undefined, true]) {
    assert.throws(() => filterSuggestionCollection({ ...page, complete }, 'ready', 1), isCollectionError)
  }
})

test('a later-page failure propagates without returning a partially filtered result', async () => {
  const recipes = recipesFixture(60)
  const outage = new Error('Controlled network outage')
  await assert.rejects(collectSuggestionPages(async (page, limit) => {
    if (page === 2) throw outage
    return responsePage(recipes, page, limit)
  }), (error) => error === outage)
})

test('corrupt pagination, payloads and recipe identities fail closed', () => {
  const valid = responsePage(recipesFixture(60), 1, 50)
  const invalidResponses = [
    null,
    { ...valid, data: null },
    { ...valid, pagination: null },
    { ...valid, data: valid.data.slice(1) },
    { ...valid, pagination: { ...valid.pagination, page: 2 } },
    { ...valid, pagination: { ...valid.pagination, limit: 12 } },
    { ...valid, pagination: { ...valid.pagination, total: -1 } },
    { ...valid, pagination: { ...valid.pagination, total: 60.5 } },
    { ...valid, pagination: { ...valid.pagination, totalPages: 1 } },
    { ...valid, data: [{ ...valid.data[0], recipeId: 0 }, ...valid.data.slice(1)] },
    { ...valid, data: [{ ...valid.data[0], recipeId: 1.5 }, ...valid.data.slice(1)] },
    { ...valid, data: [{ ...valid.data[0], status: 'available' }, ...valid.data.slice(1)] },
    { ...valid, data: [valid.data[1], ...valid.data.slice(1)] },
  ]
  for (const response of invalidResponses) assert.throws(() => validateSuggestionPage(response, 1, 50), isCollectionError)
})

test('navigation flags agree with the validated pagination rather than misleading controls', () => {
  const valid = responsePage(recipesFixture(60), 1, 50)
  for (const [key, value] of [['hasNextPage', false], ['hasPreviousPage', true], ['hasNextPage', 'true'], ['hasPreviousPage', undefined]]) {
    assert.throws(() => validateSuggestionPage({ ...valid, pagination: { ...valid.pagination, [key]: value } }, 1, 50), isCollectionError)
  }
})

test('a changing total or repeated ID on another page prevents an incomplete collection', async () => {
  const recipes = recipesFixture(60)
  for (const change of ['total', 'duplicate']) {
    await assert.rejects(collectSuggestionPages(async (page, limit) => {
      const response = responsePage(recipes, page, limit)
      if (page === 2 && change === 'total') {
        response.pagination.total = 61
        response.data.push({ ...recipes[0], recipeId: 999 })
      }
      if (page === 2 && change === 'duplicate') response.data[0] = recipes[0]
      return response
    }), isCollectionError)
  }
})

test('the 500-result client-filter bound returns FILTER_LIMIT before fetching more pages', async () => {
  const recipes = recipesFixture(MAX_FILTER_RESULTS + 1)
  const calls = []
  await assert.rejects(collectSuggestionPages(async (page, limit) => {
    calls.push(page)
    return responsePage(recipes, page, limit)
  }), (error) => error instanceof SuggestionCollectionError && error.code === 'FILTER_LIMIT')
  assert.deepEqual(calls, [1])
})

test('an aborted signal sends no first-page request', async () => {
  const controller = new AbortController()
  const reason = new Error('Cancelled before request')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(collectSuggestionPages(async (page, limit) => {
    calls += 1
    return responsePage(recipesFixture(13), page, limit)
  }, { signal: controller.signal }), (error) => error === reason)
  assert.equal(calls, 0)
})

test('cancellation between pages avoids the next request and publishes no old collection', async () => {
  const controller = new AbortController()
  const reason = new Error('Ingredients changed')
  const calls = []
  await assert.rejects(collectSuggestionPages(async (page, limit) => {
    calls.push(page)
    controller.abort(reason)
    return responsePage(recipesFixture(60), page, limit)
  }, { signal: controller.signal }), (error) => error === reason)
  assert.deepEqual(calls, [1])
})

test('cancellation while the last page resolves cannot publish its stale results', async () => {
  const controller = new AbortController()
  const reason = new Error('Cancelled last page')
  await assert.rejects(collectSuggestionPages(async (page, limit) => {
    if (page === 2) controller.abort(reason)
    return responsePage(recipesFixture(60), page, limit)
  }, { signal: controller.signal }), (error) => error === reason)
})

test('requested pages are clamped after filtering with accurate previous and next flags', async () => {
  const recipes = recipesFixture(60)
  const collection = await collectSuggestionPages(async (page, limit) => responsePage(recipes, page, limit))
  for (const invalid of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, 1.5, '2']) {
    const result = filterSuggestionCollection(collection, 'ready', invalid)
    assert.equal(result.pagination.page, 1)
    assert.equal(result.pagination.hasPreviousPage, false)
    assert.equal(result.pagination.hasNextPage, true)
  }
  const last = filterSuggestionCollection(collection, 'ready', 999)
  assert.equal(last.pagination.page, 2)
  assert.equal(last.pagination.totalPages, 2)
  assert.equal(last.pagination.hasNextPage, false)
  assert.equal(last.pagination.hasPreviousPage, true)
  assert.equal(last.data.length, 8)
})

test('an empty API response or zero matching status remains a valid empty result on page 1', async () => {
  for (const recipes of [[], recipesFixture(1)]) {
    const collection = await collectSuggestionPages(async (page, limit) => responsePage(recipes, page, limit))
    const result = filterSuggestionCollection(collection, 'missing', 999)
    assert.deepEqual(result.data, [])
    assert.deepEqual(result.pagination, { page: 1, limit: 12, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false })
    assert.equal(result.unfilteredTotal, recipes.length)
  }
})
