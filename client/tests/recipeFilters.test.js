import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRecipeSearchParams,
  readRecipeFilters,
  RECIPE_PAGE_SIZE,
  toRecipeApiParams,
} from '../src/utilities/recipeFilters.js'

test('empty URL uses safe API defaults and a fixed 12-item page', () => {
  const filters = readRecipeFilters('')
  assert.deepEqual(toRecipeApiParams(filters), { sort: 'newest', page: 1, limit: RECIPE_PAGE_SIZE })
  assert.equal(createRecipeSearchParams(filters).toString(), '')
})

test('Vietnamese search and difficulty normalize to NFC and survive a URL round trip', () => {
  const input = new URLSearchParams({ search: '  trứng gà  '.normalize('NFD'), difficulty: ' Dễ '.normalize('NFD'), page: '2' })
  const filters = readRecipeFilters(input)
  assert.equal(filters.search, 'trứng gà')
  assert.equal(filters.difficulty, 'Dễ')
  assert.deepEqual(readRecipeFilters(createRecipeSearchParams(filters)), filters)
})

test('strict numeric validation rejects malformed integers before requests', () => {
  for (const invalid of ['0', '-1', '01', '1e2', '1.0', '+2', ' 2 ', 'NaN', 'Infinity', '2147483648']) {
    const filters = readRecipeFilters(new URLSearchParams({ categoryId: invalid, maxTime: invalid }))
    assert.equal(filters.categoryId, '', invalid)
    assert.equal(filters.maxTime, '', invalid)
  }
  assert.equal(readRecipeFilters('categoryId=2147483647').categoryId, '2147483647')
  assert.equal(readRecipeFilters('page=100000').page, 100000)
  assert.equal(readRecipeFilters('page=100001').page, 1)
})

test('duplicate parameters, unknown sort and unsupported difficulty cannot escape to the API', () => {
  const filters = readRecipeFilters('search=abc&search=xyz&categoryId=1&categoryId=2&page=2&page=3&sort=drop_table&difficulty=easy&untrusted=x')
  assert.deepEqual(toRecipeApiParams(filters), { sort: 'newest', page: 1, limit: 12 })
  assert.equal(createRecipeSearchParams(filters).toString(), '')
  assert.deepEqual(toRecipeApiParams({ sort: 'drop_table', page: -1, categoryId: '0' }), { sort: 'newest', page: 1, limit: 12 })
})

test('all server filters and sort are preserved between pagination links', () => {
  const filters = readRecipeFilters(new URLSearchParams({ search: 'canh', categoryId: '3', maxTime: '45', difficulty: 'Trung bình', sort: 'time_asc', page: '2' }))
  const api = toRecipeApiParams(filters)
  assert.deepEqual(api, { search: 'canh', categoryId: '3', maxTime: '45', difficulty: 'Trung bình', sort: 'time_asc', page: 2, limit: 12 })
  const pageThree = createRecipeSearchParams({ ...filters, page: 3 })
  assert.equal(readRecipeFilters(pageThree).page, 3)
  assert.equal(readRecipeFilters(pageThree).search, filters.search)
  const resetPage = createRecipeSearchParams({ ...filters, categoryId: '4', page: 1 })
  assert.equal(resetPage.has('page'), false)
  assert.equal(resetPage.get('categoryId'), '4')
})

test('oversized search and unrecognized query options are canonicalized without altering literal search characters', () => {
  const params = new URLSearchParams({ search: '%_[' + 'a'.repeat(200), limit: '100', unsupported: 'yes' })
  const filters = readRecipeFilters(params)
  assert.equal(filters.search.length, 150)
  assert.equal(filters.search.startsWith('%_['), true)
  const canonical = createRecipeSearchParams(filters)
  assert.equal(canonical.has('limit'), false)
  assert.equal(canonical.has('unsupported'), false)
  assert.equal(toRecipeApiParams(filters).limit, 12)
})

test('each whitelisted sort is retained and browser navigation can restore prior filters', () => {
  for (const sort of ['newest', 'name_asc', 'name_desc', 'time_asc', 'time_desc']) {
    const filters = readRecipeFilters(new URLSearchParams({ sort }))
    assert.equal(toRecipeApiParams(filters).sort, sort)
  }
  const previous = createRecipeSearchParams({ search: 'trứng', page: 2 })
  const next = createRecipeSearchParams({ search: 'canh', page: 1 })
  assert.equal(readRecipeFilters(next).search, 'canh')
  assert.equal(readRecipeFilters(previous).search, 'trứng')
  assert.equal(readRecipeFilters(previous).page, 2)
})
