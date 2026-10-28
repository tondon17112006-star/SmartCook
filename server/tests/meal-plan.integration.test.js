import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createMealPlanFixture } from './helpers/meal-plan-fixture.js';
import { weekStartForDate } from '../src/utilities/meal-plan-validation.js';

let f; let baseline; let categoryId; let ingredients; let recipeA; let recipeB;
const tag = `Lịch thử ${randomBytes(8).toString('hex')}`;
const weekStart = '2026-10-26';
const planPath = `/api/meal-plans?weekStart=${weekStart}`;
const shopPath = `/api/meal-plans/shopping-list?weekStart=${weekStart}`;
const input = (changes = {}) => ({ recipeId: recipeA, mealDate: weekStart, mealType: 'Lunch', servings: 2, ...changes });
const add = (body, client = f.admin) => client.mutate('/api/meal-plans/items', body);
const edit = (id, body, client = f.admin) => client.mutate(`/api/meal-plans/items/${id}`, body, { method: 'PATCH' });
const remove = (id, client = f.admin) => client.mutate(`/api/meal-plans/items/${id}`, {}, { method: 'DELETE' });
const rows = async (statement) => (await f.request().query(statement)).recordset;
async function clearOwner(client = f.admin) {
  await f.request().input('userId', client.user.userId).query(`
    DELETE i FROM dbo.MealPlanItems AS i INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID WHERE p.UserID = @userId;
    DELETE FROM dbo.MealPlans WHERE UserID = @userId;`);
}
async function countWeek(date, client = f.admin) {
  return Number((await f.request().input('userId', client.user.userId).input('weekStart', date).query(`
    SELECT COUNT_BIG(*) AS n FROM dbo.MealPlans WHERE UserID = @userId AND WeekStartDate = CONVERT(DATE, @weekStart, 23);`)).recordset[0].n);
}
function recipeBody(name, originalServings, ingredientRows) {
  return { recipeName: `${tag} ${name}`, categoryId, description: 'Công thức trong transaction Meal Planner.',
    imageUrl: null, prepTime: 5, cookTime: 10, servings: originalServings, difficulty: 'Dễ',
    ingredients: ingredientRows, steps: [{ stepNumber: 1, instruction: 'Chuẩn bị và nấu chín nguyên liệu.', imageUrl: null }] };
}

before(async () => {
  f = await createMealPlanFixture();
  baseline = (await rows(`SELECT (SELECT COUNT_BIG(*) FROM dbo.Recipes) AS recipes,
    (SELECT COUNT_BIG(*) FROM dbo.UserIngredients) AS pantry, (SELECT COUNT_BIG(*) FROM dbo.Favorites) AS favorites,
    (SELECT COUNT_BIG(*) FROM dbo.Reviews) AS reviews;`))[0];
  categoryId = Number((await rows('SELECT TOP(1) CategoryID AS id FROM dbo.Categories ORDER BY CategoryID;'))[0].id);
  ingredients = (await rows('SELECT TOP(3) IngredientID AS id FROM dbo.Ingredients ORDER BY IngredientID;')).map((row) => Number(row.id));
  assert.equal(ingredients.length, 3);
  const first = await f.admin.mutate('/api/admin/recipes', recipeBody('A', 3, [
    { ingredientId: ingredients[0], quantity: 1.25, unit: 'g', isRequired: true },
    { ingredientId: ingredients[1], quantity: 3, unit: 'ml', isRequired: false },
    { ingredientId: ingredients[2], quantity: 2, unit: 'quả', isRequired: true },
  ]));
  assert.equal(first.status, 201); recipeA = first.body.data.recipeId;
  const second = await f.admin.mutate('/api/admin/recipes', recipeBody('B', 4, [
    { ingredientId: ingredients[0], quantity: 2.5, unit: 'kg', isRequired: true },
    { ingredientId: ingredients[1], quantity: 3, unit: 'ml', isRequired: true },
    { ingredientId: ingredients[2], quantity: 1, unit: 'quả', isRequired: true },
  ]));
  assert.equal(second.status, 201); recipeB = second.body.data.recipeId;
});
after(async () => { await f?.close(); });

