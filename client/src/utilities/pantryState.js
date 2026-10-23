export const PANTRY_STORAGE_KEY = 'smartcook:pantry:v1'
export const PANTRY_VERSION = 1
export const DEFAULT_SERVINGS = 2
export const MAX_PANTRY_INGREDIENTS = 100
export const MAX_INGREDIENT_ID = 2147483647

export const STORAGE_NOTICE = 'Trình duyệt không thể lưu lựa chọn trong phiên này. Bạn vẫn có thể tiếp tục tìm món; lựa chọn có thể mất khi tải lại trang.'
export const INVALID_STORAGE_NOTICE = 'Lựa chọn đã lưu không còn hợp lệ. Bạn hãy chọn lại nguyên liệu cho bữa ăn nhé.'
export const REMOVED_INGREDIENTS_NOTICE = 'Một số nguyên liệu đã lưu không còn trong danh sách hiện tại và đã được bỏ chọn. Bạn hãy kiểm tra lại nguyên liệu trước khi tìm món.'

export function isIngredientId(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_INGREDIENT_ID
}

export function isServings(value) {
  return Number.isInteger(value) && value >= 1 && value <= 20
}

export function createDefaultPantry() {
  return { ingredientIds: [], servings: DEFAULT_SERVINGS }
}

export function isValidPantry(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Array.isArray(value.ingredientIds)
    && value.ingredientIds.length <= MAX_PANTRY_INGREDIENTS
    && value.ingredientIds.every(isIngredientId)
    && new Set(value.ingredientIds).size === value.ingredientIds.length
    && isServings(value.servings)
}

/** Persist only IDs and servings. Names and current availability come from SQL Server. */
export function serializePantry(pantry) {
  if (!isValidPantry(pantry)) throw new TypeError('Lựa chọn nguyên liệu không hợp lệ.')
  return JSON.stringify({ version: PANTRY_VERSION, ingredientIds: pantry.ingredientIds, servings: pantry.servings })
}

export function restorePantry(serialized) {
  if (serialized === null || serialized === undefined) return { pantry: createDefaultPantry(), notice: null }
  try {
    const value = JSON.parse(serialized)
    const keys = value && typeof value === 'object' ? Object.keys(value).sort() : []
    if (value?.version !== PANTRY_VERSION || !isValidPantry(value)
      || keys.join(',') !== 'ingredientIds,servings,version') {
      return { pantry: createDefaultPantry(), notice: INVALID_STORAGE_NOTICE }
    }
    return { pantry: { ingredientIds: [...value.ingredientIds], servings: value.servings }, notice: null }
  } catch {
    return { pantry: createDefaultPantry(), notice: INVALID_STORAGE_NOTICE }
  }
}

export function readPantryStorage(storage) {
  if (!storage) return { pantry: createDefaultPantry(), notice: null }
  try {
    return restorePantry(storage.getItem(PANTRY_STORAGE_KEY))
  } catch {
    return { pantry: createDefaultPantry(), notice: STORAGE_NOTICE }
  }
}

export function writePantryStorage(storage, pantry) {
  if (!storage) return null
  try {
    storage.setItem(PANTRY_STORAGE_KEY, serializePantry(pantry))
    return null
  } catch {
    return STORAGE_NOTICE
  }
}

export function reconcilePantry(pantry, catalog) {
  const availableIds = new Set(catalog.map((ingredient) => ingredient.ingredientId))
  const ingredientIds = pantry.ingredientIds.filter((id) => availableIds.has(id))
  return {
    pantry: { ingredientIds, servings: pantry.servings },
    notice: ingredientIds.length === pantry.ingredientIds.length ? null : REMOVED_INGREDIENTS_NOTICE,
  }
}

export function togglePantryIngredient(pantry, id, availableIds) {
  if (!isIngredientId(id) || !availableIds.has(id)) return pantry
  if (pantry.ingredientIds.includes(id)) {
    return { ...pantry, ingredientIds: pantry.ingredientIds.filter((selectedId) => selectedId !== id) }
  }
  if (pantry.ingredientIds.length >= MAX_PANTRY_INGREDIENTS) return pantry
  return { ...pantry, ingredientIds: [...pantry.ingredientIds, id] }
}

export function ingredientGroups(catalog) {
  return [...new Set(catalog.map((ingredient) => ingredient.ingredientCategory))]
    .sort((first, second) => first.localeCompare(second, 'vi'))
}
