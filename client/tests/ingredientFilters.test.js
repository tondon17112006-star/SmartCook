import assert from 'node:assert/strict'
import test from 'node:test'
import { filterIngredients } from '../src/utilities/ingredientFilters.js'

const catalog = [
  { ingredientId: 7, ingredientName: 'Trứng gà', ingredientCategory: 'Trứng' },
  { ingredientId: 11, ingredientName: 'Cà chua', ingredientCategory: 'Rau củ' },
  { ingredientId: 14, ingredientName: 'Thịt gà', ingredientCategory: 'Thịt' },
  { ingredientId: 22, ingredientName: 'Nấm [tươi] 100%', ingredientCategory: 'Nhóm mới từ API' },
]

test('local ingredient search preserves Vietnamese accents while ignoring case and normalizing NFC', () => {
  assert.deepEqual(filterIngredients(catalog, { search: '  TRỨNG  '.normalize('NFD') }).map((item) => item.ingredientId), [7])
  assert.deepEqual(filterIngredients(catalog, { search: 'cà chua'.normalize('NFD') }).map((item) => item.ingredientId), [11])
  assert.deepEqual(filterIngredients(catalog, { search: 'trung' }), [])
})

test('group names are read from API values and combine with a substring search', () => {
  assert.deepEqual(filterIngredients(catalog, { search: 'gà', group: 'Thịt' }).map((item) => item.ingredientId), [14])
  assert.deepEqual(filterIngredients(catalog, { group: 'nhóm mới từ api' }).map((item) => item.ingredientId), [22])
  assert.deepEqual(filterIngredients(catalog, { search: 'gà', group: 'Rau củ' }), [])
})

test('literal characters are not treated as a regex or wildcard and clearing returns the complete catalog', () => {
  assert.deepEqual(filterIngredients(catalog, { search: '[tươi] 100%' }).map((item) => item.ingredientId), [22])
  assert.deepEqual(filterIngredients(catalog, { search: '.*' }), [])
  assert.deepEqual(filterIngredients(catalog), catalog)
  assert.deepEqual(filterIngredients(catalog, { search: ' ', group: '' }), catalog)
  assert.deepEqual(filterIngredients([], { search: 'trứng' }), [])
})

test('filtering includes later catalog entries and never mutates original order or source objects', () => {
  const original = structuredClone(catalog)
  const result = filterIngredients(catalog, { search: 'nấm' })
  assert.deepEqual(result.map((item) => item.ingredientId), [22])
  assert.deepEqual(catalog, original)
  assert.equal(result[0], catalog[3])
})
