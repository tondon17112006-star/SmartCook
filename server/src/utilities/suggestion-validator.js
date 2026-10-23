import { HttpError } from './http-error.js';

const maximumIngredientCount = 100;
const sqlIntMaximum = 2_147_483_647;
const allowedFields = new Set(['ingredientIds', 'servings', 'page', 'limit']);

function readJsonInteger(value, name, maximum, defaultValue) {
  if (value === undefined && defaultValue !== undefined) return defaultValue;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new HttpError(400, `${name} phải là số nguyên từ 1 đến ${maximum}.`);
  }
  return value;
}

/** JSON body numbers are validated without query-string coercion. */
export function validateSuggestionBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(body))) {
    throw new HttpError(400, 'Nội dung yêu cầu phải là một đối tượng JSON.');
  }
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    throw new HttpError(400, 'Nội dung yêu cầu có thuộc tính không được hỗ trợ.');
  }

  if (!Array.isArray(body.ingredientIds) || body.ingredientIds.length === 0) {
    throw new HttpError(400, 'ingredientIds phải là mảng nguyên liệu không rỗng.');
  }
  // Bound the raw input before deduplication, including repeated IDs.
  if (body.ingredientIds.length > maximumIngredientCount) {
    throw new HttpError(400, `ingredientIds chỉ được chứa tối đa ${maximumIngredientCount} phần tử.`);
  }
  const ingredientIds = [...new Set(Array.from(body.ingredientIds, (id) => (
    readJsonInteger(id, 'Mỗi ingredientId', sqlIntMaximum)
  )))];
  const servings = body.servings === undefined
    ? null
    : readJsonInteger(body.servings, 'servings', 20);
  const page = readJsonInteger(body.page, 'page', 100_000, 1);
  const limit = readJsonInteger(body.limit, 'limit', 50, 12);

  return { ingredientIds, servings, page, limit, offset: (page - 1) * limit };
}
