import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getAuthConfig } from '../src/config/auth.js';
import { createAuthSecurity } from '../src/utilities/auth-security.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createMealPlanRouter } from '../src/routes/meal-plan.routes.js';
import { createMealPlanRepository, runMealPlanTransaction } from '../src/services/meal-plan.repository.js';
import { sql } from '../src/config/database.js';
import { createMealPlanService } from '../src/services/meal-plan.service.js';
import { aggregateShoppingList } from '../src/services/shopping-list.service.js';
import { HttpError } from '../src/utilities/http-error.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { readMealDate, addCalendarDays, weekStartForDate, parseMealPlanQuery,
  readMealPlanItemId, validateMealPlanCreate, validateMealPlanUpdate, validateMealPlanDelete } from '../src/utilities/meal-plan-validation.js';

const origin = 'http://localhost:5173';
const weekStart = '2026-10-26';
const input = { recipeId: 1, mealDate: weekStart, mealType: 'Lunch', servings: 2 };
const status = (expected) => (error) => error instanceof HttpError && error.status === expected;
const shoppingRow = (overrides = {}) => ({ mealPlanItemId: 1, recipeId: 1, recipeName: 'Món một',
  ingredientId: 1, ingredientName: 'Trứng', ingredientCategory: 'Trứng', unit: 'quả', quantity: '2.00',
  servings: 2, originalServings: 3, isRequired: true, ...overrides });

function memoryRepository() {
  const items = new Map(); const plans = new Map(); let sequence = 0;
  const recipes = new Map([1, 2, 3].map((recipeId) => [recipeId, { recipeId,
    recipeName: `Món ${recipeId}`, imageUrl: null, originalServings: recipeId === 1 ? 3 : 4,
    prepTime: 5, cookTime: 10, totalTime: 15 }]));
  function plan(userId, date) {
    const key = `${userId}/${weekStartForDate(date)}`;
    if (!plans.has(key)) plans.set(key, plans.size + 1);
    return plans.get(key);
  }
  function owned(userId, id) { const row = items.get(id); return row?.userId === userId ? row : null; }
  function dto(row) { const { userId: _owner, ...safe } = row; return { ...safe }; }
  function duplicate(userId, data, ignoreId) {
    if ([...items.values()].some((row) => row.userId === userId && row.mealPlanItemId !== ignoreId
        && row.mealDate === data.mealDate && row.mealType === data.mealType && row.recipeId === data.recipeId)) throw { number: 2627 };
  }
  return { items, plans, recipes, repository: {
    async getWeek(userId, date) {
      const selected = [...items.values()].filter((row) => row.userId === userId && weekStartForDate(row.mealDate) === date);
      return { mealPlanId: plans.get(`${userId}/${date}`) ?? null,
        items: selected.map(dto).sort((a, b) => a.sortOrder - b.sortOrder || a.mealPlanItemId - b.mealPlanItemId),
        ingredientCount: selected.length ? 1 : 0 };
    },
    async getShoppingRows(userId, date) {
      return [...items.values()].filter((row) => row.userId === userId && weekStartForDate(row.mealDate) === date)
        .map((row) => shoppingRow({ ...row, quantity: '2.00' }));
    },
    async create(userId, data) {
      if (!recipes.has(data.recipeId)) throw new HttpError(404, 'Không tìm thấy món ăn.');
      duplicate(userId, data);
      const row = { ...recipes.get(data.recipeId), ...data, userId, mealPlanId: plan(userId, data.mealDate), mealPlanItemId: ++sequence };
      items.set(row.mealPlanItemId, row); return dto(row);
    },
    async update(userId, id, changes) {
      const current = owned(userId, id); if (!current) return null;
      const row = { ...current, ...changes }; duplicate(userId, row, id);
      row.mealPlanId = plan(userId, row.mealDate); items.set(id, row); return dto(row);
    },
    async remove(userId, id) { if (!owned(userId, id)) return false; return items.delete(id); },
  } };
}

