export const RECIPE_PAGE_SIZE = 12

export const RECIPE_SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'name_asc', label: 'Tên món: A → Z' },
  { value: 'name_desc', label: 'Tên món: Z → A' },
  { value: 'time_asc', label: 'Thời gian: nhanh trước' },
  { value: 'time_desc', label: 'Thời gian: lâu trước' },
]

export const RECIPE_DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó']

function singleValue(params, key) {
  const values = params.getAll(key)
  return values.length === 1 ? values[0] : ''
}

function positiveInteger(value, maximum) {
  return /^[1-9]\d*$/.test(value) && Number(value) <= maximum ? value : ''
}

// The browser accepts links from outside the app. Canonicalize them before
// creating API parameters so duplicate or malformed values never reach SQL APIs.
export function readRecipeFilters(input) {
  const params = new URLSearchParams(input)
  const difficulty = singleValue(params, 'difficulty').trim().normalize('NFC')
  const sort = singleValue(params, 'sort')

  return {
    search: singleValue(params, 'search').trim().normalize('NFC').slice(0, 150),
    categoryId: positiveInteger(singleValue(params, 'categoryId'), 2147483647),
    maxTime: positiveInteger(singleValue(params, 'maxTime'), 2147483647),
    difficulty: RECIPE_DIFFICULTIES.includes(difficulty) ? difficulty : '',
    sort: RECIPE_SORT_OPTIONS.some((option) => option.value === sort) ? sort : 'newest',
    page: Number(positiveInteger(singleValue(params, 'page'), 100000) || 1),
  }
}

export function createRecipeSearchParams(filters = {}) {
  const input = new URLSearchParams()
  for (const key of ['search', 'categoryId', 'maxTime', 'difficulty', 'sort', 'page']) {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      input.set(key, String(filters[key]))
    }
  }

  const normalized = readRecipeFilters(input)
  const params = new URLSearchParams()
  for (const key of ['search', 'categoryId', 'maxTime', 'difficulty']) {
    if (normalized[key]) params.set(key, normalized[key])
  }
  if (normalized.sort !== 'newest') params.set('sort', normalized.sort)
  if (normalized.page !== 1) params.set('page', String(normalized.page))
  return params
}

export function toRecipeApiParams(filters) {
  const params = Object.fromEntries(createRecipeSearchParams(filters))
  return {
    ...params,
    sort: params.sort || 'newest',
    page: Number(params.page || 1),
    limit: RECIPE_PAGE_SIZE,
  }
}
