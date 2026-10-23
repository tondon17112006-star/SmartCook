export const COOKING_VERSION = 1
export const COOKING_STORAGE_PREFIX = 'smartcook:cooking:v1:'
export const COOKING_STORAGE_NOTICE = 'Trình duyệt không thể lưu tiến độ trong phiên này. Bạn vẫn có thể nấu; tiến độ có thể mất khi tải lại trang.'
export const INVALID_COOKING_NOTICE = 'Tiến độ đã lưu không còn hợp lệ. Công thức đã được mở lại từ đầu.'
export const UPDATED_COOKING_NOTICE = 'Công thức đã thay đổi. Tiến độ của nguyên liệu hoặc bước không còn trong công thức đã được bỏ.'
export const INVALID_SERVINGS_NOTICE = 'Khẩu phần gốc của công thức chưa hợp lệ. Hiện giữ định lượng gốc và tạm thời không thể điều chỉnh số người ăn.'
export const LIMITED_SERVINGS_NOTICE = 'Công thức gốc dành cho hơn 20 người. Lựa chọn ban đầu giới hạn ở 20 người; định lượng vẫn được tính theo khẩu phần gốc.'

export function isCookingId(value) {
  return Number.isInteger(value) && value > 0 && value <= 2147483647
}

export function isCookingServings(value) {
  return Number.isInteger(value) && value >= 1 && value <= 20
}

function isSuggestionEntry(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
}

