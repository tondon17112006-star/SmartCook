import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { getAuthConfig } from '../src/config/auth.js';
import { createAuthSecurity } from '../src/utilities/auth-security.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createFavoriteRouter } from '../src/routes/favorite.routes.js';
import { createFavoriteService } from '../src/services/favorite.service.js';
import { createFavoriteRepository } from '../src/services/favorite.repository.js';
import { parseFavoriteQuery, validateFavoriteCreate, validateFavoriteDelete } from '../src/utilities/personal-validation.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

const origin = 'http://localhost:5173';
const isHttpError = (status) => (error) => error.status === status;

function memoryRepository() {
  const rows = new Map();
  let nextId = 1;
  const recipes = new Set([1, 2, 3]);
  const key = (userId, recipeId) => `${userId}:${recipeId}`;
  const repository = {
    async recipeExists(recipeId) { return recipes.has(recipeId); },
    async find(userId, recipeId) { return rows.get(key(userId, recipeId)) ?? null; },
    async create(userId, recipeId) {
      if (rows.has(key(userId, recipeId))) throw Object.assign(new Error('SQL unique constraint'), { number: 2627 });
      const row = { favoriteId: nextId++, recipeId, createdAt: '2026-10-22T00:00:00.000Z' };
      rows.set(key(userId, recipeId), row);
      return { ...row };
    },
    async remove(userId, recipeId) { return rows.delete(key(userId, recipeId)); },
    async listIds(userId) {
      return [...rows].filter(([id]) => id.startsWith(`${userId}:`))
        .map(([, row]) => row).sort((a, b) => b.favoriteId - a.favoriteId).map((row) => row.recipeId);
    },
    async list(userId, { offset, limit }) {
      const ids = await this.listIds(userId);
      return { total: ids.length, data: ids.slice(offset, offset + limit).map((id) => ({
        ...rows.get(key(userId, id)), recipeName: `Món ${id}`, description: null, imageUrl: null,
        prepTime: 5, cookTime: 10, totalTime: 15, servings: 2, difficulty: 'Dễ', categoryName: 'Món chính',
      })) };
    },
  };
  return { repository, rows, recipes };
}

