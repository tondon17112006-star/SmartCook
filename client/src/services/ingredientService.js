import { api } from './api.js'
import { isIngredientId } from '../utilities/pantryState.js'

const PAGE_LIMIT = 100
const INCONSISTENT_CATALOG = 'Danh sách nguyên liệu vừa thay đổi hoặc phản hồi chưa đầy đủ. Vui lòng thử tải lại trước khi chọn món.'

function assertIngredientPage(body, page, expectedTotal) {
  const meta = body?.pagination
  if (!Array.isArray(body?.data) || !meta
    || meta.page !== page || meta.limit !== PAGE_LIMIT
    || !Number.isSafeInteger(meta.total) || meta.total < 0
    || meta.totalPages !== Math.ceil(meta.total / PAGE_LIMIT)
    || meta.totalPages > 100000
    || meta.hasNextPage !== (page < meta.totalPages)
    || meta.hasPreviousPage !== (page > 1)
    || (expectedTotal !== undefined && meta.total !== expectedTotal)
    || body.data.length !== Math.min(PAGE_LIMIT, Math.max(0, meta.total - (page - 1) * PAGE_LIMIT))) {
    throw new Error(INCONSISTENT_CATALOG)
  }

  for (const ingredient of body.data) {
    if (!isIngredientId(ingredient?.ingredientId)
      || typeof ingredient.ingredientName !== 'string' || !ingredient.ingredientName.trim()
      || typeof ingredient.ingredientCategory !== 'string' || !ingredient.ingredientCategory.trim()
      || typeof ingredient.defaultUnit !== 'string'
      || (ingredient.imageUrl !== null && typeof ingredient.imageUrl !== 'string')) {
      throw new Error(INCONSISTENT_CATALOG)
    }
  }
  return meta
}

/** Every page is read before exposing groups or reconciling saved IDs. */
export async function loadIngredientCatalog(signal, client = api) {
  const ingredients = []
  const seenIds = new Set()
  let total
  let totalPages = 1

  for (let page = 1; page <= totalPages; page += 1) {
    signal?.throwIfAborted()
    const response = await client.get('/ingredients', { params: { page, limit: PAGE_LIMIT }, signal })
    signal?.throwIfAborted()
    const meta = assertIngredientPage(response.data, page, total)
    total = meta.total
    totalPages = meta.totalPages
    for (const ingredient of response.data.data) {
      if (seenIds.has(ingredient.ingredientId)) throw new Error(INCONSISTENT_CATALOG)
      seenIds.add(ingredient.ingredientId)
      ingredients.push(ingredient)
    }
  }

  if (ingredients.length !== total) throw new Error(INCONSISTENT_CATALOG)
  return ingredients
}
