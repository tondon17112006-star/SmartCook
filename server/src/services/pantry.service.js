import { HttpError } from '../utilities/http-error.js';
import { createPagination } from '../utilities/query.js';
import { readPantryId, parsePantryQuery, validatePantryCreate, validatePantryUpdate, validatePantryDelete, validatePantryState } from '../utilities/pantry-validation.js';

function hasSqlNumber(error, numbers) {
  return [error, ...(Array.isArray(error.precedingErrors) ? error.precedingErrors : [])].some((item) =>
    [item.number, item.originalError?.number, item.originalError?.info?.number, item.originalError?.code]
      .some((value) => numbers.includes(Number(value))));
}

const missingItemMessage = 'Không tìm thấy nguyên liệu trong tủ của bạn.';
const duplicateMessage = 'Nguyên liệu đã có trong tủ. Hãy chỉnh sửa dòng hiện có.';
const invalidStateMessage = 'Số lượng và đơn vị không hợp lệ hoặc vừa thay đổi. Vui lòng tải lại tủ nguyên liệu.';

export function createPantryService({ repository }) {
  return {
    async list(userId, query) {
      const pagination = parsePantryQuery(query);
      const { data, total } = await repository.list(userId, pagination);
      return { data, pagination: createPagination(pagination, total) };
    },
    async add(userId, body) {
      const input = validatePantryCreate(body);
      if (!await repository.ingredientExists(input.ingredientId)) throw new HttpError(404, 'Không tìm thấy nguyên liệu.');
      if (await repository.findByIngredient(userId, input.ingredientId)) throw new HttpError(409, duplicateMessage);
      try {
        return { data: await repository.create(userId, input) };
      } catch (error) {
        if (hasSqlNumber(error, [2601, 2627])) throw new HttpError(409, duplicateMessage);
        if (hasSqlNumber(error, [547])) {
          if (!await repository.ingredientExists(input.ingredientId)) throw new HttpError(404, 'Không tìm thấy nguyên liệu.');
          throw new HttpError(400, invalidStateMessage);
        }
        throw error;
      }
    },
    async update(userId, id, body) {
      const itemId = readPantryId(id);
      const changes = validatePantryUpdate(body);
      const current = await repository.findById(userId, itemId);
      if (!current) throw new HttpError(404, missingItemMessage);
      validatePantryState({ ...current, ...changes });
      try {
        const data = await repository.update(userId, itemId, changes);
        if (!data) throw new HttpError(404, missingItemMessage);
        return { data };
      } catch (error) {
        // SQL CHECK remains authoritative if two partial edits race between read and write.
        if (hasSqlNumber(error, [547])) throw new HttpError(400, invalidStateMessage);
        throw error;
      }
    },
    async remove(userId, id, body) {
      const itemId = readPantryId(id);
      validatePantryDelete(body);
      if (!await repository.remove(userId, itemId)) throw new HttpError(404, missingItemMessage);
      return { message: 'Đã xóa nguyên liệu khỏi tủ của bạn.' };
    },
  };
}