test('MP SQL: authenticated sessions remain SQL Users; Guest cannot access any private meal endpoint', async () => {
  const stored = await f.request().input('a', f.admin.user.userId).input('b', f.ordinary.user.userId)
    .query('SELECT Role AS role FROM dbo.Users WHERE UserID IN (@a,@b);');
  assert.equal(stored.recordset.length, 2); assert.equal(stored.recordset.every((row) => row.role === 'User'), true);
  for (const [path, options] of [[planPath, {}], [shopPath, {}],
    ['/api/meal-plans/items', { method: 'POST', body: input() }],
    ['/api/meal-plans/items/1', { method: 'PATCH', body: { servings: 3 } }],
    ['/api/meal-plans/items/1', { method: 'DELETE', body: {} }]]) {
    const response = await f.guest.send(path, options); assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/u);
  }
});

test('MP SQL: GET returns seven empty days without inserting a plan and accepts edge complete weeks', async () => {
  assert.equal(await countWeek(weekStart), 0);
  for (const date of [weekStart, '0001-01-01', '9999-12-20']) {
    const result = await f.admin.send(`/api/meal-plans?weekStart=${date}`);
    assert.equal(result.status, 200); assert.equal(result.body.data.mealPlanId, null);
    assert.equal(result.body.data.days.length, 7);
    assert.deepEqual(result.body.data.summary, { itemCount: 0, mealCount: 0, dayCount: 0, ingredientCount: 0 });
    assert.equal(await countWeek(date), 0);
  }
  assert.deepEqual((await f.admin.send(shopPath)).body.data.items, []);
});

test('MP SQL: creates one week, all three meal types, multiple dishes and persists real recipe metadata', async () => {
  const created = [];
  for (const mealType of ['Breakfast', 'Lunch', 'Dinner']) {
    const result = await add(input({ mealType })); assert.equal(result.status, 201); created.push(result.body.data);
  }
  assert.equal((await add(input({ recipeId: recipeB }))).status, 201);
  assert.equal(new Set(created.map((item) => item.mealPlanId)).size, 1);
  assert.equal(await countWeek(weekStart), 1);
  const schedule = await f.admin.send(planPath); assert.equal(schedule.status, 200);
  assert.equal(schedule.body.data.days[0].meals.Lunch.length, 2);
  assert.deepEqual(schedule.body.data.summary, { itemCount: 4, mealCount: 3, dayCount: 1, ingredientCount: 3 });
  const actual = (await f.request().input('id', created[0].mealPlanItemId).query(`SELECT CONVERT(CHAR(10),MealDate,23) AS mealDate,
    MealType AS mealType, Servings AS servings FROM dbo.MealPlanItems WHERE MealPlanItemID=@id;`)).recordset[0];
  assert.equal(actual.mealDate, weekStart); assert.equal(actual.mealType, 'Breakfast'); assert.equal(Number(actual.servings), 2);
  assert.equal(created[0].originalServings, 3); assert.equal(created[0].totalTime, 15);
});

test('MP SQL: duplicate same recipe/date/meal is409; different date and different owner are permitted', async () => {
  assert.equal((await add(input())).status, 409);
  assert.equal((await add(input({ mealDate: '2026-10-27' }))).status, 201);
  assert.equal((await add(input(), f.ordinary)).status, 201);
  const a = (await f.admin.send(planPath)).body.data;
  const b = (await f.ordinary.send(planPath)).body.data;
  assert.notEqual(a.mealPlanId, b.mealPlanId); assert.equal(a.summary.itemCount, 5); assert.equal(b.summary.itemCount, 1);
});

test('MP SQL: owner checks reject viewing/query injection and cross-user edits/deletion with404', async () => {
  const ownerItem = (await f.admin.send(planPath)).body.data.days[0].meals.Breakfast[0];
  assert.equal((await edit(ownerItem.mealPlanItemId, { servings: 20 }, f.ordinary)).status, 404);
  assert.equal((await remove(ownerItem.mealPlanItemId, f.ordinary)).status, 404);
  assert.equal((await f.ordinary.send(`${planPath}&userId=${f.admin.user.userId}`)).status, 400);
  assert.equal((await f.ordinary.send(`${shopPath}&userId=${f.admin.user.userId}`)).status, 400);
  assert.equal((await add({ ...input(), userId: f.admin.user.userId }, f.ordinary)).status, 400);
  assert.equal((await f.admin.mutate('/api/meal-plans/items?userId=2', input())).status, 400);
  assert.equal((await f.admin.send(planPath)).body.data.days[0].meals.Breakfast[0].servings, 2);
});

