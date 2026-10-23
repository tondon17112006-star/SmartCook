import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getAuthConfig } from '../src/config/auth.js';
import { createAuthSecurity } from '../src/utilities/auth-security.js';
import { createAdminRouter } from '../src/routes/admin.routes.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createAdminRepository } from '../src/services/admin.repository.js';
import { createAdminService } from '../src/services/admin.service.js';
import { parseAdminQuery, validateAdminRecipe, validateAdminCategory, validateAdminIngredient, validateAdminDelete, validateAdminImageUrl } from '../src/utilities/admin-validation.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

const origin = 'http://localhost:5173';
const config = getAuthConfig({ JWT_SECRET: randomBytes(48).toString('base64'), PASSWORD_PEPPER: randomBytes(48).toString('base64'), CLIENT_ORIGIN: origin });

async function fixture(repository = {}) {
  // This role projection exists only in this isolated HTTP fixture; no SQL role is written.
  let role = 'Admin';
  const security = createAuthSecurity({ config, repository: { async findById() { return { userId: 7, role, fullName: 'Fixture Admin' }; } } });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ security }));
  app.use('/api/admin', createAdminRouter({ security, repository }));
  app.use(errorHandler);
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const record = security.sessionStore.create(7);
  const token = jwt.sign({}, config.jwtSecret, { algorithm: 'HS256', issuer: config.issuer, audience: config.audience, subject: '7', jwtid: record.jti, expiresIn: config.sessionTtlSeconds });
  const cookies = new Map([[config.cookieName, token]]);
  let csrfToken;
  return {
    security, record, token,
    setRole(value) { role = value; },
    async request(path, { method = 'GET', body, headers = {}, anonymous = false } = {}) {
      const response = await fetch(`${base}/api${path}`, {
        method, headers: { Cookie: anonymous ? '' : [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
          ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        cookies.set(pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1));
      }
      const raw = await response.text();
      let payload;
      try { payload = JSON.parse(raw); } catch { payload = raw; }
      return { status: response.status, body: payload, headers: response.headers };
    },
    async csrf() {
      const response = await this.request('/auth/csrf');
      csrfToken = response.body.csrfToken;
    },
    async close() { await new Promise((resolve) => listener.close(resolve)); },
  };
}

test('10A admin API denies Guest and SQL-projected User, permits Admin and reloads role each request', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  assert.equal((await f.request('/admin/check', { anonymous: true })).status, 401);
  f.setRole('User');
  assert.equal((await f.request('/admin/check')).status, 403);
  f.setRole('Admin');
  const allowed = await f.request('/admin/check');
  assert.equal(allowed.status, 200);
  assert.match(allowed.headers.get('cache-control'), /no-store/u);
  f.setRole('User');
  assert.equal((await f.request('/admin/check')).status, 403);
});

test('10A expired or revoked JWT cannot access admin routes', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const expired = jwt.sign({ iat: Math.floor(Date.now() / 1000) - 901 }, config.jwtSecret, { algorithm: 'HS256', issuer: config.issuer, audience: config.audience, subject: '7', jwtid: f.record.jti, expiresIn: 900 });
  assert.equal((await f.request('/admin/check', { headers: { Cookie: `${config.cookieName}=${expired}` } })).status, 401);
  f.security.sessionStore.revoke(f.record.jti);
  assert.equal((await f.request('/admin/check')).status, 401);
});

test('10B dashboard converts SQL BIGINT strings, handles zeros and preserves top lists', async () => {
  let statement;
  const repository = createAdminRepository({ request: async () => ({ async query(sql) {
    statement = sql;
    return { recordsets: [[{ recipeCount: '0', ingredientCount: '0', categoryCount: '0', userCount: '0', reviewCount: '0', favoriteCount: '0' }], [], [], []] };
  } }) });
  assert.deepEqual(await repository.dashboard(), { totals: { recipeCount: 0, ingredientCount: 0, categoryCount: 0, userCount: 0, reviewCount: 0, favoriteCount: 0 }, mostFavorited: [], mostReviewed: [], newestRecipes: [] });
  assert.match(statement, /dbo\.Favorites/u);
  assert.match(statement, /COUNT_BIG/u);
});

