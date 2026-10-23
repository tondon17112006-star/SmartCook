export const SUGGESTION_PAGE_SIZE = 12
export const MAX_FILTER_RESULTS = 500
export const SUGGESTION_FILTERS = [
  { value: 'all', label: 'Tất cả món phù hợp' },
  { value: 'ready', label: 'Đủ loại nguyên liệu bắt buộc' },
  { value: 'missing', label: 'Còn thiếu nguyên liệu' },
]

export class SuggestionCollectionError extends Error {
  constructor(message, code = 'INCOMPLETE_RESULTS') {
    super(message)
    this.name = 'SuggestionCollectionError'
    this.code = code
  }
}

export function validateSuggestionPage(response, page, limit) {
  const pagination = response?.pagination
  if (!Array.isArray(response?.data) || !pagination ||
    pagination.page !== page || pagination.limit !== limit ||
    !Number.isSafeInteger(pagination.total) || pagination.total < 0 ||
    pagination.totalPages !== Math.ceil(pagination.total / limit) ||
    pagination.hasNextPage !== (page < pagination.totalPages) ||
    pagination.hasPreviousPage !== (page > 1) ||
    response.data.length !== Math.max(0, Math.min(limit, pagination.total - (page - 1) * limit)) ||
    new Set(response.data.map((recipe) => recipe.recipeId)).size !== response.data.length ||
    response.data.some((recipe) => !Number.isInteger(recipe?.recipeId) || recipe.recipeId <= 0 || !['ready', 'missing'].includes(recipe.status))) {
    throw new SuggestionCollectionError('Kết quả đã thay đổi hoặc chưa tải đủ. Bạn vui lòng thử lại để xem danh sách chính xác.')
  }
  return response
}

// Filtering is only allowed after all API pages have been checked and collected.
export async function collectSuggestionPages(loadPage, { signal, maxResults = MAX_FILTER_RESULTS } = {}) {
  const limit = 50
  signal?.throwIfAborted()
  const first = validateSuggestionPage(await loadPage(1, limit), 1, limit)
  if (first.pagination.total > maxResults) {
    throw new SuggestionCollectionError(`Có hơn ${maxResults} món phù hợp. Bộ lọc trạng thái cần được bổ sung ở API để xử lý toàn bộ dữ liệu; hiện bạn vẫn có thể xem tất cả món theo từng trang.`, 'FILTER_LIMIT')
  }
  const data = [...first.data]
  const seen = new Set(data.map((recipe) => recipe.recipeId))
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    signal?.throwIfAborted()
    const response = validateSuggestionPage(await loadPage(page, limit), page, limit)
    if (response.pagination.total !== first.pagination.total || response.data.some((recipe) => seen.has(recipe.recipeId))) {
      throw new SuggestionCollectionError('Danh sách món đã thay đổi khi đang tải. Bạn vui lòng thử lại; bộ lọc chưa được áp dụng lên dữ liệu chưa đầy đủ.')
    }
    for (const recipe of response.data) seen.add(recipe.recipeId)
    data.push(...response.data)
  }
  signal?.throwIfAborted()
  return { data, pagination: first.pagination, complete: true }
}

export function filterSuggestionCollection(collection, status, requestedPage, limit = SUGGESTION_PAGE_SIZE) {
  if (!collection?.complete || collection.data.length !== collection.pagination.total) {
    throw new SuggestionCollectionError('Chưa có toàn bộ kết quả để lọc theo trạng thái.')
  }
  if (!SUGGESTION_FILTERS.some((option) => option.value === status)) throw new Error('Bộ lọc trạng thái chưa hợp lệ.')
  const filtered = status === 'all' ? collection.data : collection.data.filter((recipe) => recipe.status === status)
  const total = filtered.length
  const totalPages = Math.ceil(total / limit)
  const page = Math.max(1, Math.min(Number.isSafeInteger(requestedPage) ? requestedPage : 1, Math.max(1, totalPages)))
  return {
    data: filtered.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    unfilteredTotal: collection.pagination.total,
  }
}
