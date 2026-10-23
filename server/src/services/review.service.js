import { HttpError } from '../utilities/http-error.js';
import { createPagination } from '../utilities/query.js';
import { parseReviewQuery, readReviewId, validateReviewCreate, validateReviewUpdate, validateReviewDelete } from '../utilities/review-validation.js';

function hasSqlNumber(error, numbers) {
  return [error, ...(Array.isArray(error.precedingErrors) ? error.precedingErrors : [])].some((item) =>
    [item.number, item.originalError?.number, item.originalError?.info?.number, item.originalError?.code]
      .some((value) => numbers.includes(Number(value))));
}

const duplicateMessage = 'Bạn đã đánh giá món ăn này. Hãy chỉnh sửa đánh giá hiện có.';
const missingReviewMessage = 'Không tìm thấy đánh giá của bạn.';

export function createReviewService({ repository }) {
  return {
    async list(recipeId, query) {
      const id = readReviewId(recipeId, 'recipeId');
      const pagination = parseReviewQuery(query);
      if (!await repository.recipeExists(id)) throw new HttpError(404, 'Không tìm thấy món ăn.');
      const { data, total, averageRating } = await repository.list(id, pagination);
      return {
        data, pagination: createPagination(pagination, total),
        summary: { averageRating: Number(averageRating.toFixed(2)), reviewCount: total },
      };
    },
    async mine(userId, recipeId) {
      const id = readReviewId(recipeId, 'recipeId');
      if (!await repository.recipeExists(id)) throw new HttpError(404, 'Không tìm thấy món ăn.');
      return { data: await repository.findMine(userId, id) };
    },
    async add(userId, recipeId, body) {
      const id = readReviewId(recipeId, 'recipeId');
      const changes = validateReviewCreate(body);
      if (!await repository.recipeExists(id)) throw new HttpError(404, 'Không tìm thấy món ăn.');
      if (await repository.findMine(userId, id)) throw new HttpError(409, duplicateMessage);
      try {
        return { data: await repository.create(userId, id, changes) };
      } catch (error) {
        if (hasSqlNumber(error, [2601, 2627])) throw new HttpError(409, duplicateMessage);
        if (hasSqlNumber(error, [547]) && !await repository.recipeExists(id)) throw new HttpError(404, 'Không tìm thấy món ăn.');
        throw error;
      }
    },
    async update(userId, reviewId, body) {
      const id = readReviewId(reviewId);
      const changes = validateReviewUpdate(body);
      const data = await repository.update(userId, id, changes);
      if (!data) throw new HttpError(404, missingReviewMessage);
      return { data };
    },
    async remove(userId, reviewId, body) {
      const id = readReviewId(reviewId);
      validateReviewDelete(body);
      if (!await repository.remove(userId, id)) throw new HttpError(404, missingReviewMessage);
      return { message: 'Đã xóa đánh giá của bạn.' };
    },
  };
}