test('10B dashboard uses repository result after authentication without hardcoded statistics', async (t) => {
  const data = { totals: { recipeCount: 37, ingredientCount: 81, categoryCount: 12, userCount: 0, reviewCount: 0, favoriteCount: 0 }, mostFavorited: [], mostReviewed: [], newestRecipes: [] };
  let calls = 0;
  const f = await fixture({ async dashboard() { calls++; return data; } }); t.after(() => f.close());
  assert.deepEqual((await f.request('/admin/dashboard')).body, { data });
  f.setRole('User');
  assert.equal((await f.request('/admin/dashboard')).status, 403);
  assert.equal(calls, 1);
});

const recipe = () => ({ recipeName: 'Canh rau', categoryId: 2, prepTime: 0, cookTime: 15, servings: 2, difficulty: 'Dễ',
  ingredients: [{ ingredientId: 4, quantity: 0.25, unit: 'kg', isRequired: true }], steps: [{ stepNumber: 1, instruction: 'Nấu chín.' }] });
const badRequest = (error) => error.status === 400;

test('10C recipe validation preserves valid Unicode/quantities and allows partial PATCH without inventing defaults', () => {
  const parsed = validateAdminRecipe(recipe());
  assert.equal(parsed.recipeName, 'Canh rau'); assert.equal(parsed.description, null);
  assert.equal(parsed.ingredients[0].quantity, 0.25); assert.equal(parsed.ingredients[0].notes, null);
  assert.equal(parsed.steps[0].imageUrl, null);
  assert.deepEqual(validateAdminRecipe({ servings: 5 }, { partial: true }), { servings: 5 });
});

test('10C recipe input rejects missing fields, overposting, invalid SQL ids and inconsistent times', () => {
  for (const changes of [{ recipeName: '' }, { categoryId: '2' }, { categoryId: 0 }, { prepTime: -1 }, { cookTime: 1.5 },
    { prepTime: 0, cookTime: 0 }, { servings: 0 }, { servings: 2_147_483_648 }, { difficulty: 'EASY' },
    { role: 'Admin' }, { createdBy: 7 }, { recipeId: 88 }, { imageUrl: 'javascript:alert(1)' }]) {
    assert.throws(() => validateAdminRecipe({ ...recipe(), ...changes }), badRequest);
  }
  for (const input of [null, [], {}, { recipeName: 'Tên' }]) assert.throws(() => validateAdminRecipe(input), badRequest);
  assert.throws(() => validateAdminRecipe({}, { partial: true }), badRequest);
});

test('10C ingredients require unique IDs, exact decimal precision and one required ingredient', () => {
  for (const ingredients of [[], [...recipe().ingredients, ...recipe().ingredients],
    [{ ...recipe().ingredients[0], isRequired: false }], [{ ...recipe().ingredients[0], isRequired: 1 }],
    [{ ...recipe().ingredients[0], quantity: 0 }], [{ ...recipe().ingredients[0], quantity: 0.0000001 }],
    [{ ...recipe().ingredients[0], quantity: 0.001 }], [{ ...recipe().ingredients[0], quantity: '1' }],
    [{ ...recipe().ingredients[0], quantity: 10_000_000_000 }], [{ ...recipe().ingredients[0], unit: '' }],
    [{ ...recipe().ingredients[0], ingredientName: 'overposting' }]]) {
    assert.throws(() => validateAdminRecipe({ ...recipe(), ingredients }), badRequest);
  }
  assert.equal(validateAdminRecipe({ ...recipe(), ingredients: [{ ...recipe().ingredients[0], quantity: 9_999_999_999.99 }] }).ingredients[0].quantity, 9_999_999_999.99);
});

test('10C ordered steps require sequential numbers and text; no saved StepID can be forged', () => {
  for (const steps of [[], [{ stepNumber: 2, instruction: 'x' }], [{ stepNumber: 1, instruction: '' }],
    [{ stepNumber: 1, instruction: 'x' }, { stepNumber: 1, instruction: 'y' }],
    [{ stepNumber: 1, instruction: 'x', stepId: 4 }]]) assert.throws(() => validateAdminRecipe({ ...recipe(), steps }), badRequest);
  const text = 'Dòng 1\nDòng 2\tghi chú';
  assert.equal(validateAdminRecipe({ ...recipe(), steps: [{ stepNumber: 1, instruction: text }] }).steps[0].instruction, text);
});

test('10C image URLs reject executable schemes, network-relative paths, credentials, controls and backslashes', () => {
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AA', '//example.test/image', 'https://user:pass@example.test/a', 'https://example.test/a b', '/\\example.test/a', '/image\u0000.png']) {
    assert.throws(() => validateAdminImageUrl(url), badRequest);
  }
  for (const url of ['https://example.test/a.png', 'http://example.test/a.png', '/images/a.png']) assert.equal(validateAdminImageUrl(url), url);
  assert.equal(validateAdminImageUrl('  '), null);
});

