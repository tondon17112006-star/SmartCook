import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adjustCookingQuantity,
  applySuggestedCookingServings,
  COOKING_STORAGE_NOTICE,
  createCookingProgress,
  getAdjustedCookingIngredients,
  getCookingIngredients,
  getCookingScope,
  getCookingServings,
  getCookingStorageKey,
  INVALID_COOKING_NOTICE,
  INVALID_SERVINGS_NOTICE,
  isCookingId,
  isCookingServings,
  LIMITED_SERVINGS_NOTICE,
  readCookingStorage,
  reconcileCookingProgress,
  resetCookingProgress,
  restoreCookingProgress,
  serializeCookingProgress,
  sortCookingSteps,
  toggleCookingProgressId,
  UPDATED_COOKING_NOTICE,
  writeCookingStorage,
} from '../src/utilities/recipeCooking.js'

function recipe(overrides = {}) {
  return {
    recipeId: 17,
    recipeName: 'Tên chỉ dùng trong bộ kiểm thử',
    servings: 2,
    ingredients: [
      { ingredientId: 64, ingredientName: 'Trứng kiểm thử', quantity: 3, unit: 'quả', isRequired: true },
      { ingredientId: 18, ingredientName: 'Dầu kiểm thử', quantity: 15, unit: 'ml', isRequired: false },
    ],
    steps: [
      { stepId: 113, stepNumber: 3, instruction: 'Nội dung ba trong bộ kiểm thử.' },
      { stepId: 111, stepNumber: 1, instruction: 'Nội dung một trong bộ kiểm thử.' },
      { stepId: 112, stepNumber: 2, instruction: 'Nội dung hai trong bộ kiểm thử.' },
    ],
    ...overrides,
  }
}

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  }
}

test('fresh recipe progress follows API servings and first StepNumber, without shared mutable arrays', () => {
  const value = recipe()
  const first = createCookingProgress(value)
  assert.deepEqual(first, { recipeId: 17, servings: 2, preparedIds: [], completedIds: [], currentStepId: 111, lastSuggestionEntry: null })
  first.preparedIds.push(64)
  assert.deepEqual(createCookingProgress(value).preparedIds, [])
  assert.deepEqual(restoreCookingProgress(null, value), { progress: createCookingProgress(value), notice: null })
})

test('sorting uses backend StepNumber without mutating its array and excludes duplicate or invalid step IDs', () => {
  const value = recipe()
  assert.deepEqual(sortCookingSteps(value.steps).map((step) => step.stepId), [111, 112, 113])
  assert.deepEqual(value.steps.map((step) => step.stepId), [113, 111, 112])
  assert.deepEqual(sortCookingSteps([...value.steps, value.steps[0], { stepId: 0, stepNumber: 0 }, { stepId: 114, stepNumber: null }]).map((step) => step.stepId), [111, 112, 113, 114])
  assert.deepEqual(sortCookingSteps(null), [])
})

test('valid quantities always scale from original numbers for 2 to 4 to 3 servings', () => {
  const value = recipe()
  assert.deepEqual(getAdjustedCookingIngredients(value, 2).map((item) => item.adjustedQuantity), [3, 15])
  assert.deepEqual(getAdjustedCookingIngredients(value, 4).map((item) => item.adjustedQuantity), [6, 30])
  assert.deepEqual(getAdjustedCookingIngredients(value, 3).map((item) => item.adjustedQuantity), [4.5, 22.5])
  assert.deepEqual(value.ingredients.map((item) => item.quantity), [3, 15])
  assert.deepEqual(getAdjustedCookingIngredients(value, 3).map((item) => item.unit), ['quả', 'ml'])
})

test('precision is bounded to 12 significant digits while tiny positive amounts remain nonzero', () => {
  assert.equal(adjustCookingQuantity(1, 1, 3), 0.333333333333)
  assert.equal(adjustCookingQuantity(0.1, 3, 2), 0.15)
  assert.equal(adjustCookingQuantity(1e-300, 1, 20), 5e-302)
  assert.equal(adjustCookingQuantity(0.000000004, 1, 2), 0.000000002)
})

test('invalid or overflowing quantities never yield NaN, Infinity, negatives or coerced numbers', () => {
  for (const quantity of [null, undefined, NaN, Infinity, -Infinity, -1, 0, '3', true]) assert.equal(adjustCookingQuantity(quantity, 2, 2), null)
  assert.equal(adjustCookingQuantity(Number.MAX_VALUE, 20, 1), null)
  for (const servings of [null, undefined, NaN, Infinity, -1, 0, 21, '2', true, 2.5]) assert.equal(adjustCookingQuantity(3, servings, 2), null)
})

