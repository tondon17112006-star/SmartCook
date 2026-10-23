import { HttpError } from '../utilities/http-error.js';
import { createPagination } from '../utilities/query.js';
import { parseFavoriteQuery, validateFavoriteCreate, validateFavoriteDelete } from '../utilities/personal-validation.js';

function hasSqlNumber(error, numbers) {
  return [error, ...(Array.isArray(error.precedingErrors) ? error.precedingErrors : [])].some((item) =>
    [item.number, item.originalError?.number, item.originalError?.info?.number, item.originalError?.code]
      .some((value) => numbers.includes(Number(value))));
}

export function createFavoriteService({ repository }) {
  return {
    async list(userId, query) {
      const pagination = parseFavoriteQuery(query);
      const { data, total } = await repository.list(userId, pagination);
      return { data, pagination: createPagination(pagination, total) };
    },
    async ids(userId) {
      return { data: await repository.listIds(userId) };
    },
    async add(userId, body) {
      const { recipeId } = validateFavoriteCreate(body);
      if (!await repository.recipeExists(recipeId)) throw new HttpError(404, 'Không tìm thấy món ăn.');
      if (await repository.find(userId, recipeId)) throw new HttpError(409, 'Món ăn đã có trong danh sách yêu thích.');
      try {
        return { data: await repository.create(userId, recipeId) };
      } catch (error) {
        // The existing composite unique constraint arbitrates concurrent saves.
        if (hasSqlNumber(error, [2601, 2627])) throw new HttpError(409, 'Món ăn đã có trong danh sách yêu thích.');
        if (hasSqlNumber(error, [547]) && !await repository.recipeExists(recipeId)) {
          throw new HttpError(404, 'Không tìm thấy món ăn.');
        }
        throw error;
      }
    },
    async remove(userId, recipeId, body) {
      const id = validateFavoriteDelete(recipeId, body);
      if (!await repository.remove(userId, id)) throw new HttpError(404, 'Món ăn chưa có trong danh sách yêu thích của bạn.');
      return { message: 'Đã bỏ món ăn khỏi danh sách yêu thích.' };
    },
  };
}