async function fixture() {
  const config = getAuthConfig({
    JWT_SECRET: randomBytes(48).toString('base64'), PASSWORD_PEPPER: randomBytes(48).toString('base64'), CLIENT_ORIGIN: origin,
  });
  const users = new Map([1, 2].map((id) => [id, { userId: id, fullName: `Test User ${id}`, email: `test${id}@example.com`, role: 'User' }]));
  const { repository, rows } = memoryRepository();
  const security = createAuthSecurity({ config, repository: { async findById(id) { return users.get(id) ?? null; } } });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ security }));
  app.use('/api/favorites', createFavoriteRouter({ security, repository }));
  app.use(errorHandler);
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;

  async function client(userId) {
    const cookies = new Map();
    let csrfToken = '';
    if (userId) security.establishSession({ headers: {} }, { cookie(name, value) { cookies.set(name, value); } }, users.get(userId));
    async function request(path = '/api/favorites', { method = 'GET', body, headers = {}, cookie } = {}) {
      const response = await fetch(`${base}${path}`, {
        method, headers: {
          Cookie: cookie ?? [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
          ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }), ...headers,
        }, body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const item of response.headers.getSetCookie()) {
        const pair = item.split(';')[0];
        const separator = pair.indexOf('=');
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    async function csrf() {
      const response = await request('/api/auth/csrf');
      assert.equal(response.status, 200);
      csrfToken = response.body.csrfToken;
    }
    await csrf();
    return { request, csrf, cookies };
  }
  return { client, security, users, repository, rows, async close() { await new Promise((resolve) => listener.close(resolve)); } };
}

test('favorite JSON validation rejects coercion, overposting and invalid SQL identities', () => {
  assert.deepEqual(validateFavoriteCreate({ recipeId: 2_147_483_647 }), { recipeId: 2_147_483_647 });
  for (const body of [null, [], {}, { recipeId: '1' }, { recipeId: 0 }, { recipeId: -1 }, { recipeId: 1.5 },
    { recipeId: 2_147_483_648 }, { recipeId: Number.NaN }, { recipeId: true }, { recipeId: 1, userId: 2 }, { recipeId: 1, role: 'Admin' }]) {
    assert.throws(() => validateFavoriteCreate(body), isHttpError(400));
  }
});

test('favorite deletion requires canonical path identity and an empty JSON object', () => {
  assert.equal(validateFavoriteDelete('1', {}), 1);
  for (const id of ['01', '0', '-1', '1e2', '1;DELETE FROM dbo.Favorites', '2147483648', ['1']]) {
    assert.throws(() => validateFavoriteDelete(id, {}), isHttpError(400));
  }
  for (const body of [undefined, null, [], { userId: 2 }, { recipeId: 1 }]) {
    assert.throws(() => validateFavoriteDelete('1', body), isHttpError(400));
  }
});

test('favorite pagination has bounded defaults and rejects duplicate or ownership query parameters', () => {
  assert.deepEqual(parseFavoriteQuery({}), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(parseFavoriteQuery({ page: '2', limit: '3' }), { page: 2, limit: 3, offset: 3 });
  for (const query of [{ userId: '2' }, { page: ['1', '2'] }, { page: '0' }, { limit: '101' }, { page: '100001' }]) {
    assert.throws(() => parseFavoriteQuery(query), isHttpError(400));
  }
});

test('favorite service scopes list, IDs, duplicates and removal by user', async () => {
  const { repository } = memoryRepository();
  const service = createFavoriteService({ repository });
  await service.add(1, { recipeId: 1 });
  await service.add(1, { recipeId: 2 });
  await service.add(2, { recipeId: 1 });
  const page = await service.list(1, { page: '1', limit: '1' });
  assert.deepEqual(page.data.map((item) => item.recipeId), [2]);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.hasNextPage, true);
  assert.deepEqual(await service.ids(2), { data: [1] });
  await assert.rejects(service.add(1, { recipeId: 1 }), isHttpError(409));
  await assert.rejects(service.remove(2, '2', {}), isHttpError(404));
  await service.remove(2, '1', {});
  assert.deepEqual(await service.ids(1), { data: [2, 1] });
  assert.deepEqual(await service.ids(2), { data: [] });
  await assert.rejects(service.add(1, { recipeId: 99 }), isHttpError(404));
});

test('favorite service resolves SQL unique races without exposing driver errors', async () => {
  for (const error of [
    { number: 2601 }, { originalError: { info: { number: 2627 } } }, { precedingErrors: [{ originalError: { number: 2627 } }] },
  ]) {
    const service = createFavoriteService({ repository: {
      async recipeExists() { return true; }, async find() { return null; }, async create() { throw error; },
    } });
    await assert.rejects(service.add(1, { recipeId: 1 }), isHttpError(409));
  }
  const failure = new Error('Unexpected storage failure');
  const service = createFavoriteService({ repository: {
    async recipeExists() { return true; }, async find() { return null; }, async create() { throw failure; },
  } });
  await assert.rejects(service.add(1, { recipeId: 1 }), (error) => error === failure);
});

test('favorite service returns 404 when a recipe disappears between existence check and insert', async () => {
  let calls = 0;
  const service = createFavoriteService({ repository: {
    async recipeExists() { return calls++ === 0; }, async find() { return null; },
    async create() { throw { number: 547 }; },
  } });
  await assert.rejects(service.add(1, { recipeId: 1 }), isHttpError(404));
});

test('favorite SQL repository normalizes native string identities and UTC dates in list responses', async () => {
  const inputs = new Map();
  const repository = createFavoriteRepository({ request: async () => ({
    input(name, _type, value) { inputs.set(name, value); return this; },
    async query() { return { recordsets: [[{ total: '1' }], [{
      favoriteId: '12', recipeId: '3', createdAt: new Date('2026-10-22T00:00:00Z'), recipeName: 'Món thử',
      prepTime: '5', cookTime: '10', totalTime: '15', servings: '2', difficulty: 'Dễ', categoryName: 'Món chính',
    }]] }; },
  }) });
  const page = await repository.list(7, { offset: 20, limit: 10 });
  assert.deepEqual(Object.fromEntries(inputs), { userId: 7, offset: 20, limit: 10 });
  assert.equal(page.total, 1);
  assert.equal(page.data[0].favoriteId, 12);
  assert.equal(page.data[0].recipeId, 3);
  assert.equal(page.data[0].createdAt, '2026-10-22T00:00:00.000Z');
  assert.equal(page.data[0].totalTime, 15);
});

test('favorite HTTP endpoints require an active authenticated SQL identity', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const guest = await f.client();
  for (const [path, options] of [
    ['/api/favorites', {}], ['/api/favorites/ids', {}],
    ['/api/favorites', { method: 'POST', body: { recipeId: 1 } }],
    ['/api/favorites/1', { method: 'DELETE', body: {} }],
  ]) {
    const response = await guest.request(path, options);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  const user = await f.client(1);
  assert.equal((await user.request()).status, 200);
  f.users.delete(1);
  assert.equal((await user.request()).status, 401);
});

test('favorite HTTP save/list/remove is private, paginated and rejects cross-user access', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const first = await f.client(1);
  const second = await f.client(2);
  const created = await first.request('/api/favorites', { method: 'POST', body: { recipeId: 1 } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.recipeId, 1);
  assert.deepEqual(Object.keys(created.body.data).sort(), ['createdAt', 'favoriteId', 'recipeId']);
  assert.equal(created.headers.get('cache-control'), 'private, no-store');
  await first.request('/api/favorites', { method: 'POST', body: { recipeId: 2 } });
  const list = await first.request('/api/favorites?page=1&limit=1');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.map((row) => row.recipeId), [2]);
  assert.equal(list.body.pagination.totalPages, 2);
  assert.deepEqual((await second.request('/api/favorites/ids')).body.data, []);
  assert.equal((await second.request('/api/favorites/1', { method: 'DELETE', body: {} })).status, 404);
  assert.deepEqual((await first.request('/api/favorites/ids')).body.data, [2, 1]);
  assert.equal((await first.request('/api/favorites?userId=2')).status, 400);
  assert.equal((await first.request('/api/favorites', { method: 'POST', body: { recipeId: 3, userId: 2 } })).status, 400);
  assert.equal((await first.request('/api/favorites/1', { method: 'DELETE', body: {} })).status, 200);
  assert.deepEqual((await first.request('/api/favorites/ids')).body.data, [2]);
});

