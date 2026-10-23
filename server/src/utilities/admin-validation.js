import { HttpError } from './http-error.js';
import { parsePagination, readPositiveInt, readString } from './query.js';

export const adminRecipeSorts = new Map([
  ['newest', 'r.CreatedAt DESC, r.RecipeID DESC'], ['name_asc', 'r.RecipeName ASC, r.RecipeID ASC'],
  ['name_desc', 'r.RecipeName DESC, r.RecipeID DESC'],
  ['time_asc', '(CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime)) ASC, r.RecipeID ASC'],
  ['time_desc', '(CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime)) DESC, r.RecipeID ASC'],
]);
const fail = (message) => { throw new HttpError(400, message); };
const controls = /[\p{Cc}\p{Cf}]/u;
const multilineControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\p{Cf}]/u;

function strictObject(value, keys, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !keys.includes(key))) fail('Dữ liệu có trường không được phép.');
  if (required.some((key) => !Object.hasOwn(value, key))) fail('Vui lòng điền đủ các trường bắt buộc.');
}

function text(value, name, max, { optional = false, multiline = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'string') fail(`${name} phải là chuỗi.`);
  const parsed = value.normalize('NFC').trim();
  if (optional && !parsed) return null;
  if (!parsed || parsed.length > max || (multiline ? multilineControls : controls).test(parsed)) {
    fail(`${name} phải có từ 1 đến ${max} ký tự hợp lệ.`);
  }
  return parsed;
}

export function validateAdminImageUrl(value) {
  const parsed = text(value, 'URL hình ảnh', 500, { optional: true });
  if (parsed === null) return null;
  if (/[\s\\]/u.test(parsed)) fail('URL hình ảnh không hợp lệ.');
  if (parsed.startsWith('/') && !parsed.startsWith('//')) return parsed;
  try {
    const url = new URL(parsed);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return parsed;
  } catch { /* Return one safe validation error below. */ }
  return fail('URL hình ảnh phải dùng http, https hoặc đường dẫn bắt đầu bằng /.');
}

function integer(value, name, { min = 1, max = 2_147_483_647 } = {}) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) fail(`${name} phải là số nguyên từ ${min} đến ${max}.`);
  return value;
}

export function readAdminId(value) { return readPositiveInt(value, 'id'); }

export function parseAdminQuery(query = {}, resource) {
  const allowed = ['search', 'page', 'limit', ...({ recipes: ['categoryId', 'sort'], ingredients: ['ingredientCategory'], users: ['role'], reviews: ['recipeId', 'rating'] }[resource] ?? [])];
  if (Object.keys(query).some((key) => !allowed.includes(key))) fail('Bộ lọc không được hỗ trợ.');
  const parsed = { ...parsePagination(query), search: readString(query.search, 'search', { maxLength: 150 }) };
  if (query.categoryId !== undefined) parsed.categoryId = readPositiveInt(query.categoryId, 'categoryId');
  if (query.recipeId !== undefined) parsed.recipeId = readPositiveInt(query.recipeId, 'recipeId');
  if (query.rating !== undefined) parsed.rating = readPositiveInt(query.rating, 'rating', { max: 5 });
  if (query.ingredientCategory !== undefined) parsed.ingredientCategory = readString(query.ingredientCategory, 'ingredientCategory', { maxLength: 100, allowEmpty: false });
  if (query.role !== undefined) {
    parsed.role = readString(query.role, 'role', { maxLength: 20, allowEmpty: false });
    if (!['User', 'Admin'].includes(parsed.role)) fail('Vai trò lọc không hợp lệ.');
  }
  if (resource === 'recipes') {
    parsed.sort = readString(query.sort, 'sort', { maxLength: 30, defaultValue: 'newest', allowEmpty: false });
    if (!adminRecipeSorts.has(parsed.sort)) fail('Thứ tự sắp xếp không được hỗ trợ.');
  }
  return parsed;
}

function quantity(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 9_999_999_999.99
      || Number(value.toFixed(2)) !== value) fail('Định lượng phải dương và có tối đa 2 chữ số thập phân.');
  return value;
}

