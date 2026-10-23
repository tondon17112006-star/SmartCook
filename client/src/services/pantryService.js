import { api } from './api.js'
import { authenticatedRequest } from './authenticatedRequest.js'
import { isIngredientId } from '../utilities/pantryState.js'
import { validDate } from '../utilities/myPantry.js'

const LIMIT = 100
const MAX_ITEMS = 10000
const INVALID = 'Tủ nguyên liệu vừa thay đổi hoặc dữ liệu chưa đầy đủ. Vui lòng tải lại; hệ thống chưa dùng danh sách một phần để tìm món.'

export function isPantryItem(item) {
  return item && isIngredientId(item.userIngredientId) && isIngredientId(item.ingredientId)
    && typeof item.ingredientName === 'string' && item.ingredientName.trim().length > 0
    && typeof item.ingredientCategory === 'string' && item.ingredientCategory.trim().length > 0
    && typeof item.defaultUnit === 'string'
    && (item.imageUrl === null || typeof item.imageUrl === 'string')
    && (item.quantity === null || (typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 9_999_999_999.99 && Number(item.quantity.toFixed(2)) === item.quantity))
    && (item.unit === null || (typeof item.unit === 'string' && item.unit.length > 0 && item.unit.length <= 30 && item.unit === item.unit.trim().normalize('NFC') && !/[\p{Cc}\p{Cf}<>]/u.test(item.unit)))
    && (item.quantity === null || item.unit !== null)
    && (item.expiryDate === null || validDate(item.expiryDate))
}

/** Expose data only after every page passes validation. Never retain private SQL data in Web Storage. */
export async function getPantry({ signal } = {}) {
  let total, totalPages = 1
  const items = [], ids = new Set(), ingredientIds = new Set()
  for (let page = 1; page <= totalPages; page += 1) {
    signal?.throwIfAborted()
    const { data: body } = await api.get('/pantry', { params: { page, limit: LIMIT }, signal })
    signal?.throwIfAborted()
    const meta = body?.pagination
    if (!Array.isArray(body?.data) || !meta || meta.page !== page || meta.limit !== LIMIT
      || !Number.isSafeInteger(meta.total) || meta.total < 0 || meta.total > MAX_ITEMS
      || meta.totalPages !== Math.ceil(meta.total / LIMIT)
      || meta.hasNextPage !== (page < meta.totalPages) || meta.hasPreviousPage !== (page > 1)
      || (total !== undefined && meta.total !== total)
      || body.data.length !== Math.min(LIMIT, Math.max(0, meta.total - (page - 1) * LIMIT))) throw new Error(INVALID)
    total = meta.total; totalPages = meta.totalPages
    for (const item of body.data) {
      if (!isPantryItem(item) || ids.has(item.userIngredientId) || ingredientIds.has(item.ingredientId)) throw new Error(INVALID)
      ids.add(item.userIngredientId); ingredientIds.add(item.ingredientId); items.push(item)
    }
  }
  if (items.length !== total) throw new Error(INVALID)
  return items
}

async function save(method, path, data, options) {
  const result = await authenticatedRequest(method, path, data, options)
  if (!isPantryItem(result?.data)) throw new Error(INVALID)
  return result.data
}
export function createPantryItem(data, options) { return save('post', '/pantry', data, options) }
export function updatePantryItem(id, data, options) { return save('patch', `/pantry/${encodeURIComponent(id)}`, data, options) }
export function deletePantryItem(id, options) { return authenticatedRequest('delete', `/pantry/${encodeURIComponent(id)}`, {}, options) }