test('10D/10E category and ingredient validators normalize values and reject empty or unexpected fields', () => {
  assert.deepEqual(validateAdminCategory({ categoryName: '  Món canh ', description: '' }), { categoryName: 'Món canh', description: null, imageUrl: null });
  assert.deepEqual(validateAdminIngredient({ ingredientName: ' Rau ', ingredientCategory: 'Rau củ', defaultUnit: 'gam' }), { ingredientName: 'Rau', ingredientCategory: 'Rau củ', defaultUnit: 'gam', imageUrl: null });
  for (const input of [{ categoryName: '' }, { categoryName: 'x', role: 'Admin' }, { categoryName: 'x', description: 'x'.repeat(501) }]) assert.throws(() => validateAdminCategory(input), badRequest);
  for (const input of [{ ingredientName: 'x' }, { ingredientName: 'x', ingredientCategory: '', defaultUnit: 'g' }, { ingredientName: 'x', ingredientCategory: 'Rau', defaultUnit: '' }]) assert.throws(() => validateAdminIngredient(input), badRequest);
  assert.throws(() => validateAdminDelete({ role: 'Admin' }), badRequest);
  assert.throws(() => validateAdminDelete(undefined), badRequest);
  assert.doesNotThrow(() => validateAdminDelete({}));
});

test('10C–10F list filters reject repeated parameters, unknown sort/filters and invalid pagination', () => {
  assert.deepEqual(parseAdminQuery({ page: '2', limit: '5', sort: 'name_asc', categoryId: '3' }, 'recipes'), { page: 2, limit: 5, offset: 5, sort: 'name_asc', categoryId: 3, search: '' });
  for (const [resource, input] of [['recipes', { sort: 'r.RecipeID; DROP TABLE dbo.Users' }], ['recipes', { search: ['x', 'y'] }],
    ['recipes', { page: '0' }], ['recipes', { limit: '101' }], ['categories', { sort: 'newest' }],
    ['users', { role: 'Owner' }], ['reviews', { rating: '6' }], ['ingredients', { ingredientCategory: ['x'] }], ['users', { userId: '7' }]]) {
    assert.throws(() => parseAdminQuery(input, resource), badRequest);
  }
});

test('10C unsafe admin HTTP mutations require valid JSON, CSRF and explicit Origin before calling repository', async (t) => {
  let writes = 0;
  const f = await fixture({ async createRecipe(_actor, data) { writes++; return { recipeId: 30, ...data }; } }); t.after(() => f.close());
  assert.equal((await f.request('/admin/recipes', { method: 'POST', body: recipe() })).status, 403);
  await f.csrf();
  assert.equal((await f.request('/admin/recipes', { method: 'POST', body: recipe(), headers: { Origin: 'http://evil.example' } })).status, 403);
  assert.equal((await f.request('/admin/recipes', { method: 'POST', body: recipe(), headers: { Origin: '' } })).status, 403);
  assert.equal((await f.request('/admin/recipes', { method: 'POST', body: recipe(), headers: { 'Content-Type': 'text/plain' } })).status, 400);
  assert.equal(writes, 0);
  assert.equal((await f.request('/admin/recipes', { method: 'POST', body: recipe() })).status, 201);
  assert.equal(writes, 1);
});

test('10C admin recipe create uses only actor from session and refuses privilege/actor overposting', async (t) => {
  let actor, saved;
  const f = await fixture({ async createRecipe(id, data) { actor = id; saved = data; return { recipeId: 30, ...data }; } }); t.after(() => f.close());
  await f.csrf();
  for (const extra of [{ role: 'Admin' }, { userId: 88 }, { createdBy: 88 }]) assert.equal((await f.request('/admin/recipes', { method: 'POST', body: { ...recipe(), ...extra } })).status, 400);
  const response = await f.request('/admin/recipes', { method: 'POST', body: recipe() });
  assert.equal(response.status, 201); assert.equal(actor, 7); assert.equal(saved.recipeName, 'Canh rau');
});

