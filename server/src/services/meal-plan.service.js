import { HttpError } from '../utilities/http-error.js';
import { addCalendarDays, parseMealPlanQuery, readMealPlanItemId, validateMealPlanCreate,
  validateMealPlanUpdate, validateMealPlanDelete } from '../utilities/meal-plan-validation.js';
import { aggregateShoppingList } from './shopping-list.service.js';

function sqlHasNumber(error, numbers) {
  return [error, ...(Array.isArray(error.precedingErrors) ? error.precedingErrors : [])].some((entry) =>
    [entry.number, entry.originalError?.number, entry.originalError?.info?.number, entry.originalError?.code]
      .some((number) => numbers.includes(Number(number))));
}
async function write(operation) {
  try { return await operation(); }
  catch (error) {
    if (sqlHasNumber(error, [2601, 2627])) throw new HttpError(409, 'Món ăn đã có trong bữa này. Hãy chỉnh sửa món hiện có.');
    if (sqlHasNumber(error, [547])) throw new HttpError(400, 'Dữ liệu lịch hoặc món ăn vừa thay đổi. Vui lòng tải lại và thử lại.');
    if (sqlHasNumber(error, [1205])) throw new HttpError(409, 'Lịch đang được cập nhật. Vui lòng thử lại.');
    throw error;
  }
}
const missing = () => new HttpError(404, 'Không tìm thấy món trong lịch nấu ăn của bạn.');

export function createMealPlanService({ repository }) {
  return {
    async getWeek(userId, query) {
      const { weekStart, weekEnd } = parseMealPlanQuery(query);
      const week = await repository.getWeek(userId, weekStart);
      const days = Array.from({ length: 7 }, (_, index) => ({
        date: addCalendarDays(weekStart, index), meals: { Breakfast: [], Lunch: [], Dinner: [] },
      }));
      const dates = new Map(days.map((day) => [day.date, day]));
      for (const item of week.items) {
        const day = dates.get(item.mealDate);
        if (!day || !Object.hasOwn(day.meals, item.mealType)) throw new Error('Invalid stored meal plan date or meal type.');
        day.meals[item.mealType].push(item);
      }
      return { data: { mealPlanId: week.mealPlanId, weekStart, weekEnd, days, summary: {
        itemCount: week.items.length,
        mealCount: days.reduce((total, day) => total + Object.values(day.meals).filter((items) => items.length).length, 0),
        dayCount: days.filter((day) => Object.values(day.meals).some((items) => items.length)).length,
        ingredientCount: week.ingredientCount,
      } } };
    },
    async shoppingList(userId, query) {
      const { weekStart, weekEnd } = parseMealPlanQuery(query);
      return { data: { weekStart, weekEnd, items: aggregateShoppingList(await repository.getShoppingRows(userId, weekStart)) } };
    },
    async add(userId, body) {
      const input = validateMealPlanCreate(body);
      return { data: await write(() => repository.create(userId, input)) };
    },
    async update(userId, id, body) {
      const itemId = readMealPlanItemId(id); const changes = validateMealPlanUpdate(body);
      const data = await write(() => repository.update(userId, itemId, changes));
      if (!data) throw missing();
      return { data };
    },
    async remove(userId, id, body) {
      const itemId = readMealPlanItemId(id); validateMealPlanDelete(body);
      if (!await write(() => repository.remove(userId, itemId))) throw missing();
      return { message: 'Đã xóa món khỏi lịch nấu ăn.' };
    },
  };
}
