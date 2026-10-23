import { HttpError } from './http-error.js';

/** Accept one explicit base-10 integer; arrays, coercion and scientific notation are invalid. */
export function readPositiveInt(value, name, { max = 2_147_483_647, defaultValue } = {}) {
  if (value === undefined && defaultValue !== undefined) return defaultValue;

  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new HttpError(400, `${name} phải là số nguyên dương.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    throw new HttpError(400, `${name} phải nằm trong khoảng từ 1 đến ${max}.`);
  }

  return parsed;
}

/** Read a scalar query string without silently accepting repeated parameters. */
export function readString(value, name, {
  maxLength = 150,
  defaultValue = '',
  allowEmpty = true,
} = {}) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string') {
    throw new HttpError(400, `${name} phải là một chuỗi duy nhất.`);
  }

  const parsed = value.trim().normalize('NFC');
  if (parsed.length > maxLength) {
    throw new HttpError(400, `${name} không được dài quá ${maxLength} ký tự.`);
  }
  if (!allowEmpty && parsed.length === 0) {
    throw new HttpError(400, `${name} không được để trống.`);
  }

  return parsed;
}

export function readSearch(query) {
  return readString(query.search, 'search', { maxLength: 150 });
}

export function parsePagination(query) {
  const page = readPositiveInt(query.page, 'page', { max: 100_000, defaultValue: 1 });
  const limit = readPositiveInt(query.limit, 'limit', { max: 100, defaultValue: 20 });

  return { page, limit, offset: (page - 1) * limit };
}

export function createPagination({ page, limit }, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

// SQL Server LIKE wildcard characters are literal parts of the search term.
export function escapeLike(value) {
  return value.replace(/[~%_\[]/g, (character) => `~${character}`);
}