test('MP SQL: PATCH saves servings/order, moves meals/dates, and collision rollback preserves previous item', async () => {
  const item = (await f.admin.send(planPath)).body.data.days[0].meals.Breakfast[0];
  const saved = await edit(item.mealPlanItemId, { servings: 20, sortOrder: 8 });
  assert.equal(saved.status, 200); assert.equal(saved.body.data.servings, 20); assert.equal(saved.body.data.sortOrder, 8);
  assert.equal((await edit(item.mealPlanItemId, { mealType: 'Lunch' })).status, 409);
  const unchanged = (await f.admin.send(planPath)).body.data.days[0].meals.Breakfast[0];
  assert.equal(unchanged.mealType, 'Breakfast'); assert.equal(unchanged.servings, 20);
  const moved = await edit(item.mealPlanItemId, { mealDate: '2026-10-28', mealType: 'Dinner' });
  assert.equal(moved.status, 200); assert.equal(moved.body.data.mealDate, '2026-10-28');
  assert.equal((await f.admin.send(planPath)).body.data.days[2].meals.Dinner[0].mealPlanItemId, item.mealPlanItemId);
});

test('MP SQL: PATCH cross-week atomically reassigns plan and reload retrieves the destination week', async () => {
  const item = (await f.admin.send(planPath)).body.data.days[2].meals.Dinner[0];
  const moved = await edit(item.mealPlanItemId, { mealDate: '2026-11-03' });
  assert.equal(moved.status, 200); assert.notEqual(moved.body.data.mealPlanId, item.mealPlanId);
  const newWeek = await f.admin.send('/api/meal-plans?weekStart=2026-11-02');
  assert.equal(newWeek.body.data.days[1].meals.Dinner[0].mealPlanItemId, item.mealPlanItemId);
  assert.equal((await f.admin.send(planPath)).body.data.days[2].meals.Dinner.length, 0);
});

test('MP SQL: actual insert error rolls back a newly-created week and leaves no half item', async () => {
  const date = '2034-06-07'; const week = weekStartForDate(date);
  assert.equal(await countWeek(week), 0);
  f.failNextQuery(/INSERT INTO dbo\.MealPlanItems/u);
  const failed = await add(input({ mealDate: date })); assert.equal(failed.status, 500);
  assert.equal(await countWeek(week), 0);
  assert.equal((await f.admin.send(`/api/meal-plans?weekStart=${week}`)).body.data.summary.itemCount, 0);
});

test('MP SQL: actual update error rolls back destination week and retains source item/servings', async () => {
  const original = (await f.admin.send(planPath)).body.data.days[0].meals.Lunch.find((item) => item.recipeId === recipeA);
  const date = '2035-07-04'; const week = weekStartForDate(date);
  assert.equal(await countWeek(week), 0); f.failNextQuery(/UPDATE i SET MealPlanID/u);
  assert.equal((await edit(original.mealPlanItemId, { mealDate: date, servings: 17 })).status, 500);
  assert.equal(await countWeek(week), 0);
  const source = (await f.admin.send(planPath)).body.data.days[0].meals.Lunch.find((item) => item.mealPlanItemId === original.mealPlanItemId);
  assert.deepEqual(source, original);
});

test('MP SQL: concurrent HTTP additions create one owner/week and duplicate submissions produce201/409', async () => {
  // A single rollback connection queues whole transactions; this verifies the
  // concurrent HTTP contract, not a multi-connection SQL load benchmark.
  const date = '2038-05-12'; const week = weekStartForDate(date);
  const first = await Promise.all([add(input({ mealDate: date })), add(input({ mealDate: date, recipeId: recipeB }))]);
  assert.deepEqual(first.map((response) => response.status), [201, 201]); assert.equal(await countWeek(week), 1);
  assert.equal(first[0].body.data.mealPlanId, first[1].body.data.mealPlanId);
  const duplicateDate = '2038-05-13';
  const second = await Promise.all([add(input({ mealDate: duplicateDate })), add(input({ mealDate: duplicateDate }))]);
  assert.deepEqual(second.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await countWeek(week), 1);
});