function uniqueItems(items, idField) {
  const seen = new Set()
  return (Array.isArray(items) ? items : []).filter((item) => {
    const id = item?.[idField]
    if (!isCookingId(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function getCookingIngredients(recipe) {
  return uniqueItems(recipe?.ingredients, 'ingredientId')
}

export function sortCookingSteps(steps) {
  return uniqueItems(steps, 'stepId').sort((first, second) => {
    const firstNumber = Number.isSafeInteger(first.stepNumber) && first.stepNumber > 0 ? first.stepNumber : Number.MAX_SAFE_INTEGER
    const secondNumber = Number.isSafeInteger(second.stepNumber) && second.stepNumber > 0 ? second.stepNumber : Number.MAX_SAFE_INTEGER
    return firstNumber - secondNumber || first.stepId - second.stepId
  })
}

export function getCookingServings(recipe) {
  const original = recipe?.servings
  if (!Number.isSafeInteger(original) || original <= 0) {
    return { servings: null, canScale: false, scalingNotice: INVALID_SERVINGS_NOTICE }
  }
  return {
    servings: Math.min(original, 20),
    canScale: true,
    scalingNotice: original > 20 ? LIMITED_SERVINGS_NOTICE : null,
  }
}

export function getCookingStorageKey(recipeId) {
  return isCookingId(recipeId) ? `${COOKING_STORAGE_PREFIX}${recipeId}` : null
}

/** Every calculation starts from the API quantity, never a previous display value. */
export function adjustCookingQuantity(quantity, selectedServings, originalServings) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return null
  const canScale = Number.isSafeInteger(originalServings) && originalServings > 0
  if (canScale && !isCookingServings(selectedServings)) return null
  const adjusted = canScale ? quantity * (selectedServings / originalServings) : quantity
  if (!Number.isFinite(adjusted) || adjusted <= 0) return null
  const rounded = Number(adjusted.toPrecision(12))
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null
}

export function getAdjustedCookingIngredients(recipe, servings) {
  return getCookingIngredients(recipe).map((ingredient) => ({
    ...ingredient,
    adjustedQuantity: adjustCookingQuantity(ingredient.quantity, servings, recipe?.servings),
  }))
}

export function createCookingProgress(recipe) {
  return {
    recipeId: recipe?.recipeId,
    servings: getCookingServings(recipe).servings,
    preparedIds: [],
    completedIds: [],
    currentStepId: sortCookingSteps(recipe?.steps)[0]?.stepId ?? null,
    lastSuggestionEntry: null,
  }
}

function isIdList(value) {
  return Array.isArray(value) && value.length <= 10000 && value.every(isCookingId) && new Set(value).size === value.length
}

function isCookingProgress(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && isCookingId(value.recipeId)
    && (value.servings === null || isCookingServings(value.servings))
    && isIdList(value.preparedIds) && isIdList(value.completedIds)
    && (value.currentStepId === null || isCookingId(value.currentStepId))
    && (value.lastSuggestionEntry === null || isSuggestionEntry(value.lastSuggestionEntry))
}

export function reconcileCookingProgress(progress, recipe) {
  if (!isCookingProgress(progress) || progress.recipeId !== recipe?.recipeId) {
    return { progress: createCookingProgress(recipe), notice: INVALID_COOKING_NOTICE }
  }
  const ingredients = new Set(getCookingIngredients(recipe).map((item) => item.ingredientId))
  const steps = sortCookingSteps(recipe?.steps)
  const stepIds = new Set(steps.map((step) => step.stepId))
  const preparedIds = progress.preparedIds.filter((id) => ingredients.has(id))
  const completedIds = progress.completedIds.filter((id) => stepIds.has(id))
  const currentStepId = stepIds.has(progress.currentStepId) ? progress.currentStepId : steps[0]?.stepId ?? null
  const defaults = getCookingServings(recipe)
  const servings = defaults.canScale && isCookingServings(progress.servings) ? progress.servings : defaults.servings
  const changed = preparedIds.length !== progress.preparedIds.length || completedIds.length !== progress.completedIds.length
    || (progress.currentStepId !== null && currentStepId !== progress.currentStepId)
  return {
    progress: { ...progress, servings, preparedIds, completedIds, currentStepId },
    notice: changed ? UPDATED_COOKING_NOTICE : null,
  }
}

/** A new Suggestions history entry wins once; a reload of that entry keeps edits. */
export function applySuggestedCookingServings(progress, recipe, { suggestedServings, entryKey } = {}, { hasSavedProgress = true } = {}) {
  if (!getCookingServings(recipe).canScale || !isCookingServings(suggestedServings)) return progress
  const entry = isSuggestionEntry(entryKey) ? entryKey : null
  if ((entry && entry !== progress.lastSuggestionEntry) || (!entry && !hasSavedProgress)) {
    return { ...progress, servings: suggestedServings, lastSuggestionEntry: entry }
  }
  return progress
}

export function serializeCookingProgress(progress) {
  if (!isCookingProgress(progress)) throw new TypeError('Tiến độ nấu ăn không hợp lệ.')
  return JSON.stringify({
    version: COOKING_VERSION,
    recipeId: progress.recipeId,
    servings: progress.servings,
    preparedIds: progress.preparedIds,
    completedIds: progress.completedIds,
    currentStepId: progress.currentStepId,
    lastSuggestionEntry: progress.lastSuggestionEntry,
  })
}

export function restoreCookingProgress(serialized, recipe, options = {}) {
  const fallback = () => applySuggestedCookingServings(createCookingProgress(recipe), recipe, options, { hasSavedProgress: false })
  if (serialized === null || serialized === undefined) return { progress: fallback(), notice: null }
  try {
    const value = JSON.parse(serialized)
    const keys = value && typeof value === 'object' ? Object.keys(value).sort().join(',') : ''
    if (value?.version !== COOKING_VERSION || !isCookingProgress(value) || value.recipeId !== recipe?.recipeId
      || keys !== 'completedIds,currentStepId,lastSuggestionEntry,preparedIds,recipeId,servings,version') {
      return { progress: fallback(), notice: INVALID_COOKING_NOTICE }
    }
    const { version: _version, ...stored } = value
    const reconciled = reconcileCookingProgress(stored, recipe)
    return { ...reconciled, progress: applySuggestedCookingServings(reconciled.progress, recipe, options) }
  } catch {
    return { progress: fallback(), notice: INVALID_COOKING_NOTICE }
  }
}

export function readCookingStorage(storage, recipe, options) {
  const key = getCookingStorageKey(recipe?.recipeId)
  if (!storage || !key) return restoreCookingProgress(null, recipe, options)
  try {
    return restoreCookingProgress(storage.getItem(key), recipe, options)
  } catch {
    return { ...restoreCookingProgress(null, recipe, options), notice: COOKING_STORAGE_NOTICE }
  }
}

export function writeCookingStorage(storage, progress) {
  const key = getCookingStorageKey(progress.recipeId)
  if (!storage || !key) return null
  try {
    storage.setItem(key, serializeCookingProgress(progress))
    return null
  } catch {
    return COOKING_STORAGE_NOTICE
  }
}

export function resetCookingProgress(progress, recipe) {
  const reconciled = reconcileCookingProgress(progress, recipe).progress
  return { ...reconciled, preparedIds: [], completedIds: [], currentStepId: sortCookingSteps(recipe?.steps)[0]?.stepId ?? null }
}

export function toggleCookingProgressId(progress, recipe, field, id) {
  if (!isCookingId(id) || progress.recipeId !== recipe?.recipeId) return progress
  const availableIds = field === 'preparedIds'
    ? getCookingIngredients(recipe).map((ingredient) => ingredient.ingredientId)
    : field === 'completedIds' ? sortCookingSteps(recipe?.steps).map((step) => step.stepId) : []
  if (!availableIds.includes(id)) return progress
  return {
    ...progress,
    [field]: progress[field].includes(id) ? progress[field].filter((selectedId) => selectedId !== id) : [...progress[field], id],
  }
}

/** Track only fields that affect progress; API names and quantities stay live. */
export function getCookingScope(recipe, { suggestedServings, entryKey } = {}) {
  return JSON.stringify([
    recipe?.recipeId ?? null,
    Number.isSafeInteger(recipe?.servings) ? recipe.servings : null,
    getCookingIngredients(recipe).map((ingredient) => ingredient.ingredientId),
    sortCookingSteps(recipe?.steps).map((step) => step.stepId),
    isCookingServings(suggestedServings) ? suggestedServings : null,
    isSuggestionEntry(entryKey) ? entryKey : null,
  ])
}