test('favorite HTTP mutations enforce CSRF, Origin, JSON and strict path/body validation', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const user = await f.client(1);
  for (const headers of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': '0'.repeat(64) }, { Origin: '' }, { Origin: 'https://evil.example' }]) {
    assert.equal((await user.request('/api/favorites', { method: 'POST', body: { recipeId: 1 }, headers })).status, 403);
  }
  assert.equal(f.rows.size, 0);
  assert.equal((await user.request('/api/favorites', { method: 'POST', body: { recipeId: 1 }, headers: { 'Content-Type': 'text/plain' } })).status, 400);
  assert.equal((await user.request('/api/favorites', { method: 'POST', body: { recipeId: '1' } })).status, 400);
  assert.equal((await user.request('/api/favorites', { method: 'POST', body: { recipeId: 99 } })).status, 404);
  assert.equal((await user.request('/api/favorites', { method: 'POST', body: { recipeId: 1 } })).status, 201);
  assert.equal((await user.request('/api/favorites', { method: 'POST', body: { recipeId: 1 } })).status, 409);
  assert.equal((await user.request('/api/favorites/1', { method: 'DELETE', body: {} , headers: { 'X-CSRF-Token': '' } })).status, 403);
  assert.equal((await user.request('/api/favorites/01', { method: 'DELETE', body: {} })).status, 400);
  assert.equal((await user.request('/api/favorites/1', { method: 'DELETE', body: { userId: 2 } })).status, 400);
  assert.deepEqual((await user.request('/api/favorites/ids')).body.data, [1]);
});

test('favorite HTTP endpoints reject replay after logout revokes the session', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const user = await f.client(1);
  const captured = [...user.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  assert.equal((await user.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await user.request('/api/favorites/ids', { cookie: captured })).status, 401);
  assert.equal((await user.request('/api/favorites', { method: 'POST', body: { recipeId: 1 }, cookie: captured })).status, 401);
  assert.equal(f.rows.size, 0);
});
