import { HttpError } from './http-error.js';
import { readPositiveInt } from './query.js';
import { readJsonSqlId } from './personal-validation.js';

export const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
const fields = ['mealDate', 'mealType', 'servings', 'sortOrder'];
const dateMessage = 'Ngày phải hợp lệ theo định dạng YYYY-MM-DD và nằm trong tuần đầy đủ từ 0001-01-01 đến 9999-12-26.';
const leap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const monthDays = (year) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const beforeYear = (year) => 365 * (year - 1) + Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400);

function exactObject(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.includes(key))
      || required.some((key) => !Object.hasOwn(value, key))) {
    throw new HttpError(400, 'Dữ liệu lịch nấu ăn không hợp lệ.');
  }
}

export function readMealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new HttpError(400, dateMessage);
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays(year)[month - 1]
      || value > '9999-12-26') throw new HttpError(400, dateMessage);
  return value;
}

function ordinal(value) {
  const [year, month, day] = readMealDate(value).split('-').map(Number);
  return beforeYear(year) + monthDays(year).slice(0, month - 1).reduce((sum, days) => sum + days, 0) + day - 1;
}

/** Gregorian date arithmetic uses calendar integers, independent of process timezone and Date parsing. */
export function addCalendarDays(value, days) {
  const target = ordinal(value) + days;
  if (!Number.isInteger(days) || target < 0 || target > ordinal('9999-12-26')) throw new HttpError(400, dateMessage);
  let low = 1; let high = 9999;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (beforeYear(middle) <= target) low = middle; else high = middle - 1;
  }
  let remaining = target - beforeYear(low); let month = 1;
  for (const length of monthDays(low)) {
    if (remaining < length) break;
    remaining -= length; month += 1;
  }
  return `${String(low).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(remaining + 1).padStart(2, '0')}`;
}

export function weekStartForDate(value) { return addCalendarDays(value, -(ordinal(value) % 7)); }

export function parseMealPlanQuery(query) {
  exactObject(query, ['weekStart'], ['weekStart']);
  const weekStart = readMealDate(query.weekStart);
  if (weekStart > '9999-12-20' || weekStartForDate(weekStart) !== weekStart) {
    throw new HttpError(400, 'weekStart phải là ngày thứ Hai của một tuần đầy đủ.');
  }
  return { weekStart, weekEnd: addCalendarDays(weekStart, 6) };
}

export function readMealPlanItemId(value) { return readPositiveInt(value, 'id'); }

function readServings(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20) {
    throw new HttpError(400, 'Khẩu phần phải là số nguyên từ 1 đến 20.');
  }
  return value;
}
function readSortOrder(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new HttpError(400, 'Thứ tự món phải là số nguyên từ 0 đến 2147483647.');
  }
  return value;
}
function readFields(body) {
  if (Object.hasOwn(body, 'mealType') && !mealTypes.includes(body.mealType)) throw new HttpError(400, 'Bữa ăn phải là Breakfast, Lunch hoặc Dinner.');
  return {
    ...(Object.hasOwn(body, 'mealDate') ? { mealDate: readMealDate(body.mealDate) } : {}),
    ...(Object.hasOwn(body, 'mealType') ? { mealType: body.mealType } : {}),
    ...(Object.hasOwn(body, 'servings') ? { servings: readServings(body.servings) } : {}),
    ...(Object.hasOwn(body, 'sortOrder') ? { sortOrder: readSortOrder(body.sortOrder) } : {}),
  };
}
export function validateMealPlanCreate(body) {
  exactObject(body, ['recipeId', ...fields], ['recipeId', 'mealDate', 'mealType', 'servings']);
  return { recipeId: readJsonSqlId(body.recipeId, 'recipeId'), sortOrder: 0, ...readFields(body) };
}
export function validateMealPlanUpdate(body) {
  exactObject(body, fields);
  if (!Object.keys(body).length) throw new HttpError(400, 'Cần cung cấp ngày, bữa ăn, khẩu phần hoặc thứ tự để cập nhật.');
  return readFields(body);
}
export function validateMealPlanDelete(body) { exactObject(body, []); }
export function validateMealPlanMutationQuery(query) { exactObject(query, []); }