test('invalid original servings disable scaling and retain only valid original quantities', () => {
  for (const original of [0, -1, 1.5, null, undefined, '2', true, NaN, Infinity]) {
    const value = recipe({ servings: original })
    assert.deepEqual(getCookingServings(value), { servings: null, canScale: false, scalingNotice: INVALID_SERVINGS_NOTICE })
    assert.equal(createCookingProgress(value).servings, null)
    assert.deepEqual(getAdjustedCookingIngredients(value, null).map((item) => item.adjustedQuantity), [3, 15])
    const progress = applySuggestedCookingServings(createCookingProgress(value), value, { suggestedServings: 4, entryKey: 'suggestion' })
    assert.equal(progress.servings, null)
  }
  assert.equal(adjustCookingQuantity(null, null, 0), null)
})

test('valid original servings above UI maximum start at 20 and continue to use original denominator', () => {
  const value = recipe({ servings: 30 })
  assert.deepEqual(getCookingServings(value), { servings: 20, canScale: true, scalingNotice: LIMITED_SERVINGS_NOTICE })
  assert.equal(createCookingProgress(value).servings, 20)
  assert.equal(getAdjustedCookingIngredients(value, 20)[0].adjustedQuantity, 2)
  assert.equal(getAdjustedCookingIngredients(value, 1)[0].adjustedQuantity, 0.1)
})

test('ID/servings checks preserve numeric types, SQL INT range and 1–20 UI bounds', () => {
  for (const id of [0, -1, 2.5, null, true, '1', NaN, Infinity, 2147483648]) assert.equal(isCookingId(id), false)
  for (const id of [1, 2147483647]) assert.equal(isCookingId(id), true)
  for (const servings of [0, -1, 21, 1.5, null, true, '2', NaN, Infinity]) assert.equal(isCookingServings(servings), false)
  for (const servings of [1, 2, 20]) assert.equal(isCookingServings(servings), true)
})

test('storage round trip contains only version, recipe/ingredient/step IDs, servings and navigation entry', () => {
  const value = recipe()
  const progress = { ...createCookingProgress(value), servings: 4, preparedIds: [64], completedIds: [111], currentStepId: 112, lastSuggestionEntry: 'entry-1', recipeName: 'must not persist', instructions: ['must not persist'] }
  const serialized = serializeCookingProgress(progress)
  assert.deepEqual(JSON.parse(serialized), { version: 1, recipeId: 17, servings: 4, preparedIds: [64], completedIds: [111], currentStepId: 112, lastSuggestionEntry: 'entry-1' })
  const { recipeName: _name, instructions: _instructions, ...expected } = progress
  assert.deepEqual(restoreCookingProgress(serialized, value), { progress: expected, notice: null })
})

test('malformed, outdated, foreign or structurally incompatible saved progress resets safely', () => {
  const value = recipe()
  const initial = JSON.parse(serializeCookingProgress(createCookingProgress(value)))
  const invalid = ['broken', '', 'null', '[]', 'true', '{}',
    ...[
      { version: 2 }, { recipeId: 18 }, { servings: '2' }, { servings: 0 }, { servings: 21 },
      { preparedIds: [64, 64] }, { completedIds: ['111'] }, { currentStepId: '111' },
      { lastSuggestionEntry: '' }, { lastSuggestionEntry: true }, { recipeName: 'unexpected payload' },
    ].map((overrides) => JSON.stringify({ ...initial, ...overrides })),
  ]
  for (const serialized of invalid) assert.deepEqual(restoreCookingProgress(serialized, value), { progress: createCookingProgress(value), notice: INVALID_COOKING_NOTICE }, serialized)
  assert.throws(() => serializeCookingProgress({ ...createCookingProgress(value), preparedIds: [64, 64] }), TypeError)
})

