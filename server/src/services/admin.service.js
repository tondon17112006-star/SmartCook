import { HttpError } from '../utilities/http-error.js';
import { createPagination } from '../utilities/query.js';
import { parseAdminQuery, readAdminId, validateAdminRecipe, validateAdminDelete, validateAdminCategory, validateAdminIngredient } from '../utilities/admin-validation.js';

function hasSqlNumber(error, numbers) {
  return [error, ...(Array.isArray(error.precedingErrors) ? error.precedingErrors : [])].some((item) =>
    [item.number, item.originalError?.number, item.originalError?.info?.number, item.originalError?.code]
      .some((value) => numbers.includes(Number(value))));
}

async function mutation(work, { duplicate = 'Tên đã được sử dụng.', relation = 'Dữ liệu đang được tham chiếu nên không thể thực hiện thao tác.' } = {}) {
  try { return await work(); }
  catch (error) {
    if (hasSqlNumber(error, [2601, 2627])) throw new HttpError(409, duplicate);
    if (hasSqlNumber(error, [547])) throw new HttpError(409, relation);
    throw error;
  }
}

function requireFound(value, label) {
  if (!value) throw new HttpError(404, `Không tìm thấy ${label}.`);
  return value;
}

export function createAdminService({ repository }) {
  async function list(resource, method, query) {
    const input = parseAdminQuery(query, resource);
    const result = await repository[method](input);
    return { data: result.data, pagination: createPagination(input, result.total) };
  }
  async function create(method, validate, body) { return { data: await mutation(() => repository[method](validate(body))) }; }
  async function update(method, validate, id, body, label) {
    const itemId = readAdminId(id); const input = validate(body, { partial: true });
    return { data: requireFound(await mutation(() => repository[method](itemId, input)), label) };
  }
  async function remove(method, id, body, label) {
    const itemId = readAdminId(id); validateAdminDelete(body);
    requireFound(await mutation(() => repository[method](itemId)), label);
    return { message: `Đã xóa ${label}.` };
  }
  return {
    async dashboard() { return { data: await repository.dashboard() }; },
    async listRecipes(query) { return list('recipes', 'listRecipes', query); },
    async getRecipe(id) { return { data: requireFound(await repository.findRecipeById(readAdminId(id)), 'món ăn') }; },
    async createRecipe(userId, body) {
      const input = validateAdminRecipe(body);
      return { data: await mutation(() => repository.createRecipe(userId, input), { relation: 'Danh mục, nguyên liệu hoặc tài khoản vừa thay đổi. Vui lòng tải lại.' }) };
    },
    async updateRecipe(id, body) {
      const recipeId = readAdminId(id);
      const changes = validateAdminRecipe(body, { partial: true });
      return { data: requireFound(await mutation(() => repository.updateRecipe(recipeId, changes)), 'món ăn') };
    },
    async deleteRecipe(id, body) {
      const recipeId = readAdminId(id); validateAdminDelete(body);
      requireFound(await mutation(() => repository.deleteRecipe(recipeId)), 'món ăn');
      return { message: 'Đã xóa món ăn và thành phần công thức.' };
    },
    async listCategories(query) { return list('categories', 'listCategories', query); },
    async createCategory(body) { return create('createCategory', validateAdminCategory, body); },
    async updateCategory(id, body) { return update('updateCategory', validateAdminCategory, id, body, 'danh mục'); },
    async deleteCategory(id, body) { return remove('deleteCategory', id, body, 'danh mục'); },
    async listIngredients(query) { return list('ingredients', 'listIngredients', query); },
    async createIngredient(body) { return create('createIngredient', validateAdminIngredient, body); },
    async updateIngredient(id, body) { return update('updateIngredient', validateAdminIngredient, id, body, 'nguyên liệu'); },
    async deleteIngredient(id, body) { return remove('deleteIngredient', id, body, 'nguyên liệu'); },
    async listUsers(query) { return list('users', 'listUsers', query); },
    async getUser(id) { return { data: requireFound(await repository.findUserById(readAdminId(id)), 'tài khoản') }; },
    async listReviews(query) { return list('reviews', 'listReviews', query); },
    async deleteReview(id, body) { return remove('deleteReview', id, body, 'đánh giá'); },
  };
}