test('10D/10E admin duplicate and SQL FK race errors are safe409 without SQL details', async (t) => {
  const f = await fixture({ async createCategory() { throw Object.assign(new Error('SQL key (secret-value) dbo.Categories'), { number: 2627 }); },
    async deleteIngredient() { throw Object.assign(new Error('SQL FOREIGN KEY FK_UserIngredients'), { originalError: { info: { number: 547 } } }); } }); t.after(() => f.close());
  await f.csrf();
  const duplicate = await f.request('/admin/categories', { method: 'POST', body: { categoryName: 'Món canh' } });
  assert.equal(duplicate.status, 409); assert.doesNotMatch(duplicate.body.message, /SQL|secret-value|dbo\./u);
  const blocked = await f.request('/admin/ingredients/4', { method: 'DELETE', body: {} });
  assert.equal(blocked.status, 409); assert.doesNotMatch(blocked.body.message, /SQL|FK_/u);
});

test('10F User cannot call any Admin CRUD even with valid CSRF and forged role', async (t) => {
  const f = await fixture(); t.after(() => f.close()); await f.csrf(); f.setRole('User');
  for (const [path, method] of [['/recipes', 'POST'], ['/recipes/2', 'PATCH'], ['/recipes/2', 'DELETE'], ['/categories', 'POST'],
    ['/ingredients/4', 'DELETE'], ['/reviews/4', 'DELETE']]) assert.equal((await f.request(`/admin${path}`, { method, body: { role: 'Admin' } })).status, 403);
  assert.equal((await f.request('/admin/users')).status, 403);
});

test('10C admin find/update/delete IDs return400 or404 accurately and DELETE rejects body fields', async (t) => {
  const f = await fixture({ async findRecipeById() { return null; }, async updateRecipe() { return null; }, async deleteRecipe() { return false; } }); t.after(() => f.close()); await f.csrf();
  assert.equal((await f.request('/admin/recipes/01')).status, 400);
  assert.equal((await f.request('/admin/recipes/22')).status, 404);
  assert.equal((await f.request('/admin/recipes/22', { method: 'PATCH', body: { servings: 2 } })).status, 404);
  assert.equal((await f.request('/admin/recipes/22', { method: 'DELETE', body: {} })).status, 404);
  assert.equal((await f.request('/admin/recipes/22', { method: 'DELETE', body: { force: true } })).status, 400);
});

test('10C SQL search/filter use bound parameters and sorting comes only from whitelist', async () => {
  const inputs = new Map(); let statement;
  const repository = createAdminRepository({ request: async () => ({ input(name, _type, value) { inputs.set(name, value); return this; }, async query(sql) { statement = sql; return { recordsets: [[{ total: '0' }], []] }; } }) });
  const search = "%' OR 1=1;--[_~";
  await repository.listRecipes(parseAdminQuery({ search, sort: 'name_desc', categoryId: '8' }, 'recipes'));
  assert.doesNotMatch(statement, /OR 1=1/u);
  assert.match(statement, /ORDER BY r\.RecipeName DESC, r\.RecipeID DESC/u);
  assert.equal(inputs.get('categoryId'), 8);
  assert.equal(inputs.get('search'), "%~%' OR 1=1;--~[~_~~%");
});

test('10F users DTO excludes hashes even if a request adapter returns extra fields', async () => {
  let statement;
  const row = { userId: '9', fullName: 'Người dùng', email: 'fixture@example.test', role: 'User', createdAt: '2026-10-22', passwordHash: 'must-never-leak', secret: 'private' };
  const repository = createAdminRepository({ request: async () => ({ input() { return this; }, async query(sql) { statement = sql; return { recordset: [row], recordsets: [[{ total: '1' }], [row]] }; } }) });
  const user = await repository.findUserById(9);
  assert.equal(user.userId, 9); assert.equal(Object.hasOwn(user, 'passwordHash'), false); assert.equal(Object.hasOwn(user, 'secret'), false);
  assert.doesNotMatch(statement, /PasswordHash/u);
  const list = await repository.listUsers(parseAdminQuery({}, 'users'));
  assert.deepEqual(list.data[0], user);
});

test('10C–10F list pagination is driven by repository total; review removal is distinct from User ownership route', async () => {
  const service = createAdminService({ repository: { async listReviews(input) { assert.equal(input.rating, 4); return { data: [{ reviewId: 7, userId: 80 }], total: 11 }; }, async deleteReview(id) { return id === 7; } } });
  const list = await service.listReviews({ page: '2', limit: '5', rating: '4' });
  assert.equal(list.pagination.totalPages, 3); assert.equal(list.pagination.hasNextPage, true);
  assert.equal((await service.deleteReview('7', {})).message, 'Đã xóa đánh giá.');
  await assert.rejects(() => service.deleteReview('8', {}), (error) => error.status === 404);
});