test('MP SQL: shopping scales actual DECIMAL quantities/base servings, separates units, excludes optional and totals repeated days', async () => {
  await clearOwner();
  for (const body of [input(), input({ mealDate: '2026-10-27' }), input({ recipeId: recipeB })]) assert.equal((await add(body)).status, 201);
  const raw = await f.mealRepository.getShoppingRows(f.admin.user.userId, weekStart);
  assert.equal(raw.every((row) => typeof row.quantity === 'string'), true);
  assert.equal(raw.find((row) => row.recipeId === recipeA && row.ingredientId === ingredients[0]).quantity, '1.25');
  const result = await f.admin.send(shopPath); assert.equal(result.status, 200);
  const shopping = result.body.data.items;
  assert.equal(shopping.length, 4);
  const find = (id, unit) => shopping.find((row) => row.ingredientId === id && row.unit === unit);
  assert.equal(find(ingredients[0], 'g').totalQuantity, '1.666667'); // 1.25 * 2/3 * two days = 5/3.
  assert.equal(find(ingredients[0], 'kg').totalQuantity, '1.25');
  assert.equal(find(ingredients[1], 'ml').totalQuantity, '1.5'); // A's optional 3ml is excluded.
  assert.equal(find(ingredients[2], 'quả').totalQuantity, '3.166667'); // 2 * 2/3 * two days + 1 * 2/4.
  assert.equal(find(ingredients[2], 'quả').recipeCount, 2); assert.equal(find(ingredients[2], 'quả').plannedItemCount, 3);
  assert.equal(find(ingredients[0], 'g').recipeCount, 1); assert.equal(find(ingredients[0], 'g').plannedItemCount, 2);
  assert.equal((await f.admin.send(planPath)).body.data.summary.ingredientCount, 3);
  const ordinary = (await f.ordinary.send(shopPath)).body.data.items;
  assert.equal(ordinary.length, 2); assert.equal(ordinary.some((row) => row.unit === 'kg'), false);
});

test('MP SQL: shopping recomputes after servings edits, moves and deletion; recipes and old personal data survive', async () => {
  const item = (await f.admin.send(planPath)).body.data.days[0].meals.Lunch.find((row) => row.recipeId === recipeA);
  assert.equal((await edit(item.mealPlanItemId, { servings: 3 })).status, 200);
  let shop = (await f.admin.send(shopPath)).body.data.items;
  assert.equal(shop.find((row) => row.ingredientId === ingredients[0] && row.unit === 'g').totalQuantity, '2.083334');
  assert.equal((await edit(item.mealPlanItemId, { mealDate: '2026-11-02' })).status, 200);
  shop = (await f.admin.send(shopPath)).body.data.items;
  assert.equal(shop.find((row) => row.ingredientId === ingredients[0] && row.unit === 'g').totalQuantity, '0.833334');
  assert.equal((await remove(item.mealPlanItemId)).status, 200); assert.equal((await remove(item.mealPlanItemId)).status, 404);
  assert.deepEqual((await f.admin.send('/api/meal-plans/shopping-list?weekStart=2026-11-02')).body.data.items, []);
  const current = (await rows(`SELECT (SELECT COUNT_BIG(*) FROM dbo.UserIngredients) AS pantry,
    (SELECT COUNT_BIG(*) FROM dbo.Favorites) AS favorites, (SELECT COUNT_BIG(*) FROM dbo.Reviews) AS reviews;`))[0];
  for (const field of ['pantry', 'favorites', 'reviews']) assert.equal(Number(current[field]), Number(baseline[field]));
  assert.equal((await f.guest.send(`/api/recipes/${recipeA}`)).status, 200);
});

test('MP SQL: Admin cannot delete a scheduled recipe; deleting only items later permits safe recipe deletion', async () => {
  const denied = await f.admin.mutate(`/api/admin/recipes/${recipeB}`, {}, { method: 'DELETE' });
  assert.equal(denied.status, 409); assert.match(denied.body.message, /lịch nấu ăn/iu);
  assert.equal((await f.guest.send(`/api/recipes/${recipeB}`)).status, 200);
  assert.equal((await f.admin.send(planPath)).body.data.days[0].meals.Lunch.some((row) => row.recipeId === recipeB), true);
  await clearOwner();
  assert.equal((await f.admin.mutate(`/api/admin/recipes/${recipeB}`, {}, { method: 'DELETE' })).status, 200);
  assert.equal((await f.guest.send(`/api/recipes/${recipeB}`)).status, 404);
});

