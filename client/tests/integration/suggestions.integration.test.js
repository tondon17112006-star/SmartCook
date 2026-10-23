import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let vite
let ingredientService
let suggestionService
let catalogService
let utilities
let ingredients
let selection
let firstPage

before(async () => {
  vite = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  const { api } = await vite.ssrLoadModule('/src/services/api.js')
  api.defaults.baseURL = process.env.SMARTCOOK_TEST_API_URL || 'http://127.0.0.1:5000/api'
  ingredientService = await vite.ssrLoadModule('/src/services/ingredientService.js')
  suggestionService = await vite.ssrLoadModule('/src/services/suggestionService.js')
  catalogService = await vite.ssrLoadModule('/src/services/catalogService.js')
  utilities = await vite.ssrLoadModule('/src/utilities/suggestions.js')
  ingredients = await ingredientService.loadIngredientCatalog()
  const ids = ['Trứng gà', 'Dầu ăn', 'Cà chua'].map((name) => {
    const ingredient = ingredients.find((item) => item.ingredientName === name)
    assert.ok(ingredient, `Thiếu nguyên liệu kiểm chứng trong SQL Server: ${name}`)
    return ingredient.ingredientId
  })
  selection = { ingredientIds: ids, servings: 4 }
})

after(async () => { await vite?.close() })

test('real ingredient service reads the complete SQL catalog and current group labels', () => {
  assert.equal(ingredients.length, 64)
  assert.equal(new Set(ingredients.map((item) => item.ingredientId)).size, 64)
  assert.equal(new Set(ingredients.map((item) => item.ingredientCategory)).size, 12)
})

test('real POST sends resolved numeric IDs, returns 13 recipes and adjusted quantities for four', async () => {
  assert.ok(selection.ingredientIds.every(Number.isInteger))
  firstPage = await suggestionService.suggestRecipes({ ...selection, page: 1, limit: 12 })
  assert.equal(firstPage.pagination.total, 13)
  assert.equal(firstPage.pagination.totalPages, 2)
  assert.equal(firstPage.data.length, 12)
  const first = firstPage.data[0]
  assert.equal(first.recipeName, 'Trứng chiên')
  assert.equal(first.status, 'ready')
  assert.equal(first.matchPercentage, 100)
  assert.equal(first.matchedRequiredCount, 2)
  assert.equal(first.missingRequiredCount, 0)
  assert.equal(first.requestedServings, 4)
  const egg = first.matchedIngredients.find((item) => item.ingredientName === 'Trứng gà')
  const oil = first.matchedIngredients.find((item) => item.ingredientName === 'Dầu ăn')
  assert.deepEqual([egg.quantity, egg.adjustedQuantity, egg.unit], [3, 6, 'quả'])
  assert.deepEqual([oil.quantity, oil.adjustedQuantity, oil.unit], [15, 30, 'ml'])
})

test('real server pagination has no repeated recipe; out-of-range requests resolve to the last page', async () => {
  const next = await suggestionService.getSuggestionPage(selection, 2)
  assert.equal(next.pagination.page, 2)
  assert.equal(next.data.length, 1)
  assert.ok(!firstPage.data.some((item) => item.recipeId === next.data[0].recipeId))
  const clamped = await suggestionService.getSuggestionPage(selection, 100000)
  assert.equal(clamped.pagination.page, 2)
  assert.deepEqual(clamped.data.map((item) => item.recipeId), next.data.map((item) => item.recipeId))
})

test('status filters use all 13 real recipes and preserve the complete result total', async () => {
  const collection = await suggestionService.getCompleteSuggestions(selection)
  assert.equal(collection.complete, true)
  assert.equal(collection.data.length, 13)
  const ready = utilities.filterSuggestionCollection(collection, 'ready', 1)
  const missing = utilities.filterSuggestionCollection(collection, 'missing', 1)
  assert.equal(ready.pagination.total + missing.pagination.total, 13)
  assert.ok(ready.data.every((item) => item.status === 'ready' && item.missingRequiredCount === 0))
  assert.ok(missing.data.every((item) => item.status === 'missing' && item.missingRequiredCount > 0))
  assert.equal(ready.unfilteredTotal, 13)
  assert.equal(missing.unfilteredTotal, 13)
  console.log(`SQL filter totals: ready=${ready.pagination.total}, missing=${missing.pagination.total}`)
})

test('without oil the tomato and egg recipe is missing, shows 67%, and retains adjusted missing oil', async () => {
  const oilId = ingredients.find((item) => item.ingredientName === 'Dầu ăn').ingredientId
  const collection = await suggestionService.getCompleteSuggestions({ ingredientIds: selection.ingredientIds.filter((id) => id !== oilId), servings: 4 })
  const recipe = collection.data.find((item) => item.recipeName === 'Trứng xào cà chua')
  assert.ok(recipe)
  assert.equal(recipe.matchPercentage, 67)
  assert.equal(recipe.status, 'missing')
  assert.equal(recipe.missingRequiredCount, 1)
  assert.equal(recipe.missingIngredients[0].ingredientName, 'Dầu ăn')
  assert.equal(recipe.missingIngredients[0].adjustedQuantity, 30)
})

test('recipe detail API and existing category/recipe services remain compatible', async () => {
  const recipeId = firstPage.data[0].recipeId
  const detail = (await catalogService.getRecipe(recipeId)).data
  assert.equal(detail.recipeId, recipeId)
  assert.ok(detail.ingredients.length && detail.steps.length)
  assert.equal(detail.ingredients.find((item) => item.ingredientName === 'Trứng gà').quantity, 3)
  assert.equal((await catalogService.getCategories()).data.length, 8)
  assert.equal((await catalogService.getRecipes({ limit: 1 })).pagination.total, 20)
})

test('valid zero-match IDs return empty metadata; cancellation and validation errors are preserved', async () => {
  const scallionId = ingredients.find((item) => item.ingredientName === 'Hành lá').ingredientId
  const empty = await suggestionService.getSuggestionPage({ ingredientIds: [scallionId], servings: 2 }, 1)
  assert.equal(empty.pagination.total, 0)
  assert.deepEqual(empty.data, [])
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => suggestionService.getCompleteSuggestions(selection, { signal: controller.signal }), { name: 'AbortError' })
  await assert.rejects(() => suggestionService.suggestRecipes({ ingredientIds: [], servings: 4 }), (error) => error.response?.status === 400)
})
