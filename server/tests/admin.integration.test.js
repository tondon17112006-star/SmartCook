import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { before, after, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createAdminFixture } from './helpers/admin-fixture.js';
import { createAdminRepository } from '../src/services/admin.repository.js';
import { getPool } from '../src/config/database.js';

let f, initial, initialCounts, categoryId, ingredientId, extraIngredientId, recipeId, reviewId, pantryId;
const tag = `Quản trị thử ${randomBytes(8).toString('hex')}`;
const recipe = () => ({
  recipeName: `${tag} món`, categoryId, description: 'Công thức trong transaction kiểm thử.',
  imageUrl: '/images/fixture.jpg', prepTime: 5, cookTime: 10, servings: 2, difficulty: 'Dễ',
  ingredients: [{ ingredientId, quantity: 1.25, unit: 'gam', isRequired: true, notes: null }],
  steps: [{ stepNumber: 1, instruction: 'Chuẩn bị nguyên liệu.', imageUrl: null },
    { stepNumber: 2, instruction: 'Nấu chín và thưởng thức.', imageUrl: null }],
});
const write = (path, body = {}, method = 'POST') => f.admin.mutate(`/api/admin${path}`, body, { method });
const rows = async (statement) => (await f.request().query(statement)).recordset;

before(async () => {
  initial = await createAdminRepository().dashboard();
  initialCounts = (await (await getPool()).request().query('SELECT (SELECT COUNT_BIG(*) FROM dbo.Users) AS users, (SELECT COUNT_BIG(*) FROM dbo.Reviews) AS reviews;')).recordset[0];
  f = await createAdminFixture();
});
after(async () => { await f?.close(); });

test('10A SQL: every admin route rejects Guest401/User403, and registration cannot request Admin', async () => {
  for (const path of ['/dashboard', '/recipes', '/recipes/1', '/categories', '/ingredients', '/users', '/users/1', '/reviews']) {
    assert.equal((await f.guest.send(`/api/admin${path}`)).status, 401, path);
    assert.equal((await f.ordinary.send(`/api/admin${path}`)).status, 403, path);
  }
  for (const [path, method] of [['/recipes', 'POST'], ['/recipes/1', 'PATCH'], ['/recipes/1', 'DELETE'],
    ['/categories', 'POST'], ['/categories/1', 'PATCH'], ['/categories/1', 'DELETE'],
    ['/ingredients', 'POST'], ['/ingredients/1', 'PATCH'], ['/ingredients/1', 'DELETE'], ['/reviews/1', 'DELETE']]) {
    assert.equal((await f.ordinary.mutate(`/api/admin${path}`, {}, { method })).status, 403, `${method} ${path}`);
  }
  assert.equal((await f.guest.register({ fullName: 'Không được cấp quyền', email: `forbidden-${randomBytes(8).toString('hex')}@example.test`, password: randomBytes(32).toString('base64'), role: 'Admin' })).status, 400);
  const stored = (await f.request().input('id', f.admin.user.userId).query('SELECT Role AS role FROM dbo.Users WHERE UserID = @id;')).recordset;
  assert.equal(stored.every((user) => user.role === 'User'), true);
});

test('10A SQL: role is reloaded, expired JWT and session revoked after logout cannot enter Admin', async () => {
  assert.equal((await f.admin.send('/api/admin/check')).status, 200);
  f.adminIds.delete(f.admin.user.userId);
  assert.equal((await f.admin.send('/api/admin/check')).status, 403);
  f.adminIds.add(f.admin.user.userId);
  const original = f.admin.cookies.get(f.config.cookieName), claims = jwt.decode(original);
  const time = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ ...claims, iat: time - 901, exp: time - 1 }, f.config.jwtSecret);
  const cookies = new Map(f.admin.cookies); cookies.set(f.config.cookieName, expired);
  assert.equal((await f.admin.send('/api/admin/dashboard', { cookies })).status, 401);
  const temporary = await f.createAccount();
  f.adminIds.add(temporary.user.userId);
  const oldCookies = new Map(temporary.cookies);
  assert.equal((await temporary.send('/api/admin/check')).status, 200);
  assert.equal((await temporary.logout()).status, 200);
  assert.equal((await temporary.send('/api/admin/check', { cookies: oldCookies })).status, 401);
});

