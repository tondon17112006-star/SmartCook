import { HttpError } from './http-error.js';
import { parsePagination, readPositiveInt } from './query.js';

function exactObject(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.includes(key))
      || required.some((key) => !Object.hasOwn(value, key))) {
    throw new HttpError(400, 'Dữ liệu đánh giá không hợp lệ.');
  }
}

export function readReviewId(value, name = 'reviewId') {
  return readPositiveInt(value, name);
}

export function normalizeReviewComment(value) {
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Bình luận phải là văn bản hoặc null.');
  const normalized = value.normalize('NFC');
  // Preserve ordinary line breaks/tabs. Comments are plain text, never HTML.
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(normalized)) {
    throw new HttpError(400, 'Bình luận chứa ký tự điều khiển không hợp lệ.');
  }
  const comment = normalized.trim();
  if (comment.length > 2000) throw new HttpError(400, 'Bình luận không được dài quá 2000 ký tự.');
  return comment || null;
}

function readRating(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new HttpError(400, 'Số sao đánh giá phải là số nguyên từ 1 đến 5.');
  }
  return value;
}

export function validateReviewCreate(body) {
  exactObject(body, ['rating', 'comment'], ['rating']);
  return { rating: readRating(body.rating), comment: Object.hasOwn(body, 'comment') ? normalizeReviewComment(body.comment) : null };
}

export function validateReviewUpdate(body) {
  exactObject(body, ['rating', 'comment']);
  if (!Object.keys(body).length) throw new HttpError(400, 'Cần cung cấp số sao hoặc bình luận để cập nhật.');
  return {
    ...(Object.hasOwn(body, 'rating') ? { rating: readRating(body.rating) } : {}),
    ...(Object.hasOwn(body, 'comment') ? { comment: normalizeReviewComment(body.comment) } : {}),
  };
}

export function validateReviewDelete(body) {
  exactObject(body, []);
}

export function parseReviewQuery(query) {
  exactObject(query, ['page', 'limit']);
  return parsePagination(query);
}