function ingredients(value) {
  if (!Array.isArray(value) || !value.length || value.length > 200) fail('Công thức cần 1–200 nguyên liệu.');
  const used = new Set();
  const parsed = value.map((row) => {
    strictObject(row, ['ingredientId', 'quantity', 'unit', 'isRequired', 'notes'], ['ingredientId', 'quantity', 'unit', 'isRequired']);
    const ingredientId = integer(row.ingredientId, 'Nguyên liệu');
    if (used.has(ingredientId)) fail('Không chọn trùng nguyên liệu trong công thức.');
    used.add(ingredientId);
    if (typeof row.isRequired !== 'boolean') fail('Trạng thái nguyên liệu bắt buộc phải là boolean.');
    return { ingredientId, quantity: quantity(row.quantity), unit: text(row.unit, 'Đơn vị', 30), isRequired: row.isRequired,
      notes: text(row.notes, 'Ghi chú', 255, { optional: true }) };
  });
  if (!parsed.some((row) => row.isRequired)) fail('Cần ít nhất một nguyên liệu bắt buộc.');
  return parsed;
}

function steps(value) {
  if (!Array.isArray(value) || !value.length || value.length > 100) fail('Công thức cần 1–100 bước nấu.');
  return value.map((row, index) => {
    strictObject(row, ['stepNumber', 'instruction', 'imageUrl'], ['stepNumber', 'instruction']);
    if (row.stepNumber !== index + 1) fail('Số thứ tự các bước phải liên tiếp từ 1 theo vị trí trong danh sách.');
    return { stepNumber: index + 1, instruction: text(row.instruction, 'Hướng dẫn nấu', 10_000, { multiline: true }), imageUrl: validateAdminImageUrl(row.imageUrl) };
  });
}

export function validateRecipeState(recipe) {
  if (recipe.prepTime + recipe.cookTime <= 0) fail('Tổng thời gian chế biến phải lớn hơn 0.');
  if (!recipe.ingredients?.some((row) => row.isRequired) || !recipe.steps?.length) fail('Cần nguyên liệu bắt buộc và bước nấu.');
  return recipe;
}

export function validateAdminRecipe(body, { partial = false } = {}) {
  const keys = ['recipeName', 'categoryId', 'description', 'imageUrl', 'prepTime', 'cookTime', 'servings', 'difficulty', 'ingredients', 'steps'];
  strictObject(body, keys, partial ? [] : ['recipeName', 'categoryId', 'prepTime', 'cookTime', 'servings', 'difficulty', 'ingredients', 'steps']);
  if (!Object.keys(body).length) fail('Cần ít nhất một trường để cập nhật.');
  const output = {};
  for (const key of Object.keys(body)) {
    switch (key) {
      case 'recipeName': output[key] = text(body[key], 'Tên món', 200); break;
      case 'categoryId': case 'servings': output[key] = integer(body[key], key); break;
      case 'prepTime': case 'cookTime': output[key] = integer(body[key], key, { min: 0 }); break;
      case 'description': output[key] = text(body[key], 'Mô tả', 10_000, { optional: true, multiline: true }); break;
      case 'imageUrl': output[key] = validateAdminImageUrl(body[key]); break;
      case 'difficulty':
        if (!['Dễ', 'Trung bình', 'Khó'].includes(body[key])) fail('Độ khó không hợp lệ.');
        output[key] = body[key]; break;
      case 'ingredients': output[key] = ingredients(body[key]); break;
      case 'steps': output[key] = steps(body[key]); break;
    }
  }
  if (!partial) return validateRecipeState({ description: null, imageUrl: null, ...output });
  return output;
}

export function validateAdminCategory(body, { partial = false } = {}) {
  strictObject(body, ['categoryName', 'description', 'imageUrl'], partial ? [] : ['categoryName']);
  if (!Object.keys(body).length) fail('Cần ít nhất một trường để cập nhật.');
  const output = {};
  if (Object.hasOwn(body, 'categoryName')) output.categoryName = text(body.categoryName, 'Tên danh mục', 150);
  if (!partial || Object.hasOwn(body, 'description')) output.description = text(body.description, 'Mô tả', 500, { optional: true, multiline: true });
  if (!partial || Object.hasOwn(body, 'imageUrl')) output.imageUrl = validateAdminImageUrl(body.imageUrl);
  return output;
}

export function validateAdminIngredient(body, { partial = false } = {}) {
  strictObject(body, ['ingredientName', 'ingredientCategory', 'defaultUnit', 'imageUrl'], partial ? [] : ['ingredientName', 'ingredientCategory', 'defaultUnit']);
  if (!Object.keys(body).length) fail('Cần ít nhất một trường để cập nhật.');
  const output = {};
  for (const [key, max] of [['ingredientName', 150], ['ingredientCategory', 100], ['defaultUnit', 30]]) {
    if (Object.hasOwn(body, key)) output[key] = text(body[key], key, max);
  }
  if (!partial || Object.hasOwn(body, 'imageUrl')) output.imageUrl = validateAdminImageUrl(body.imageUrl);
  return output;
}

export function validateAdminDelete(body) { strictObject(body, []); }
