import { HttpError } from './http-error.js';
import { readPositiveInt } from './query.js';
import { readJsonSqlId } from './personal-validation.js';

const editableFields = ['quantity', 'unit', 'expiryDate'];

function exactObject(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.includes(key))
      || required.some((key) => !Object.hasOwn(value, key))) {
    throw new HttpError(400, 'Dữ liệu tủ nguyên liệu không hợp lệ.');
  }
}

export function readPantryId(value) { return readPositiveInt(value, 'id'); }

export function readPantryQuantity(value) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 9_999_999_999.99
      || Number(value.toFixed(2)) !== value) {
    throw new HttpError(400, 'Số lượng phải là số dương không quá 9999999999.99 và có tối đa 2 chữ số thập phân.');
  }
  return value;
}

export function normalizePantryUnit(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}<>]/u.test(value)) {
    throw new HttpError(400, 'Đơn vị không hợp lệ.');
  }
  const unit = value.normalize('NFC').trim();
  if (!unit || unit.length > 30) throw new HttpError(400, 'Đơn vị phải có từ 1 đến 30 ký tự.');
  return unit;
}

export function readPantryExpiryDate(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new HttpError(400, 'Hạn sử dụng phải là ngày hợp lệ theo định dạng YYYY-MM-DD hoặc null.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
    throw new HttpError(400, 'Hạn sử dụng không phải ngày hợp lệ.');
  }
  return value;
}

export function validatePantryState({ quantity, unit }) {
  if (quantity !== null && unit === null) throw new HttpError(400, 'Cần cung cấp đơn vị khi nhập số lượng.');
}

export function validatePantryCreate(body) {
  exactObject(body, ['ingredientId', ...editableFields], ['ingredientId']);
  const input = {
    ingredientId: readJsonSqlId(body.ingredientId, 'ingredientId'),
    quantity: Object.hasOwn(body, 'quantity') ? readPantryQuantity(body.quantity) : null,
    unit: Object.hasOwn(body, 'unit') ? normalizePantryUnit(body.unit) : null,
    expiryDate: Object.hasOwn(body, 'expiryDate') ? readPantryExpiryDate(body.expiryDate) : null,
  };
  validatePantryState(input);
  return input;
}

export function validatePantryUpdate(body) {
  exactObject(body, editableFields);
  if (!Object.keys(body).length) throw new HttpError(400, 'Cần cung cấp số lượng, đơn vị hoặc hạn sử dụng để cập nhật.');
  return {
    ...(Object.hasOwn(body, 'quantity') ? { quantity: readPantryQuantity(body.quantity) } : {}),
    ...(Object.hasOwn(body, 'unit') ? { unit: normalizePantryUnit(body.unit) } : {}),
    ...(Object.hasOwn(body, 'expiryDate') ? { expiryDate: readPantryExpiryDate(body.expiryDate) } : {}),
  };
}

export function validatePantryDelete(body) { exactObject(body, []); }

export function parsePantryQuery(query) {
  exactObject(query, ['page', 'limit']);
  const page = readPositiveInt(query.page, 'page', { max: 100_000, defaultValue: 1 });
  const limit = readPositiveInt(query.limit, 'limit', { max: 100, defaultValue: 100 });
  return { page, limit, offset: (page - 1) * limit };
}
