import { HttpError } from './http-error.js';
import { parsePagination, readPositiveInt } from './query.js';

function exactObject(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.includes(key))
      || required.some((key) => !Object.hasOwn(value, key))) {
    throw new HttpError(400, 'Dữ liệu yêu cầu không hợp lệ.');
  }
  return value;
}

export function readJsonSqlId(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new HttpError(400, `${name} phải là số nguyên từ 1 đến 2147483647.`);
  }
  return value;
}

export function validateFavoriteCreate(body) {
  exactObject(body, ['recipeId']);
  return { recipeId: readJsonSqlId(body.recipeId, 'recipeId') };
}

export function validateFavoriteDelete(recipeId, body) {
  exactObject(body, []);
  return readPositiveInt(recipeId, 'recipeId');
}

export function parseFavoriteQuery(query) {
  exactObject(query, ['page', 'limit'], []);
  return parsePagination(query);
}