test('reconciliation removes stale IDs, preserves valid progress/servings, and falls back to first ordered step', () => {
  const value = recipe()
  const progress = { ...createCookingProgress(value), servings: 7, preparedIds: [64, 999], completedIds: [111, 998], currentStepId: 998 }
  const result = reconcileCookingProgress(progress, value)
  assert.deepEqual(result.progress, { ...progress, preparedIds: [64], completedIds: [111], currentStepId: 111 })
  assert.equal(result.notice, UPDATED_COOKING_NOTICE)
  assert.deepEqual(progress.preparedIds, [64, 999], 'stored input is not mutated')
  assert.equal(reconcileCookingProgress(result.progress, value).notice, null)
  const noSteps = reconcileCookingProgress(result.progress, recipe({ steps: [], ingredients: [] }))
  assert.deepEqual(noSteps.progress.preparedIds, [])
  assert.deepEqual(noSteps.progress.completedIds, [])
  assert.equal(noSteps.progress.currentStepId, null)
})

test('when API original servings become invalid, saved servings no longer allow scaling', () => {
  const value = recipe()
  const saved = serializeCookingProgress({ ...createCookingProgress(value), servings: 4, preparedIds: [64] })
  const restored = restoreCookingProgress(saved, recipe({ servings: 0 }))
  assert.equal(restored.progress.servings, null)
  assert.deepEqual(restored.progress.preparedIds, [64])
  assert.equal(getAdjustedCookingIngredients(recipe({ servings: 0 }), restored.progress.servings)[0].adjustedQuantity, 3)
})

test('checklist toggles are independent, immutable, reversible and reject IDs outside the current API recipe', () => {
  const value = recipe()
  const initial = createCookingProgress(value)
  const prepared = toggleCookingProgressId(initial, value, 'preparedIds', 64)
  const completed = toggleCookingProgressId(prepared, value, 'completedIds', 111)
  assert.deepEqual(initial.preparedIds, [])
  assert.deepEqual(completed.preparedIds, [64])
  assert.deepEqual(completed.completedIds, [111])
  assert.deepEqual(toggleCookingProgressId(completed, value, 'preparedIds', 64).preparedIds, [])
  assert.deepEqual(toggleCookingProgressId(completed, value, 'completedIds', 111).completedIds, [])
  assert.equal(toggleCookingProgressId(completed, value, 'preparedIds', 111), completed)
  assert.equal(toggleCookingProgressId(completed, value, 'completedIds', '111'), completed)
  assert.equal(toggleCookingProgressId(completed, value, 'otherField', 111), completed)
  assert.equal(toggleCookingProgressId(completed, recipe({ recipeId: 18 }), 'completedIds', 111), completed)
})

test('recipe IDs have independent storage and direct links recover each recipe without importing another one', () => {
  const storage = memoryStorage()
  const first = recipe()
  const second = recipe({ recipeId: 18 })
  const firstProgress = { ...createCookingProgress(first), preparedIds: [64], completedIds: [111], servings: 4 }
  const secondProgress = { ...createCookingProgress(second), preparedIds: [18], completedIds: [113], servings: 3 }
  assert.equal(writeCookingStorage(storage, firstProgress), null)
  assert.equal(writeCookingStorage(storage, secondProgress), null)
  assert.equal(storage.values.size, 2)
  assert.equal(getCookingStorageKey(17), 'smartcook:cooking:v1:17')
  assert.equal(getCookingStorageKey(0), null)
  assert.deepEqual(readCookingStorage(storage, first).progress, firstProgress)
  assert.deepEqual(readCookingStorage(storage, second).progress, secondProgress)
  assert.deepEqual(readCookingStorage(storage, recipe({ recipeId: 19 })).progress, createCookingProgress(recipe({ recipeId: 19 })))
})

test('reset clears only current recipe checklists/current step and retains servings and suggestion entry', () => {
  const storage = memoryStorage()
  const first = recipe()
  const second = recipe({ recipeId: 18 })
  const initial = { ...createCookingProgress(first), preparedIds: [64], completedIds: [111, 112], currentStepId: 113, servings: 6, lastSuggestionEntry: 'entry-2' }
  const other = { ...createCookingProgress(second), completedIds: [112], servings: 3 }
  writeCookingStorage(storage, initial)
  writeCookingStorage(storage, other)
  const reset = resetCookingProgress(initial, first)
  writeCookingStorage(storage, reset)
  assert.deepEqual(reset, { ...initial, preparedIds: [], completedIds: [], currentStepId: 111 })
  assert.deepEqual(readCookingStorage(storage, second).progress, other)
})