test('10B dashboard normalizes nonzero ranks and totals without changing SQL ordering', async () => {
  const repository = createAdminRepository({ request: async () => ({ async query() { return { recordsets: [
    [{ recipeCount: '20', ingredientCount: '64', categoryCount: '8', userCount: '4', reviewCount: '7', favoriteCount: '11' }],
    [{ recipeId: '4', recipeName: 'Món 4', count: '6' }, { recipeId: '2', recipeName: 'Món 2', count: '5' }],
    [{ recipeId: '8', recipeName: 'Món 8', count: '7' }], [{ recipeId: '20', recipeName: 'Món mới', createdAt: '2026-10-22' }],
  ] }; } }) });
  const data = await repository.dashboard();
  assert.equal(data.totals.favoriteCount, 11);
  assert.deepEqual(data.mostFavorited.map(({ recipeId, count }) => [recipeId, count]), [[4, 6], [2, 5]]);
  assert.deepEqual(data.mostReviewed.map(({ recipeId, count }) => [recipeId, count]), [[8, 7]]);
  assert.equal(data.newestRecipes[0].recipeId, 20);
});

test('10C all recipe sort options resolve to fixed deterministic SQL with bound pagination', async () => {
  const queries = [];
  const repository = createAdminRepository({ request: async () => {
    const parameters = new Map();
    return { input(name, _type, value) { parameters.set(name, value); return this; },
      async query(statement) { queries.push({ statement, parameters }); return { recordsets: [[{ total: '0' }], []] }; } };
  } });
  for (const sort of ['newest', 'name_asc', 'name_desc', 'time_asc', 'time_desc']) {
    await repository.listRecipes(parseAdminQuery({ sort, page: '3', limit: '7', categoryId: '12' }, 'recipes'));
  }
  assert.equal(new Set(queries.map((query) => query.statement.match(/ORDER BY (.*) OFFSET/u)[1])).size, 5);
  for (const { statement, parameters } of queries) {
    assert.match(statement, /r\.RecipeID (?:ASC|DESC) OFFSET @offset/u);
    assert.equal(parameters.get('offset'), 14); assert.equal(parameters.get('limit'), 7); assert.equal(parameters.get('categoryId'), 12);
    assert.doesNotMatch(statement, /ORDER BY undefined/u);
  }
});

test('10D–10F every search/filter is a SQL parameter including literal LIKE wildcards', async () => {
  const queries = [];
  const repository = createAdminRepository({ request: async () => {
    const parameters = new Map();
    return { input(name, _type, value) { parameters.set(name, value); return this; },
      async query(statement) { queries.push({ statement, parameters }); return { recordsets: [[{ total: '0' }], []] }; } };
  } });
  const search = "%_[~' OR 1=1--";
  await repository.listCategories(parseAdminQuery({ search }, 'categories'));
  await repository.listIngredients(parseAdminQuery({ search, ingredientCategory: "Nhóm'--" }, 'ingredients'));
  await repository.listUsers(parseAdminQuery({ search, role: 'User' }, 'users'));
  await repository.listReviews(parseAdminQuery({ search, recipeId: '5', rating: '4' }, 'reviews'));
  for (const { statement, parameters } of queries) {
    assert.doesNotMatch(statement, /OR 1=1|Nhóm'--/u);
    assert.equal(parameters.get('search'), "%~%~_~[~~' OR 1=1--%");
    assert.match(statement, /ESCAPE N'~'/u);
  }
  assert.equal(queries[1].parameters.get('ingredientCategory'), "Nhóm'--");
  assert.equal(queries[2].parameters.get('role'), 'User');
  assert.equal(queries[3].parameters.get('recipeId'), 5); assert.equal(queries[3].parameters.get('rating'), 4);
});

test('10F Admin users routes remain read-only even for authenticated Admin with valid CSRF', async (t) => {
  const f = await fixture(); t.after(() => f.close()); await f.csrf();
  for (const [path, method, body] of [['/admin/users', 'POST', { role: 'Admin' }], ['/admin/users/7', 'PATCH', { role: 'Admin' }],
    ['/admin/users/7', 'DELETE', {}]]) {
    assert.equal((await f.request(path, { method, body })).status, 404);
  }
});