async function fixture() {
  const config = getAuthConfig({ JWT_SECRET: randomBytes(48).toString('base64'),
    PASSWORD_PEPPER: randomBytes(48).toString('base64'), CLIENT_ORIGIN: origin });
  const users = new Map([1, 2, 3].map((userId) => [userId, { userId, fullName: `Fixture ${userId}`,
    email: `fixture${userId}@example.com`, role: userId === 3 ? 'Admin' : 'User' }]));
  const storage = memoryRepository();
  const security = createAuthSecurity({ config, repository: { async findById(id) { return users.get(id) ?? null; } } });
  const app = express(); app.use(express.json());
  app.use('/api/auth', createAuthRouter({ security }));
  app.use('/api/meal-plans', createMealPlanRouter({ security, repository: storage.repository }));
  app.use(errorHandler);
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;
  async function client(userId) {
    const cookies = new Map(); let csrfToken;
    if (userId) security.establishSession({ headers: {} }, { cookie(name, value) { cookies.set(name, value); } }, users.get(userId));
    async function send(path = `/api/meal-plans?weekStart=${weekStart}`, { method = 'GET', body, headers = {}, cookie } = {}) {
      const response = await fetch(base + path, { method,
        headers: { Cookie: cookie ?? [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
          ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body) });
      for (const setCookie of response.headers.getSetCookie()) {
        const pair = setCookie.split(';')[0]; const index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    csrfToken = (await send('/api/auth/csrf')).body.csrfToken;
    return { send, cookies };
  }
  return { ...storage, security, users, config, client,
    async close() { listener.closeAllConnections(); await new Promise((resolve) => listener.close(resolve)); } };
}

test('meal planner dates validate Gregorian leap years and complete SQL DATE weeks', () => {
  for (const date of ['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-26']) assert.equal(readMealDate(date), date);
  for (const date of ['0000-01-01', '1900-02-29', '2025-02-29', '2026-04-31', '2026-13-01', '2026-01-00',
    '2026-1-01', '2026-01-1', ' 2026-01-01', '2026-01-01T00:00:00Z', '9999-12-27', '', null, 1]) {
    assert.throws(() => readMealDate(date), status(400));
  }
});

test('meal planner calendar arithmetic crosses months, leap days, years and Sundays without timezone conversion', () => {
  for (const [date, days, expected] of [['2026-10-31', 1, '2026-11-01'], ['2024-02-28', 1, '2024-02-29'],
    ['2024-02-29', 1, '2024-03-01'], ['2026-12-31', 1, '2027-01-01'], ['2027-01-01', -1, '2026-12-31'],
    ['0001-01-01', 6, '0001-01-07'], ['0099-12-31', 1, '0100-01-01']]) assert.equal(addCalendarDays(date, days), expected);
  assert.equal(weekStartForDate('2027-01-01'), '2026-12-28');
  assert.equal(weekStartForDate('2026-11-01'), '2026-10-26');
  assert.equal(weekStartForDate('2026-11-02'), '2026-11-02');
  assert.equal(weekStartForDate('9999-12-26'), '9999-12-20');
  assert.throws(() => addCalendarDays('0001-01-01', -1), status(400));
  assert.throws(() => addCalendarDays('9999-12-26', 1), status(400));
});

test('meal planner query requires one Monday and rejects ownership/unknown/repeated parameters', () => {
  assert.deepEqual(parseMealPlanQuery({ weekStart }), { weekStart, weekEnd: '2026-11-01' });
  assert.equal(parseMealPlanQuery({ weekStart: '0001-01-01' }).weekEnd, '0001-01-07');
  assert.equal(parseMealPlanQuery({ weekStart: '9999-12-20' }).weekEnd, '9999-12-26');
  for (const query of [{}, null, [], { weekStart: '2026-10-27' }, { weekStart: [weekStart, weekStart] },
    { weekStart, userId: '2' }, { weekStart, role: 'Admin' }, { weekStart: '2026-10-26;DELETE FROM dbo.Users' }]) {
    assert.throws(() => parseMealPlanQuery(query), status(400));
  }
});

test('meal planner create validates all required fields and rejects ID coercion/overposting', () => {
  assert.deepEqual(validateMealPlanCreate(input), { ...input, sortOrder: 0 });
  assert.equal(validateMealPlanCreate({ ...input, recipeId: 2_147_483_647, servings: 20, sortOrder: 2_147_483_647 }).servings, 20);
  for (const body of [null, [], {}, { ...input, recipeId: '1' }, { ...input, recipeId: 0 }, { ...input, recipeId: 2_147_483_648 },
    { ...input, userId: 2 }, { ...input, mealPlanId: 1 }, { ...input, role: 'Admin' }, { ...input, mealType: 'lunch' },
    { ...input, mealType: 'Lunch ' }, { ...input, mealType: ['Lunch'] }, { ...input, servings: '2' },
    { ...input, servings: 0 }, { ...input, servings: 21 }, { ...input, servings: 1.5 }, { ...input, servings: NaN },
    { ...input, sortOrder: -1 }, { ...input, sortOrder: 1.5 }, { ...input, sortOrder: '0' }]) {
    assert.throws(() => validateMealPlanCreate(body), status(400));
  }
});

test('meal planner partial edits and deletion prohibit immutable ownership/recipe fields and unsafe IDs', () => {
  assert.deepEqual(validateMealPlanUpdate({ servings: 1, mealDate: '2026-11-02', mealType: 'Dinner', sortOrder: 0 }),
    { servings: 1, mealDate: '2026-11-02', mealType: 'Dinner', sortOrder: 0 });
  for (const body of [{}, null, [], { recipeId: 2 }, { mealPlanId: 2 }, { userId: 2 }, { servings: null }, { mealDate: '2025-02-29' }]) {
    assert.throws(() => validateMealPlanUpdate(body), status(400));
  }
  validateMealPlanDelete({});
  for (const body of [undefined, null, [], { userId: 1 }, { recipeId: 1 }]) assert.throws(() => validateMealPlanDelete(body), status(400));
  assert.equal(readMealPlanItemId('2147483647'), 2_147_483_647);
  for (const id of ['0', '01', '-1', '1e2', '1;DELETE FROM dbo.MealPlans', ['1'], '2147483648']) {
    assert.throws(() => readMealPlanItemId(id), status(400));
  }
});

test('shopping list uses each recipe original servings and exactly aggregates repeated planned occurrences', () => {
  const rows = [shoppingRow(), shoppingRow({ mealPlanItemId: 2 }), shoppingRow({ mealPlanItemId: 3 })];
  assert.equal(aggregateShoppingList(rows)[0].totalQuantity, '4');
  assert.equal(aggregateShoppingList(rows)[0].recipeCount, 1);
  assert.equal(aggregateShoppingList(rows)[0].plannedItemCount, 3);
  assert.equal(aggregateShoppingList([shoppingRow({ originalServings: 4, servings: 1 })])[0].totalQuantity, '0.5');
});

test('shopping list rounds upwards only after exact summation and never underestimates small amounts', () => {
  assert.equal(aggregateShoppingList([shoppingRow({ quantity: '1.00', servings: 1, originalServings: 3 })])[0].totalQuantity, '0.333334');
  const thirds = [1, 2, 3].map((mealPlanItemId) => shoppingRow({ mealPlanItemId, quantity: '1.00', servings: 1, originalServings: 3 }));
  assert.equal(aggregateShoppingList(thirds)[0].totalQuantity, '1');
  assert.equal(aggregateShoppingList([shoppingRow({ quantity: '0.01', servings: 1, originalServings: 2_147_483_647 })])[0].totalQuantity, '0.000001');
  assert.equal(aggregateShoppingList([shoppingRow({ quantity: '9999999999.99', servings: 20, originalServings: 1 })])[0].totalQuantity, '199999999999.8');
});

test('shopping list keeps exact units and ingredient identities separate without unit conversion', () => {
  const result = aggregateShoppingList([shoppingRow({ unit: 'g', originalServings: 2 }),
    shoppingRow({ mealPlanItemId: 2, unit: 'kg', quantity: '0.50', originalServings: 2 }),
    shoppingRow({ mealPlanItemId: 3, unit: 'G', originalServings: 2 }),
    shoppingRow({ mealPlanItemId: 4, ingredientId: 2, unit: 'g', originalServings: 2 })]);
  assert.equal(result.length, 4);
  assert.deepEqual(result.map((row) => [row.ingredientId, row.unit, row.totalQuantity]).sort(),
    [[1, 'g', '2'], [1, 'kg', '0.5'], [1, 'G', '2'], [2, 'g', '2']].sort());
});

test('shopping list excludes optional ingredients and deduplicates recipe labels rather than planned quantities', () => {
  const result = aggregateShoppingList([shoppingRow({ originalServings: 2 }),
    shoppingRow({ mealPlanItemId: 2, recipeId: 2, recipeName: 'Món hai', originalServings: 2 }),
    shoppingRow({ mealPlanItemId: 3, originalServings: 2 }), shoppingRow({ ingredientId: 3, isRequired: false })]);
  assert.equal(result.length, 1); assert.equal(result[0].totalQuantity, '6');
  assert.equal(result[0].recipeCount, 2); assert.equal(result[0].plannedItemCount, 3);
  assert.deepEqual(result[0].recipes, [{ recipeId: 1, recipeName: 'Món một' }, { recipeId: 2, recipeName: 'Món hai' }]);
  assert.deepEqual(aggregateShoppingList([]), []);
  assert.deepEqual(aggregateShoppingList([shoppingRow({ isRequired: false })]), []);
});

test('shopping list refuses malformed SQL decimal and invalid base servings instead of silently rounding', () => {
  for (const quantity of [2, '1e2', '-1.00', '0.00', '1.001', 'NaN']) assert.throws(() => aggregateShoppingList([shoppingRow({ quantity })]));
  for (const originalServings of [0, -1, '2', 1.5, NaN]) assert.throws(() => aggregateShoppingList([shoppingRow({ originalServings })]));
});

test('meal planner GET returns all seven days and truthful zero summaries without writing empty plans', async () => {
  const storage = memoryRepository(); const service = createMealPlanService(storage);
  const { data } = await service.getWeek(1, { weekStart });
  assert.equal(data.mealPlanId, null); assert.equal(data.days.length, 7);
  assert.equal(data.days[6].date, '2026-11-01');
  assert.deepEqual(data.summary, { itemCount: 0, mealCount: 0, dayCount: 0, ingredientCount: 0 });
  assert.equal(storage.plans.size, 0);
});

test('meal planner supports multiple dishes per meal, repeated recipes across dates/meals, and derived counts', async () => {
  const service = createMealPlanService(memoryRepository());
  await service.add(1, input); await service.add(1, { ...input, recipeId: 2 });
  await service.add(1, { ...input, mealType: 'Breakfast' }); await service.add(1, { ...input, mealType: 'Dinner' });
  await service.add(1, { ...input, mealDate: '2026-10-27' });
  await assert.rejects(service.add(1, input), status(409));
  const { data } = await service.getWeek(1, { weekStart });
  assert.equal(data.days[0].meals.Lunch.length, 2);
  assert.deepEqual(data.summary, { itemCount: 5, mealCount: 4, dayCount: 2, ingredientCount: 1 });
});

test('meal planner changes servings/date/type/order and moves atomically to another week in the repository contract', async () => {
  const service = createMealPlanService(memoryRepository());
  const created = (await service.add(1, input)).data;
  const changed = (await service.update(1, String(created.mealPlanItemId), { mealDate: '2026-11-03', mealType: 'Dinner', servings: 20, sortOrder: 7 })).data;
  assert.notEqual(changed.mealPlanId, created.mealPlanId); assert.equal(changed.servings, 20); assert.equal(changed.sortOrder, 7);
  assert.equal((await service.getWeek(1, { weekStart })).data.summary.itemCount, 0);
  assert.equal((await service.getWeek(1, { weekStart: '2026-11-02' })).data.days[1].meals.Dinner.length, 1);
});

test('meal planner ownership isolates reads, shopping, mutations and deletion without removing recipes', async () => {
  const storage = memoryRepository(); const service = createMealPlanService(storage);
  const created = (await service.add(1, input)).data;
  assert.equal((await service.getWeek(2, { weekStart })).data.summary.itemCount, 0);
  assert.deepEqual((await service.shoppingList(2, { weekStart })).data.items, []);
  await assert.rejects(service.update(2, String(created.mealPlanItemId), { servings: 4 }), status(404));
  await assert.rejects(service.remove(2, String(created.mealPlanItemId), {}), status(404));
  assert.equal((await service.shoppingList(1, { weekStart })).data.items[0].totalQuantity, '1.333334');
  await service.update(1, String(created.mealPlanItemId), { servings: 3 });
  assert.equal((await service.shoppingList(1, { weekStart })).data.items[0].totalQuantity, '2');
  await service.remove(1, String(created.mealPlanItemId), {});
  assert.deepEqual((await service.shoppingList(1, { weekStart })).data.items, []);
  assert.equal(storage.recipes.size, 3);
  await assert.rejects(service.remove(1, String(created.mealPlanItemId), {}), status(404));
});

test('meal planner maps nested SQL conflicts/check/deadlocks without claiming writes succeeded', async () => {
  for (const [error, expected] of [[{ number: 2627 }, 409], [{ originalError: { info: { number: 2601 } } }, 409],
    [{ precedingErrors: [{ number: 547 }] }, 400], [{ number: 1205 }, 409]]) {
    const repository = { async create() { throw error; }, async update() { throw error; }, async remove() { throw error; } };
    const service = createMealPlanService({ repository });
    await assert.rejects(service.add(1, input), status(expected));
    await assert.rejects(service.update(1, '1', { servings: 3 }), status(expected));
    await assert.rejects(service.remove(1, '1', {}), status(expected));
  }
  const failure = new Error('storage unavailable');
  await assert.rejects(createMealPlanService({ repository: { async create() { throw failure; } } }).add(1, input), (error) => error === failure);
});

test('meal planner SQL reads bind owner/week and retain DECIMAL text and calendar dates', async () => {
  const calls = [];
  const repository = createMealPlanRepository({ request: async () => {
    const inputs = {}; return { input(name, _type, value) { inputs[name] = value; return this; },
      async query(statement) { calls.push({ statement, inputs });
        if (statement.includes('COUNT(DISTINCT')) return { recordsets: [[], [], [{ ingredientCount: '0' }]] };
        return { recordset: [{ ...shoppingRow(), quantity: '9999999999.99', mealPlanItemId: '3', ingredientId: '4' }] };
      } };
  } });
  assert.deepEqual(await repository.getWeek(7, weekStart), { mealPlanId: null, items: [], ingredientCount: 0 });
  const rows = await repository.getShoppingRows(7, weekStart);
  assert.equal(rows[0].quantity, '9999999999.99'); assert.equal(rows[0].ingredientId, 4);
  for (const call of calls) {
    assert.deepEqual(call.inputs, { userId: 7, weekStart });
    assert.match(call.statement, /p\.UserID = @userId/u);
    assert.equal(call.statement.includes(weekStart), false);
    assert.doesNotMatch(call.statement, /UserIngredients/u);
  }
});

function writeProbe() {
  const calls = [];
  const ownerId = 507;
  const item = { mealPlanItemId: 87, mealPlanId: 42, recipeId: 9, recipeName: 'Công thức fixture', imageUrl: null,
    mealDate: weekStart, mealType: 'Lunch', servings: 3, originalServings: 2, prepTime: 5, cookTime: 10, totalTime: 15, sortOrder: 0 };
  let transactions = 0;
  const scopedRequest = async () => {
    const inputs = {};
    return { input(name, _type, value) { inputs[name] = value; return this; },
      async query(statement) {
        calls.push({ statement, inputs });
        if (statement.includes('SELECT UserID FROM dbo.Users')) return { recordset: [{ UserID: ownerId }] };
        if (statement.includes('SELECT RecipeID FROM dbo.Recipes')) return { recordset: [{ RecipeID: item.recipeId }] };
        if (statement.includes('DECLARE @planId INT')) return { recordset: [{ mealPlanId: 42 }] };
        if (statement.includes('SELECT i.MealPlanItemID FROM')) return { recordset: [] };
        if (statement.includes('OUTPUT INSERTED.MealPlanItemID')) return { recordset: [{ id: item.mealPlanItemId }] };
        if (statement.includes('AS mealPlanItemId')) return { recordset: [{ ...item }] };
        return { recordset: [] };
      } };
  };
  const repository = createMealPlanRepository({
    request() { throw new Error('A mutation must never escape its scoped transaction request.'); },
    async withTransaction(work) { transactions++; return work(scopedRequest); },
  });
  return { repository, calls, ownerId, item, transactions: () => transactions };
}

test('meal planner SQL create holds owner lock before creating the week and binds every mutation inside one transaction', async () => {
  const probe = writeProbe();
  const created = await probe.repository.create(probe.ownerId, validateMealPlanCreate({ ...input, recipeId: 9 }));
  assert.equal(created.mealPlanItemId, probe.item.mealPlanItemId);
  assert.equal(probe.transactions(), 1);
  assert.match(probe.calls[0].statement, /dbo\.Users WITH \(UPDLOCK, HOLDLOCK\).*UserID = @userId/u);
  assert.equal(probe.calls[0].inputs.userId, probe.ownerId);
  const week = probe.calls.find((call) => call.statement.includes('DECLARE @planId INT'));
  assert.equal(week.inputs.weekStart, weekStart);
  assert.equal(week.inputs.userId, probe.ownerId);
  const duplicate = probe.calls.find((call) => call.statement.includes('SELECT i.MealPlanItemID FROM'));
  assert.match(duplicate.statement, /WITH \(UPDLOCK, HOLDLOCK\)/u);
  assert.match(duplicate.statement, /p\.UserID = @userId/u);
  assert.deepEqual(duplicate.inputs, { userId: probe.ownerId, planId: 42, recipeId: 9, mealDate: weekStart, mealType: 'Lunch', excludeId: null });
  for (const call of probe.calls) {
    assert.equal(call.statement.includes(String(probe.ownerId)), false);
    assert.equal(call.statement.includes(weekStart), false);
    assert.doesNotMatch(call.statement, /UserIngredients|Favorites|Reviews/u);
  }
});

test('meal planner SQL move and deletion retain session ownership and consistently acquire owner before item locks', async () => {
  const probe = writeProbe();
  await probe.repository.update(probe.ownerId, probe.item.mealPlanItemId, { mealDate: '2026-11-03', mealType: 'Dinner', servings: 4 });
  assert.equal(probe.transactions(), 1);
  assert.match(probe.calls[0].statement, /dbo\.Users WITH \(UPDLOCK, HOLDLOCK\)/u);
  assert.match(probe.calls[1].statement, /dbo\.MealPlanItems AS i WITH \(UPDLOCK, HOLDLOCK\)/u);
  assert.match(probe.calls[1].statement, /p\.UserID = @userId AND i\.MealPlanItemID = @id/u);
  const week = probe.calls.find((call) => call.statement.includes('DECLARE @planId INT'));
  assert.deepEqual(week.inputs, { userId: probe.ownerId, weekStart: '2026-11-02' });
  const update = probe.calls.find((call) => call.statement.includes('UPDATE i SET MealPlanID'));
  assert.equal(update.inputs.userId, probe.ownerId);
  assert.equal(update.inputs.mealDate, '2026-11-03');
  assert.match(update.statement, /p\.UserID = @userId AND i\.MealPlanItemID = @id/u);
  probe.calls.length = 0;
  assert.equal(await probe.repository.remove(probe.ownerId, probe.item.mealPlanItemId), true);
  assert.equal(probe.transactions(), 2);
  assert.match(probe.calls[0].statement, /dbo\.Users WITH \(UPDLOCK, HOLDLOCK\)/u);
  const remove = probe.calls.find((call) => call.statement.includes('DELETE i FROM'));
  assert.deepEqual(remove.inputs, { userId: probe.ownerId, id: probe.item.mealPlanItemId });
  assert.match(remove.statement, /p\.UserID = @userId AND i\.MealPlanItemID = @id/u);
  assert.doesNotMatch(remove.statement, /DELETE FROM dbo\.Recipes|UserIngredients|Favorites|Reviews/u);
});

function transactionProbe({ commitFailure, rollbackFailure } = {}) {
  const events = [], transactions = [];
  const options = {
    async getConnection() { events.push('connection'); return { fixture: true }; },
    createTransaction(pool) {
      assert.equal(pool.fixture, true);
      const id = transactions.length + 1;
      const transaction = {
        id,
        async begin(level) { assert.equal(level, sql.ISOLATION_LEVEL.SERIALIZABLE); events.push(`begin:${id}`); },
        async commit() { events.push(`commit:${id}`); if (commitFailure) throw commitFailure; },
        async rollback() { events.push(`rollback:${id}`); if (rollbackFailure) throw rollbackFailure; },
      };
      transactions.push(transaction); return transaction;
    },
    createRequest(transaction) { events.push(`request:${transaction.id}`); return { transaction }; },
  };
  return { options, events, transactions };
}

test('meal planner transaction uses SERIALIZABLE and commits only the successfully completed work', async () => {
  const probe = transactionProbe();
  const output = await runMealPlanTransaction(async (request) => {
    const first = await request(), second = await request();
    assert.equal(first.transaction, second.transaction);
    return { mealPlanItemId: 17 };
  }, probe.options);
  assert.deepEqual(output, { mealPlanItemId: 17 });
  assert.deepEqual(probe.events, ['connection', 'begin:1', 'request:1', 'request:1', 'commit:1']);
});

test('meal planner deadlock retries start fresh transactions only after previous work was rolled back', async () => {
  const probe = transactionProbe(); let attempts = 0;
  const errors = [{ originalError: { number: 1205 } }, { precedingErrors: [{ originalError: { info: { number: '1205' } } }] }];
  const result = await runMealPlanTransaction(async (request) => {
    const query = await request(); attempts++;
    assert.equal(query.transaction.id, attempts);
    if (attempts <= errors.length) throw errors[attempts - 1];
    return 'saved';
  }, probe.options);
  assert.equal(result, 'saved'); assert.equal(attempts, 3);
  assert.deepEqual(probe.events, ['connection', 'begin:1', 'request:1', 'rollback:1',
    'connection', 'begin:2', 'request:2', 'rollback:2', 'connection', 'begin:3', 'request:3', 'commit:3']);
});

test('meal planner deadlock retries stop after three failed attempts without committing any work', async () => {
  const probe = transactionProbe(); const failure = { number: 1205 };
  await assert.rejects(runMealPlanTransaction(async (request) => { await request(); throw failure; }, probe.options), (error) => error === failure);
  assert.equal(probe.transactions.length, 3);
  assert.deepEqual(probe.events.filter((event) => event.startsWith('rollback:')), ['rollback:1', 'rollback:2', 'rollback:3']);
  assert.equal(probe.events.some((event) => event.startsWith('commit:')), false);
});

test('meal planner does not retry other SQL failures and preserves the original error even when rollback fails', async () => {
  const failure = { number: 547 }; const probe = transactionProbe({ rollbackFailure: new Error('rollback fixture failed') });
  await assert.rejects(runMealPlanTransaction(async () => { throw failure; }, probe.options), (error) => error === failure);
  assert.equal(probe.transactions.length, 1);
  assert.deepEqual(probe.events, ['connection', 'begin:1', 'rollback:1']);
});

test('meal planner commit failures propagate after rollback instead of reporting a successful mutation', async () => {
  const failure = new Error('fixture commit failed'); const probe = transactionProbe({ commitFailure: failure });
  await assert.rejects(runMealPlanTransaction(async () => 'must not report success', probe.options), (error) => error === failure);
  assert.deepEqual(probe.events, ['connection', 'begin:1', 'commit:1', 'rollback:1']);
  assert.equal(probe.transactions.length, 1);
});

test('meal planner HTTP denies guests on every route and sends private no-store', async (t) => {
  const f = await fixture(); t.after(() => f.close()); const guest = await f.client();
  for (const [path, options] of [[`/api/meal-plans?weekStart=${weekStart}`, {}],
    [`/api/meal-plans/shopping-list?weekStart=${weekStart}`, {}], ['/api/meal-plans/items', { method: 'POST', body: input }],
    ['/api/meal-plans/items/1', { method: 'PATCH', body: { servings: 1 } }], ['/api/meal-plans/items/1', { method: 'DELETE', body: {} }]]) {
    const response = await guest.send(path, options); assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('meal planner HTTP CRUD works for User and Admin sessions but never trusts client ownership', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const a = await f.client(1); const b = await f.client(2); const admin = await f.client(3);
  const created = await a.send('/api/meal-plans/items', { method: 'POST', body: input });
  assert.equal(created.status, 201); const id = created.body.data.mealPlanItemId;
  assert.equal(created.body.data.userId, undefined); assert.equal(created.body.data.passwordHash, undefined);
  assert.equal((await b.send()).body.data.summary.itemCount, 0);
  assert.equal((await admin.send()).body.data.summary.itemCount, 0);
  assert.equal((await admin.send('/api/meal-plans/items', { method: 'POST', body: input })).status, 201);
  assert.equal((await b.send(`/api/meal-plans/items/${id}`, { method: 'PATCH', body: { servings: 5 } })).status, 404);
  assert.equal((await b.send(`/api/meal-plans/items/${id}`, { method: 'DELETE', body: {} })).status, 404);
  assert.equal((await a.send(`/api/meal-plans/items/${id}`, { method: 'PATCH', body: { servings: 5 } })).body.data.servings, 5);
  assert.equal((await a.send(`/api/meal-plans/items/${id}`, { method: 'DELETE', body: {} })).status, 200);
  assert.equal((await a.send()).body.data.summary.itemCount, 0);
});

test('meal planner HTTP enforces CSRF, Origin and JSON for all mutations before storing changes', async (t) => {
  const f = await fixture(); t.after(() => f.close()); const user = await f.client(1);
  for (const headers of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': 'invalid' }, { Origin: '' }, { Origin: 'null' }, { Origin: 'https://evil.example' }]) {
    assert.equal((await user.send('/api/meal-plans/items', { method: 'POST', body: input, headers })).status, 403);
  }
  assert.equal((await user.send('/api/meal-plans/items', { method: 'POST', body: input, headers: { 'Content-Type': 'text/plain' } })).status, 400);
  assert.equal(f.items.size, 0);
  const id = (await user.send('/api/meal-plans/items', { method: 'POST', body: input })).body.data.mealPlanItemId;
  assert.equal((await user.send(`/api/meal-plans/items/${id}`, { method: 'PATCH', body: { servings: 3 }, headers: { 'X-CSRF-Token': '' } })).status, 403);
  assert.equal((await user.send(`/api/meal-plans/items/${id}`, { method: 'DELETE', body: {}, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal(f.items.size, 1);
});

test('meal planner HTTP rejects injection, repeated params, invalid forms, missing recipes and duplicates', async (t) => {
  const f = await fixture(); t.after(() => f.close()); const user = await f.client(1);
  for (const suffix of ['', '?weekStart=2026-10-27', `?weekStart=${weekStart}&weekStart=${weekStart}`, `?weekStart=${weekStart}&userId=2`,
    '?weekStart=2026-10-26%27%3BDELETE%20FROM%20dbo.Users--']) {
    assert.equal((await user.send(`/api/meal-plans${suffix}`)).status, 400);
    assert.equal((await user.send(`/api/meal-plans/shopping-list${suffix}`)).status, 400);
  }
  for (const body of [{ ...input, userId: 2 }, { ...input, servings: 21 }, { ...input, mealType: 'Sáng' }, { ...input, mealDate: '2025-02-29' }]) {
    assert.equal((await user.send('/api/meal-plans/items', { method: 'POST', body })).status, 400);
  }
  assert.equal((await user.send('/api/meal-plans/items?userId=2', { method: 'POST', body: input })).status, 400);
  assert.equal((await user.send('/api/meal-plans/items/1?userId=2', { method: 'PATCH', body: { servings: 2 } })).status, 400);
  assert.equal((await user.send('/api/meal-plans/items/1?userId=2', { method: 'DELETE', body: {} })).status, 400);
  assert.equal((await user.send('/api/meal-plans/items', { method: 'POST', body: { ...input, recipeId: 999 } })).status, 404);
  assert.equal((await user.send('/api/meal-plans/items', { method: 'POST', body: input })).status, 201);
  assert.equal((await user.send('/api/meal-plans/items', { method: 'POST', body: input })).status, 409);
  assert.equal((await user.send('/api/meal-plans/items/01', { method: 'PATCH', body: { servings: 1 } })).status, 400);
  assert.equal((await user.send('/api/meal-plans/items/1', { method: 'DELETE', body: { userId: 2 } })).status, 400);
});

test('meal planner HTTP shopping list recalculates after edits and is private to the requesting owner', async (t) => {
  const f = await fixture(); t.after(() => f.close()); const a = await f.client(1); const b = await f.client(2);
  const path = `/api/meal-plans/shopping-list?weekStart=${weekStart}`;
  assert.deepEqual((await a.send(path)).body.data.items, []);
  const id = (await a.send('/api/meal-plans/items', { method: 'POST', body: input })).body.data.mealPlanItemId;
  assert.equal((await a.send(path)).body.data.items[0].totalQuantity, '1.333334');
  assert.deepEqual((await b.send(path)).body.data.items, []);
  await a.send(`/api/meal-plans/items/${id}`, { method: 'PATCH', body: { servings: 3 } });
  assert.equal((await a.send(path)).body.data.items[0].totalQuantity, '2');
  await a.send(`/api/meal-plans/items/${id}`, { method: 'DELETE', body: {} });
  assert.deepEqual((await a.send(path)).body.data.items, []);
});

test('meal planner HTTP rechecks live account role and denies removed, expired and revoked sessions', async (t) => {
  const f = await fixture(); t.after(() => f.close()); const a = await f.client(1); const b = await f.client(2);
  const captured = [...a.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  const claims = jwt.decode(a.cookies.get(f.config.cookieName)); const now = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ ...claims, iat: now - 60, exp: now - 1 }, f.config.jwtSecret);
  assert.equal((await a.send(undefined, { cookie: `${f.config.cookieName}=${expired}` })).status, 401);
  assert.equal((await a.send('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await a.send(undefined, { cookie: captured })).status, 401);
  assert.equal((await a.send('/api/meal-plans/items', { method: 'POST', body: input, cookie: captured })).status, 401);
  f.users.delete(2); assert.equal((await b.send()).status, 401);
  assert.equal(f.items.size, 0);
});