test('fresh valid suggestion servings override defaults; valid new entry overrides saved servings once', () => {
  const value = recipe()
  const fresh = restoreCookingProgress(null, value, { suggestedServings: 4, entryKey: 'entry-1' }).progress
  assert.equal(fresh.servings, 4)
  assert.equal(fresh.lastSuggestionEntry, 'entry-1')
  const saved = { ...fresh, servings: 3, completedIds: [111] }
  const next = restoreCookingProgress(serializeCookingProgress(saved), value, { suggestedServings: 6, entryKey: 'entry-2' }).progress
  assert.equal(next.servings, 6)
  assert.equal(next.lastSuggestionEntry, 'entry-2')
  assert.deepEqual(next.completedIds, [111])
})

test('reloading the same Suggestions entry preserves manual servings and direct links preserve saved progress', () => {
  const value = recipe()
  const progress = { ...createCookingProgress(value), servings: 3, lastSuggestionEntry: 'same-entry', preparedIds: [64], completedIds: [112], currentStepId: 113 }
  const serialized = serializeCookingProgress(progress)
  assert.deepEqual(restoreCookingProgress(serialized, value, { suggestedServings: 4, entryKey: 'same-entry' }).progress, progress)
  assert.deepEqual(restoreCookingProgress(serialized, value).progress, progress)
  assert.deepEqual(restoreCookingProgress(serialized, value, { suggestedServings: 0, entryKey: 'different-entry' }).progress, progress)
  assert.deepEqual(restoreCookingProgress(serialized, value, { suggestedServings: '4', entryKey: 'different-entry' }).progress, progress)
})

test('suggested servings without a history key apply only to a fresh recipe, avoiding reload clobbering', () => {
  const value = recipe()
  assert.equal(restoreCookingProgress(null, value, { suggestedServings: 4 }).progress.servings, 4)
  const saved = { ...createCookingProgress(value), servings: 3 }
  assert.equal(restoreCookingProgress(serializeCookingProgress(saved), value, { suggestedServings: 4 }).progress.servings, 3)
})

test('blocked session storage never prevents progress updates or exposes storage exception messages', () => {
  const value = recipe()
  const blocked = { getItem() { throw new Error('private storage detail') }, setItem() { throw new Error('private quota detail') } }
  assert.deepEqual(readCookingStorage(blocked, value), { progress: createCookingProgress(value), notice: COOKING_STORAGE_NOTICE })
  assert.equal(writeCookingStorage(blocked, createCookingProgress(value)), COOKING_STORAGE_NOTICE)
  assert.equal(writeCookingStorage(null, createCookingProgress(value)), null)
  assert.deepEqual(readCookingStorage(null, value).progress, createCookingProgress(value))
})

test('empty recipes have null current step; duplicate/invalid ingredient IDs cannot inflate progress', () => {
  const empty = recipe({ ingredients: [], steps: [] })
  assert.equal(createCookingProgress(empty).currentStepId, null)
  assert.deepEqual(getAdjustedCookingIngredients(empty, 2), [])
  const value = recipe()
  const malformed = recipe({ ingredients: [...value.ingredients, value.ingredients[0], { ingredientId: -1, quantity: 10 }] })
  assert.deepEqual(getCookingIngredients(malformed).map((ingredient) => ingredient.ingredientId), [64, 18])
  assert.deepEqual(getCookingIngredients(null), [])
})

test('scope reacts to progress identity changes while descriptive content and quantity updates stay live', () => {
  const value = recipe()
  const scope = getCookingScope(value, { suggestedServings: 4, entryKey: 'entry-1' })
  assert.equal(getCookingScope(recipe({ recipeName: 'Tên mới', ingredients: value.ingredients.map((item) => ({ ...item, quantity: 99 })) }), { suggestedServings: 4, entryKey: 'entry-1' }), scope)
  assert.notEqual(getCookingScope(recipe({ recipeId: 18 }), { suggestedServings: 4, entryKey: 'entry-1' }), scope)
  assert.notEqual(getCookingScope(recipe({ servings: 3 }), { suggestedServings: 4, entryKey: 'entry-1' }), scope)
  assert.notEqual(getCookingScope(recipe({ ingredients: value.ingredients.slice(1) }), { suggestedServings: 4, entryKey: 'entry-1' }), scope)
  assert.notEqual(getCookingScope(recipe({ steps: value.steps.slice(1) }), { suggestedServings: 4, entryKey: 'entry-1' }), scope)
  assert.notEqual(getCookingScope(value, { suggestedServings: 4, entryKey: 'entry-2' }), scope)
})
