import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDefaultPantry,
  ingredientGroups,
  INVALID_STORAGE_NOTICE,
  isIngredientId,
  isServings,
  MAX_PANTRY_INGREDIENTS,
  PANTRY_STORAGE_KEY,
  readPantryStorage,
  reconcilePantry,
  REMOVED_INGREDIENTS_NOTICE,
  restorePantry,
  serializePantry,
  STORAGE_NOTICE,
  togglePantryIngredient,
  writePantryStorage,
} from '../src/utilities/pantryState.js'

test('a fresh session starts empty with two servings, without shared mutable arrays', () => {
  const first = createDefaultPantry()
  first.ingredientIds.push(1)
  assert.deepEqual(createDefaultPantry(), { ingredientIds: [], servings: 2 })
  assert.deepEqual(restorePantry(null), { pantry: { ingredientIds: [], servings: 2 }, notice: null })
})

test('storage round trip persists IDs and servings only and keeps exact numeric types', () => {
  const pantry = { ingredientIds: [64, 18, 9], servings: 4, ingredientNames: ['not persisted'] }
  const serialized = serializePantry(pantry)
  assert.deepEqual(JSON.parse(serialized), { version: 1, ingredientIds: [64, 18, 9], servings: 4 })
  assert.deepEqual(restorePantry(serialized), { pantry: { ingredientIds: [64, 18, 9], servings: 4 }, notice: null })
  assert.deepEqual(restorePantry(serializePantry({ ingredientIds: [], servings: 20 })).pantry, { ingredientIds: [], servings: 20 })
})

test('corrupt, obsolete or structurally incompatible storage resets safely with a notice', () => {
  const corrupt = ['broken json', '', 'null', '[]', 'true', '{}',
    JSON.stringify({ version: 2, ingredientIds: [1], servings: 2 }),
    JSON.stringify({ version: 1, ingredientIds: [1], servings: 2, ingredientNames: ['old name'] }),
    JSON.stringify({ version: 1, ingredientIds: [1, 1], servings: 2 }),
    JSON.stringify({ version: 1, ingredientIds: [1], servings: '4' }),
    JSON.stringify({ version: 1, ingredientIds: ['1'], servings: 4 }),
    JSON.stringify({ version: 1, ingredientIds: [2147483648], servings: 4 }),
    JSON.stringify({ version: 1, ingredientIds: [1], servings: 0 }),
    JSON.stringify({ version: 1, ingredientIds: Array.from({ length: 101 }, (_, i) => i + 1), servings: 2 })]
  for (const serialized of corrupt) {
    assert.deepEqual(restorePantry(serialized), { pantry: createDefaultPantry(), notice: INVALID_STORAGE_NOTICE }, serialized)
  }
})

test('ID and servings validation rejects coercion and respects SQL INT / UI limits', () => {
  for (const invalid of [0, -1, 1.5, NaN, Infinity, true, null, '1', 2147483648]) assert.equal(isIngredientId(invalid), false)
  for (const valid of [1, 2147483647]) assert.equal(isIngredientId(valid), true)
  for (const invalid of [0, -1, 21, 1.5, NaN, Infinity, true, '2']) assert.equal(isServings(invalid), false)
  for (const valid of [1, 2, 20]) assert.equal(isServings(valid), true)
  assert.throws(() => serializePantry({ ingredientIds: [1, 1], servings: 2 }), TypeError)
})

test('toggling adds many IDs, removes on second click, rejects missing IDs and never mutates old state', () => {
  const available = new Set([1, 2, 3])
  const initial = createDefaultPantry()
  const one = togglePantryIngredient(initial, 1, available)
  const many = togglePantryIngredient(one, 2, available)
  assert.deepEqual(initial.ingredientIds, [])
  assert.deepEqual(many.ingredientIds, [1, 2])
  assert.deepEqual(togglePantryIngredient(many, 1, available).ingredientIds, [2])
  assert.equal(togglePantryIngredient(many, 4, available), many)
  assert.equal(togglePantryIngredient(many, '1', available), many)
})

test('selection enforces 100 IDs while still allowing removal at the limit', () => {
  const ids = Array.from({ length: MAX_PANTRY_INGREDIENTS }, (_, i) => i + 1)
  const pantry = { ingredientIds: ids, servings: 4 }
  const available = new Set([...ids, 101])
  assert.equal(togglePantryIngredient(pantry, 101, available), pantry)
  assert.equal(togglePantryIngredient(pantry, 100, available).ingredientIds.length, 99)
})

test('successful catalog reconciliation removes obsolete IDs, preserves order/servings and reads current names', () => {
  const pantry = { ingredientIds: [9, 64, 18], servings: 4 }
  const catalog = [{ ingredientId: 64, ingredientName: 'Tên hiện tại' }, { ingredientId: 9, ingredientName: 'Cà chua' }]
  const reconciled = reconcilePantry(pantry, catalog)
  assert.deepEqual(reconciled.pantry, { ingredientIds: [9, 64], servings: 4 })
  assert.equal(reconciled.notice, REMOVED_INGREDIENTS_NOTICE)
  assert.deepEqual(pantry.ingredientIds, [9, 64, 18])
  assert.equal(reconcilePantry(reconciled.pantry, catalog).notice, null)
  assert.deepEqual(reconcilePantry(pantry, []).pantry, { ingredientIds: [], servings: 4 })
})

test('session storage read/write errors are nonblocking and never use localStorage', () => {
  const saved = new Map()
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
  const pantry = { ingredientIds: [3, 7], servings: 4 }
  assert.equal(writePantryStorage(storage, pantry), null)
  assert.deepEqual(readPantryStorage(storage).pantry, pantry)
  assert.equal(saved.has(PANTRY_STORAGE_KEY), true)
  const blocked = { getItem() { throw new Error('disabled') }, setItem() { throw new Error('quota') } }
  assert.deepEqual(readPantryStorage(blocked), { pantry: createDefaultPantry(), notice: STORAGE_NOTICE })
  assert.equal(writePantryStorage(blocked, pantry), STORAGE_NOTICE)
  assert.equal(writePantryStorage(null, pantry), null)
})

test('group filters come from the complete catalog and use Vietnamese sorting without invented labels', () => {
  const catalog = [
    { ingredientCategory: 'Trứng' }, { ingredientCategory: 'Gia vị' },
    { ingredientCategory: 'Rau củ' }, { ingredientCategory: 'Gia vị' },
  ]
  assert.deepEqual(ingredientGroups(catalog), ['Gia vị', 'Rau củ', 'Trứng'])
  assert.deepEqual(ingredientGroups([]), [])
})
