import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addCalendarDays, formatMealDate, formatWeekRange, isCalendarDate, isSupportedMealDate, isWeekStart, shiftWeek, startOfWeek, todayInVietnam, weekDates } from '../src/utilities/mealPlannerDates.js'
import { formatShoppingQuantity, validateMealFields } from '../src/utilities/mealPlanner.js'

test('MP calendar accepts real Gregorian dates and rejects permissive/UTC parsing inputs', () => {
  for (const date of ['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31']) assert.equal(isCalendarDate(date), true)
  for (const date of ['0000-01-01', '10000-01-01', '1900-02-29', '2026-02-29', '2026-04-31', '2026-1-01', '2026-10-27T00:00:00Z', '', null]) assert.equal(isCalendarDate(date), false)
})
test('MP week starts Monday and Sunday belongs to the preceding Monday', () => {
  assert.equal(startOfWeek('2026-10-26'), '2026-10-26')
  assert.equal(startOfWeek('2026-11-01'), '2026-10-26')
  assert.equal(startOfWeek('2026-11-02'), '2026-11-02')
  assert.equal(isWeekStart('2026-10-27'), false)
})
test('MP week crosses December31 and January1 without changing the calendar day', () => {
  assert.equal(startOfWeek('2027-01-01'), '2026-12-28')
  assert.deepEqual(weekDates('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
  assert.equal(shiftWeek('2026-12-28', 1), '2027-01-04')
})
test('MP leap-year arithmetic distinguishes leap centuries and ordinary centuries', () => {
  assert.equal(addCalendarDays('2000-02-28', 1), '2000-02-29')
  assert.equal(addCalendarDays('1900-02-28', 1), '1900-03-01')
  assert.equal(addCalendarDays('2024-03-01', -1), '2024-02-29')
})
test('MP calendar handles minimum date and rejects incomplete final weeks', () => {
  assert.equal(isWeekStart('0001-01-01'), true)
  assert.equal(shiftWeek('0001-01-01', -1), null)
  assert.equal(isWeekStart('9999-12-20'), true)
  assert.equal(isSupportedMealDate('9999-12-26'), true)
  assert.equal(isSupportedMealDate('9999-12-27'), false)
  assert.equal(shiftWeek('9999-12-20', 1), null)
  assert.throws(() => weekDates('9999-12-27'), RangeError)
})
test('MP Vietnam today changes at UTC17 regardless of the machine timezone', () => {
  assert.equal(todayInVietnam(new Date('2026-12-31T16:59:59Z')), '2026-12-31')
  assert.equal(todayInVietnam(new Date('2026-12-31T17:00:00Z')), '2027-01-01')
  assert.equal(todayInVietnam(new Date('2024-02-28T17:00:00Z')), '2024-02-29')
})
test('MP Vietnamese date presentation does not parse date-only strings into instants', () => {
  assert.equal(formatMealDate('2026-10-26'), '26/10/2026')
  assert.equal(formatWeekRange('2026-10-26'), '26/10/2026 – 01/11/2026')
  assert.equal(formatMealDate('invalid'), '')
})
test('MP servings validation rejects fractions, zero, empty and out of range drafts', () => {
  const valid = { mealDate: '2026-10-26', mealType: 'Lunch', servings: 2 }
  assert.equal(validateMealFields(valid), null)
  for (const servings of ['', ' ', 0, -1, 1.1, 21, 'abc']) assert.match(validateMealFields({ ...valid, servings }), /1 đến 20/u)
  assert.match(validateMealFields({ ...valid, mealDate: '2026-02-30' }), /ngày hợp lệ/u)
  assert.match(validateMealFields({ ...valid, mealType: 'Snack' }), /bữa sáng/u)
})
test('MP shopping presentation preserves exact large decimal strings and rounds nothing down', () => {
  assert.equal(formatShoppingQuantity('0.000001'), '0,000001')
  assert.equal(formatShoppingQuantity('1250.500000'), '1.250,5')
  assert.equal(formatShoppingQuantity('9007199254740993.123457'), '9.007.199.254.740.993,123457')
})