test('MP SQL: unsafe mutations enforce CSRF, Origin and JSON without writing', async () => {
  for (const headers of [{ 'X-CSRF-Token': '' }, { Origin: 'https://evil.example' }, { Origin: 'null' }, { Origin: '' }]) {
    assert.equal((await f.admin.mutate('/api/meal-plans/items', input(), { headers })).status, 403);
  }
  assert.equal((await f.admin.mutate('/api/meal-plans/items', input(), { headers: { 'Content-Type': 'text/plain' } })).status, 400);
  assert.equal((await f.admin.send(planPath)).body.data.summary.itemCount, 0);
  const created = await add(input()); const id = created.body.data.mealPlanItemId;
  assert.equal((await f.admin.send(`/api/meal-plans/items/${id}`, { method: 'PATCH', body: { servings: 10 } })).status, 403);
  assert.equal((await f.admin.mutate(`/api/meal-plans/items/${id}`, {}, { method: 'DELETE', headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await f.admin.send(planPath)).body.data.days[0].meals.Lunch[0].servings, 2);
});

test('MP SQL: validates full date range, week starts, leap dates, servings and strict ownership fields', async () => {
  for (const date of ['2026-10-27', '2025-02-29', '2026-13-01', '2026-01-01T00:00:00Z', '9999-12-27']) {
    assert.equal((await f.admin.send(`/api/meal-plans?weekStart=${encodeURIComponent(date)}`)).status, 400);
  }
  for (const body of [input({ recipeId: 2_147_483_647 }), input({ servings: 0 }), input({ servings: 21 }), input({ servings: '2' }),
    input({ servings: 1.5 }), input({ mealDate: '2025-02-29' }), input({ mealType: 'lunch' }), input({ userId: f.ordinary.user.userId })]) {
    const response = await add(body); assert.equal(response.status, body.recipeId === 2_147_483_647 ? 404 : 400);
  }
  for (const date of ['2024-02-29', '2026-12-31', '2027-01-01', '0001-01-01', '9999-12-26']) {
    const result = await add(input({ mealDate: date, servings: 1 })); assert.equal(result.status, 201, date);
    assert.equal(result.body.data.mealDate, date);
    const reload = await f.admin.send(`/api/meal-plans?weekStart=${weekStartForDate(date)}`);
    assert.equal(reload.body.data.days.flatMap((day) => day.meals.Lunch).some((row) => row.mealDate === date), true);
  }
  assert.equal((await f.admin.send(`${planPath}&weekStart=${weekStart}`)).status, 400);
  assert.equal((await f.admin.send('/api/meal-plans?weekStart=2026-10-26%27%3BDELETE%20FROM%20dbo.Users--')).status, 400);
  assert.equal((await f.admin.mutate('/api/meal-plans/items/1%20OR%201=1', { servings: 3 }, { method: 'PATCH' })).status, 400);
});

test('MP SQL: fixture recipe remains visible to public catalog and Suggestions without changing the matcher', async () => {
  const list = await f.guest.send(`/api/recipes?search=${encodeURIComponent(tag)}`);
  assert.equal(list.status, 200); assert.equal(list.body.data.some((row) => row.recipeId === recipeA), true);
  const result = await f.guest.send('/api/recipes/suggest', { method: 'POST', body: { ingredientIds: [ingredients[0], ingredients[2]], servings: 3 } });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.some((row) => row.recipeId === recipeA && row.matchPercentage === 100), true);
});

test('MP SQL: expired JWT and logout revocation deny subsequent planner reads and writes', async () => {
  const client = await f.createAccount(); const captured = new Map(client.cookies);
  const claims = jwt.decode(client.cookies.get(f.config.cookieName)); const now = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ ...claims, iat: now - 901, exp: now - 1 }, f.config.jwtSecret);
  const bad = new Map(client.cookies); bad.set(f.config.cookieName, expired);
  assert.equal((await client.send(planPath, { cookies: bad })).status, 401);
  assert.equal((await client.logout()).status, 200);
  assert.equal((await client.send(planPath, { cookies: captured })).status, 401);
  assert.equal((await client.mutate('/api/meal-plans/items', input(), { cookies: captured })).status, 401);
});

test('MP SQL: cleanup affects fixture plans only and preserves existing Pantry/Favorites/Reviews/recipe counts', async () => {
  await clearOwner(); await clearOwner(f.ordinary);
  assert.equal((await f.admin.mutate(`/api/admin/recipes/${recipeA}`, {}, { method: 'DELETE' })).status, 200);
  const current = (await rows(`SELECT (SELECT COUNT_BIG(*) FROM dbo.Recipes) AS recipes,
    (SELECT COUNT_BIG(*) FROM dbo.UserIngredients) AS pantry, (SELECT COUNT_BIG(*) FROM dbo.Favorites) AS favorites,
    (SELECT COUNT_BIG(*) FROM dbo.Reviews) AS reviews;`))[0];
  for (const field of ['recipes', 'pantry', 'favorites', 'reviews']) assert.equal(Number(current[field]), Number(baseline[field]));
  assert.equal((await f.request().input('a', f.admin.user.userId).input('b', f.ordinary.user.userId)
    .query("SELECT UserID FROM dbo.Users WHERE UserID IN (@a,@b) AND Role <> N'User';")).recordset.length, 0);
});