test('10B SQL: dashboard zero values are real; fixture counts and top lists agree with SQL', async () => {
  assert.equal(initial.totals.userCount, Number(initialCounts.users));
  assert.equal(initial.totals.reviewCount, Number(initialCounts.reviews));
  const result = await f.admin.send('/api/admin/dashboard');
  assert.equal(result.status, 200);
  assert.match(result.headers.get('cache-control'), /no-store/u);
  assert.equal(result.body.data.totals.recipeCount, initial.totals.recipeCount);
  assert.equal(result.body.data.totals.userCount, Number((await rows('SELECT COUNT_BIG(*) AS n FROM dbo.Users;'))[0].n));
  assert.equal(result.body.data.totals.reviewCount, initial.totals.reviewCount);
  if (initial.totals.reviewCount === 0) assert.deepEqual(result.body.data.mostReviewed, []);
  const newest = await rows('SELECT TOP(5) RecipeID AS id FROM dbo.Recipes ORDER BY CreatedAt DESC, RecipeID DESC;');
  assert.deepEqual(result.body.data.newestRecipes.map((row) => row.recipeId), newest.map((row) => Number(row.id)));
});

test('10A SQL: unsafe Admin requests enforce JSON, CSRF and exact Origin before writing', async () => {
  const body = { categoryName: `${tag} refused` };
  assert.equal((await f.admin.send('/api/admin/categories', { method: 'POST', body })).status, 403);
  assert.equal((await f.admin.mutate('/api/admin/categories', body, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await f.admin.mutate('/api/admin/categories', body, { headers: { Origin: '' } })).status, 403);
  assert.equal((await f.admin.mutate('/api/admin/categories', body, { headers: { 'Content-Type': 'text/plain' } })).status, 400);
});

test('10D SQL: category create/edit/unique/search/pagination; no silent role overposting', async () => {
  assert.equal((await write('/categories', { categoryName: `${tag} danh mục`, role: 'Admin' })).status, 400);
  const created = await write('/categories', { categoryName: `${tag} danh mục`, description: 'Mô tả', imageUrl: null });
  assert.equal(created.status, 201); categoryId = created.body.data.categoryId;
  assert.equal((await write('/categories', { categoryName: `${tag} danh mục` })).status, 409);
  const edited = await write(`/categories/${categoryId}`, { description: 'Mô tả đã sửa' }, 'PATCH');
  assert.equal(edited.status, 200); assert.equal(edited.body.data.description, 'Mô tả đã sửa');
  const found = await f.admin.send(`/api/admin/categories?search=${encodeURIComponent(tag)}&limit=1`);
  assert.equal(found.body.pagination.total, 1); assert.equal(found.body.data[0].recipeCount, 0);
});

test('10E SQL: ingredients create/edit/unique/group filter and pantry reference guard', async () => {
  const first = await write('/ingredients', { ingredientName: `${tag} nguyên liệu`, ingredientCategory: tag, defaultUnit: 'gam' });
  assert.equal(first.status, 201); ingredientId = first.body.data.ingredientId;
  const second = await write('/ingredients', { ingredientName: `${tag} phụ`, ingredientCategory: tag, defaultUnit: 'ml', imageUrl: null });
  assert.equal(second.status, 201); extraIngredientId = second.body.data.ingredientId;
  assert.equal((await write('/ingredients', { ingredientName: `${tag} nguyên liệu`, ingredientCategory: tag, defaultUnit: 'gam' })).status, 409);
  assert.equal((await write(`/ingredients/${ingredientId}`, { defaultUnit: 'g' }, 'PATCH')).status, 200);
  const list = await f.admin.send(`/api/admin/ingredients?ingredientCategory=${encodeURIComponent(tag)}&limit=1`);
  assert.equal(list.body.pagination.total, 2);
  const pantry = await f.ordinary.mutate('/api/pantry', { ingredientId: extraIngredientId, quantity: 2, unit: 'ml', expiryDate: null });
  assert.equal(pantry.status, 201); pantryId = pantry.body.data.userIngredientId;
  assert.equal((await write(`/ingredients/${extraIngredientId}`, {}, 'DELETE')).status, 409);
});

test('10C SQL: create recipe atomically with real quantities/ingredients/steps and actor from session', async () => {
  const created = await write('/recipes', recipe());
  assert.equal(created.status, 201); recipeId = created.body.data.recipeId;
  const detail = await f.admin.send(`/api/admin/recipes/${recipeId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.ingredients[0].quantity, 1.25);
  assert.equal(detail.body.data.ingredients[0].isRequired, true);
  assert.deepEqual(detail.body.data.steps.map((row) => row.stepNumber), [1, 2]);
  const actor = await f.request().input('id', recipeId).query('SELECT CreatedBy AS id FROM dbo.Recipes WHERE RecipeID = @id;');
  assert.equal(Number(actor.recordset[0].id), f.admin.user.userId);
  const category = await f.admin.send(`/api/admin/categories?search=${encodeURIComponent(tag)}`);
  assert.equal(category.body.data[0].recipeCount, 1);
});

test('10C SQL: new recipe is visible to the existing public services and unchanged suggestion matcher', async () => {
  const list = await f.guest.send(`/api/recipes?search=${encodeURIComponent(tag)}`);
  assert.equal(list.status, 200); assert.equal(list.body.data[0].recipeId, recipeId);
  const detail = await f.guest.send(`/api/recipes/${recipeId}`);
  assert.equal(detail.status, 200); assert.equal(detail.body.data.steps.length, 2);
  const suggestion = await f.guest.send('/api/recipes/suggest', { method: 'POST', body: { ingredientIds: [ingredientId], servings: 4 } });
  assert.equal(suggestion.status, 200);
  const found = suggestion.body.data.find((row) => row.recipeId === recipeId);
  assert.ok(found); assert.equal(found.matchPercentage, 100);
  assert.equal(found.matchedIngredients[0].adjustedQuantity, 2.5);
});

test('10C SQL: invalid recipe payloads return400 without creating partial records', async (t) => {
  const cases = [
    ['negative time', { prepTime: -1 }], ['zero servings', { servings: 0 }], ['zero total time', { prepTime: 0, cookTime: 0 }],
    ['duplicate ingredient', { ingredients: [...recipe().ingredients, ...recipe().ingredients] }],
    ['no required ingredient', { ingredients: [{ ...recipe().ingredients[0], isRequired: false }] }],
    ['no steps', { steps: [] }], ['step gap', { steps: [{ stepNumber: 2, instruction: 'Không hợp lệ' }] }],
    ['invalid quantity', { ingredients: [{ ...recipe().ingredients[0], quantity: 0.001 }] }],
    ['executable URL', { imageUrl: 'javascript:alert(1)' }], ['role spoof', { role: 'Admin' }], ['actor spoof', { createdBy: f.ordinary.user.userId }],
  ];
  for (const [name, changes] of cases) await t.test(name, async () => {
    assert.equal((await write('/recipes', { ...recipe(), ...changes })).status, 400);
  });
  assert.equal((await write('/recipes', { ...recipe(), categoryId: 2147483647 })).status, 400);
  assert.equal((await write('/recipes', { ...recipe(), ingredients: [{ ...recipe().ingredients[0], ingredientId: 2147483647 }] })).status, 400);
  assert.equal(Number((await rows('SELECT COUNT_BIG(*) AS n FROM dbo.Recipes;'))[0].n), initial.totals.recipeCount + 1);
});

test('10C SQL: actual child SQL error rolls back create and update, preserving full previous recipe', async () => {
  f.failNextQuery(/INSERT INTO dbo\.CookingSteps/u);
  assert.equal((await write('/recipes', { ...recipe(), recipeName: `${tag} rollback` })).status, 500);
  const missing = await f.admin.send(`/api/admin/recipes?search=${encodeURIComponent(`${tag} rollback`)}`);
  assert.equal(missing.body.pagination.total, 0);
  const previous = (await f.admin.send(`/api/admin/recipes/${recipeId}`)).body.data;
  f.failNextQuery(/INSERT INTO dbo\.CookingSteps/u);
  assert.equal((await write(`/recipes/${recipeId}`, { recipeName: `${tag} failed edit`, steps: [{ stepNumber: 1, instruction: 'Không được lưu' }] }, 'PATCH')).status, 500);
  const after = (await f.admin.send(`/api/admin/recipes/${recipeId}`)).body.data;
  assert.equal(after.recipeName, previous.recipeName);
  assert.deepEqual(after.ingredients, previous.ingredients); assert.deepEqual(after.steps, previous.steps);
});

test('10C SQL: PATCH keeps unspecified fields and saves replacement ingredients/ordered steps', async () => {
  const change = { recipeName: `${tag} món đã sửa`, ingredients: [{ ingredientId, quantity: 3, unit: 'gam', isRequired: true }, { ingredientId: extraIngredientId, quantity: 0.5, unit: 'ml', isRequired: false }],
    steps: [{ stepNumber: 1, instruction: 'Bước mới trước.' }, { stepNumber: 2, instruction: 'Bước mới sau.' }] };
  const saved = await write(`/recipes/${recipeId}`, change, 'PATCH');
  assert.equal(saved.status, 200); assert.equal(saved.body.data.prepTime, 5);
  assert.equal(saved.body.data.ingredients.length, 2); assert.equal(saved.body.data.steps[0].instruction, 'Bước mới trước.');
  assert.equal((await write(`/recipes/${recipeId}`, { prepTime: 0, cookTime: 0 }, 'PATCH')).status, 400);
});

test('10C/10D/10E SQL: linked category/ingredient deletes blocked; recipe Favorites/Reviews guard is safe', async () => {
  assert.equal((await write(`/categories/${categoryId}`, {}, 'DELETE')).status, 409);
  assert.equal((await write(`/ingredients/${ingredientId}`, {}, 'DELETE')).status, 409);
  assert.equal((await f.ordinary.mutate('/api/favorites', { recipeId })).status, 201);
  assert.equal((await write(`/recipes/${recipeId}`, {}, 'DELETE')).status, 409);
  assert.equal((await f.ordinary.mutate(`/api/favorites/${recipeId}`, {}, { method: 'DELETE' })).status, 200);
  const review = await f.ordinary.mutate(`/api/recipes/${recipeId}/reviews`, { rating: 4, comment: 'Bình luận trong transaction' });
  assert.equal(review.status, 201); reviewId = review.body.data.reviewId;
  assert.equal((await write(`/recipes/${recipeId}`, {}, 'DELETE')).status, 409);
  const dashboard = (await f.admin.send('/api/admin/dashboard')).body.data;
  assert.equal(dashboard.totals.reviewCount, initial.totals.reviewCount + 1);
  const ranked = await rows('SELECT TOP(5) RecipeID AS id FROM dbo.Reviews GROUP BY RecipeID ORDER BY COUNT_BIG(*) DESC, RecipeID ASC;');
  assert.deepEqual(dashboard.mostReviewed.map((row) => row.recipeId), ranked.map((row) => Number(row.id)));
});

test('10F SQL: read-only users list/detail has no hash; filters/search/injection are parameterized', async () => {
  const result = await f.admin.send('/api/admin/users?limit=1');
  assert.equal(result.status, 200); assert.ok(result.body.pagination.total >= 2);
  const detail = await f.admin.send(`/api/admin/users/${f.ordinary.user.userId}`);
  assert.equal(detail.status, 200); assert.equal(detail.body.data.email, f.ordinary.user.email);
  assert.equal(detail.body.data.role, 'User');
  assert.doesNotMatch(JSON.stringify([result.body, detail.body]), /password|hash|secret|token/iu);
  assert.equal((await f.admin.send(`/api/admin/users?search=${encodeURIComponent("'; DROP TABLE dbo.Users;--")}`)).body.pagination.total, 0);
  assert.equal((await f.admin.send('/api/admin/recipes?sort=RecipeID%20DESC%3BDROP%20TABLE%20dbo.Recipes')).status, 400);
  assert.equal((await f.admin.send('/api/admin/recipes/1%20OR%201=1')).status, 400);
  assert.equal((await f.admin.send('/api/admin/ingredients?ingredientCategory[]=x')).status, 400);
});

test('10F SQL: Admin review filtering and deletion preserve recipes; User cannot delete others', async () => {
  const list = await f.admin.send(`/api/admin/reviews?recipeId=${recipeId}&rating=4&limit=1`);
  assert.equal(list.status, 200); assert.equal(list.body.pagination.total, 1);
  assert.equal(list.body.data[0].reviewId, reviewId);
  assert.equal((await f.ordinary.mutate(`/api/admin/reviews/${reviewId}`, {}, { method: 'DELETE' })).status, 403);
  assert.equal((await write(`/reviews/${reviewId}`, {}, 'DELETE')).status, 200);
  assert.equal((await write(`/reviews/${reviewId}`, {}, 'DELETE')).status, 404);
  const publicReviews = await f.guest.send(`/api/recipes/${recipeId}/reviews`);
  assert.equal(publicReviews.body.summary.reviewCount, 0);
  assert.equal((await f.guest.send(`/api/recipes/${recipeId}`)).status, 200);
});

test('10C SQL: scalar-only recipe PATCH preserves child records and StepIDs; changing default unit keeps formula units', async () => {
  const before = (await f.admin.send(`/api/admin/recipes/${recipeId}`)).body.data;
  const saved = await write(`/recipes/${recipeId}`, { servings: before.servings + 1 }, 'PATCH');
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.data.ingredients, before.ingredients);
  assert.deepEqual(saved.body.data.steps, before.steps);
  assert.equal((await write(`/ingredients/${ingredientId}`, { defaultUnit: 'lít' }, 'PATCH')).status, 200);
  const after = (await f.admin.send(`/api/admin/recipes/${recipeId}`)).body.data;
  assert.deepEqual(after.ingredients, before.ingredients);
  assert.deepEqual(after.steps.map((step) => step.stepId), before.steps.map((step) => step.stepId));
});

test('10D–10F SQL: duplicate names on PATCH are blocked; ingredient groups and User roles filter exactly', async () => {
  let otherCategoryId, otherIngredientId;
  try {
    const category = await write('/categories', { categoryName: `${tag} khác` });
    assert.equal(category.status, 201); otherCategoryId = category.body.data.categoryId;
    assert.equal((await write(`/categories/${otherCategoryId}`, { categoryName: `${tag} danh mục` }, 'PATCH')).status, 409);
    const ingredient = await write('/ingredients', { ingredientName: `${tag} nguyên liệu khác`, ingredientCategory: `${tag} nhóm khác`, defaultUnit: 'gam' });
    assert.equal(ingredient.status, 201); otherIngredientId = ingredient.body.data.ingredientId;
    assert.equal((await write(`/ingredients/${otherIngredientId}`, { ingredientName: `${tag} nguyên liệu` }, 'PATCH')).status, 409);
    const ingredients = await f.admin.send(`/api/admin/ingredients?ingredientCategory=${encodeURIComponent(tag)}&limit=1&page=2`);
    assert.equal(ingredients.status, 200); assert.equal(ingredients.body.pagination.total, 2);
    assert.equal(ingredients.body.data.length, 1); assert.equal(ingredients.body.data[0].ingredientCategory, tag);
    const exactUser = `search=${encodeURIComponent(f.ordinary.user.email)}`;
    const users = await f.admin.send(`/api/admin/users?${exactUser}&role=User`);
    assert.equal(users.body.pagination.total, 1); assert.equal(users.body.data[0].userId, f.ordinary.user.userId);
    assert.equal((await f.admin.send(`/api/admin/users?${exactUser}&role=Admin`)).body.pagination.total, 0);
  } finally {
    if (otherIngredientId) assert.equal((await write(`/ingredients/${otherIngredientId}`, {}, 'DELETE')).status, 200);
    if (otherCategoryId) assert.equal((await write(`/categories/${otherCategoryId}`, {}, 'DELETE')).status, 200);
  }
});

test('10B/10C/10F SQL: actual sort/pagination, literal wildcard search, review filters and favorite ranking', async () => {
  const extraRecipes = [], favorites = [], reviews = [];
  try {
    for (const [suffix, time] of [['A', 2], ['B', 4]]) {
      const response = await write('/recipes', { ...recipe(), recipeName: `${tag} %_[~ ${suffix}`, prepTime: 0, cookTime: time });
      assert.equal(response.status, 201); extraRecipes.push(response.body.data.recipeId);
    }
    const orderings = {
      newest: 'CreatedAt DESC, RecipeID DESC', name_asc: 'RecipeName ASC, RecipeID ASC', name_desc: 'RecipeName DESC, RecipeID DESC',
      time_asc: '(CONVERT(BIGINT, PrepTime) + CONVERT(BIGINT, CookTime)) ASC, RecipeID ASC',
      time_desc: '(CONVERT(BIGINT, PrepTime) + CONVERT(BIGINT, CookTime)) DESC, RecipeID ASC',
    };
    for (const [sort, order] of Object.entries(orderings)) {
      const expected = await f.request().input('categoryId', categoryId).query(`SELECT RecipeID AS id FROM dbo.Recipes WHERE CategoryID = @categoryId ORDER BY ${order};`);
      const first = await f.admin.send(`/api/admin/recipes?categoryId=${categoryId}&sort=${sort}&limit=2`);
      const second = await f.admin.send(`/api/admin/recipes?categoryId=${categoryId}&sort=${sort}&limit=2&page=2`);
      assert.equal(first.status, 200); assert.equal(second.status, 200);
      assert.equal(first.body.pagination.total, 3); assert.equal(first.body.pagination.totalPages, 2);
      assert.equal(first.body.pagination.hasNextPage, true); assert.equal(second.body.pagination.hasNextPage, false);
      const ids = [...first.body.data, ...second.body.data].map((row) => row.recipeId);
      assert.deepEqual(ids, expected.recordset.map((row) => Number(row.id)), sort);
      assert.equal(new Set(ids).size, 3);
    }
    const absentPage = await f.admin.send(`/api/admin/recipes?categoryId=${categoryId}&limit=2&page=99`);
    assert.equal(absentPage.status, 200); assert.equal(absentPage.body.pagination.total, 3); assert.deepEqual(absentPage.body.data, []);
    for (const term of [`${tag} %`, `${tag} %_[~`]) {
      const result = await f.admin.send(`/api/admin/recipes?search=${encodeURIComponent(term)}`);
      assert.equal(result.status, 200); assert.equal(result.body.pagination.total, 2, term);
      assert.deepEqual(new Set(result.body.data.map((row) => row.recipeId)), new Set(extraRecipes));
    }
    for (const [client, id] of [[f.admin, extraRecipes[0]], [f.ordinary, extraRecipes[0]], [f.ordinary, extraRecipes[1]], [f.admin, recipeId]]) {
      assert.equal((await client.mutate('/api/favorites', { recipeId: id })).status, 201); favorites.push([client, id]);
    }
    const dashboard = (await f.admin.send('/api/admin/dashboard')).body.data;
    assert.equal(dashboard.totals.favoriteCount, initial.totals.favoriteCount + favorites.length);
    const expectedFavorites = await rows(`SELECT TOP(5) r.RecipeID AS recipeId, COUNT_BIG(*) AS count FROM dbo.Recipes AS r
      INNER JOIN dbo.Favorites AS v ON v.RecipeID = r.RecipeID GROUP BY r.RecipeID ORDER BY COUNT_BIG(*) DESC, r.RecipeID ASC;`);
    assert.deepEqual(dashboard.mostFavorited.map(({ recipeId: id, count }) => [id, count]), expectedFavorites.map((row) => [Number(row.recipeId), Number(row.count)]));
    for (const [client, id, rating] of [[f.ordinary, extraRecipes[0], 5], [f.admin, extraRecipes[1], 2]]) {
      const saved = await client.mutate(`/api/recipes/${id}/reviews`, { rating, comment: `${tag} bình luận xếp hạng` });
      assert.equal(saved.status, 201); reviews.push(saved.body.data.reviewId);
    }
    const reviewSearch = await f.admin.send(`/api/admin/reviews?search=${encodeURIComponent(tag)}&rating=5`);
    assert.equal(reviewSearch.body.pagination.total, 1); assert.equal(reviewSearch.body.data[0].recipeId, extraRecipes[0]);
    const byRecipe = await f.admin.send(`/api/admin/reviews?recipeId=${extraRecipes[1]}`);
    assert.equal(byRecipe.body.pagination.total, 1); assert.equal(byRecipe.body.data[0].rating, 2);
  } finally {
    for (const id of reviews) assert.equal((await write(`/reviews/${id}`, {}, 'DELETE')).status, 200);
    for (const [client, id] of favorites) assert.equal((await client.mutate(`/api/favorites/${id}`, {}, { method: 'DELETE' })).status, 200);
    for (const id of extraRecipes) assert.equal((await write(`/recipes/${id}`, {}, 'DELETE')).status, 200);
  }
});

test('10C–10F SQL: unlinked fixture resources delete cleanly; original recipes and SQL roles remain unchanged', async () => {
  assert.equal((await write(`/recipes/${recipeId}`, {}, 'DELETE')).status, 200);
  assert.equal((await f.guest.send(`/api/recipes/${recipeId}`)).status, 404);
  assert.equal((await f.ordinary.mutate(`/api/pantry/${pantryId}`, {}, { method: 'DELETE' })).status, 200);
  assert.equal((await write(`/ingredients/${ingredientId}`, {}, 'DELETE')).status, 200);
  assert.equal((await write(`/ingredients/${extraIngredientId}`, {}, 'DELETE')).status, 200);
  assert.equal((await write(`/categories/${categoryId}`, {}, 'DELETE')).status, 200);
  assert.equal(Number((await rows('SELECT COUNT_BIG(*) AS n FROM dbo.Recipes;'))[0].n), initial.totals.recipeCount);
  assert.equal((await f.request().input('id', f.admin.user.userId).query("SELECT UserID FROM dbo.Users WHERE UserID = @id AND Role <> N'User';")).recordset.length, 0);
});
