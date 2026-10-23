import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getAuthConfig } from '../src/config/auth.js';
import { createAuthSecurity } from '../src/utilities/auth-security.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createPantryRouter } from '../src/routes/pantry.routes.js';
import { createPantryService } from '../src/services/pantry.service.js';
import { createPantryRepository } from '../src/services/pantry.repository.js';
import {
  readPantryId, readPantryQuantity, normalizePantryUnit, readPantryExpiryDate,
  validatePantryCreate, validatePantryUpdate, validatePantryDelete, parsePantryQuery,
} from '../src/utilities/pantry-validation.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

const origin = 'http://localhost:5173';
const isHttpError = (status) => (error) => error.status === status;

function memoryRepository() {
  const rows = new Map();
  const ingredients = new Set([1, 2, 3]);
  let nextId = 1;
  const repository = {
    async ingredientExists(id) { return ingredients.has(id); },
    async list(userId, { offset, limit }) {
      const data = [...rows.values()].filter((row) => row.userId === userId)
        .sort((a, b) => a.userIngredientId - b.userIngredientId);
      return { total: data.length, data: data.slice(offset, offset + limit).map(({ userId: _owner, ...row }) => ({ ...row })) };
    },
    async findById(userId, id) {
      const row = rows.get(id);
      return row?.userId === userId ? { ...row } : null;
    },
    async findByIngredient(userId, ingredientId) {
      return [...rows.values()].find((row) => row.userId === userId && row.ingredientId === ingredientId) ?? null;
    },
    async create(userId, input) {
      if (await this.findByIngredient(userId, input.ingredientId)) throw { number: 2627 };
      const row = { userIngredientId: nextId++, ...input };
      rows.set(row.userIngredientId, { userId, ...row });
      return { ...row };
    },
    async update(userId, id, changes) {
      const row = rows.get(id);
      if (!row || row.userId !== userId) return null;
      Object.assign(row, changes);
      const { userId: _owner, ...data } = row;
      return { ...data };
    },
    async remove(userId, id) {
      return rows.get(id)?.userId === userId && rows.delete(id);
    },
  };
  return { repository, rows, ingredients };
}

async function fixture() {
  const config = getAuthConfig({
    JWT_SECRET: randomBytes(48).toString('base64'), PASSWORD_PEPPER: randomBytes(48).toString('base64'), CLIENT_ORIGIN: origin,
  });
  const users = new Map([1, 2].map((id) => [id, { userId: id, fullName: `Test User ${id}`, email: `test${id}@example.com`, role: 'User' }]));
  const storage = memoryRepository();
  const security = createAuthSecurity({ config, repository: { async findById(id) { return users.get(id) ?? null; } } });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ security }));
  app.use('/api/pantry', createPantryRouter({ security, repository: storage.repository }));
  app.use(errorHandler);
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;

  async function client(userId) {
    const cookies = new Map();
    let csrfToken = '';
    if (userId) security.establishSession({ headers: {} }, { cookie(name, value) { cookies.set(name, value); } }, users.get(userId));
    async function request(path = '/api/pantry', { method = 'GET', body, headers = {}, cookie } = {}) {
      const response = await fetch(`${base}${path}`, {
        method, headers: {
          Cookie: cookie ?? [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
          ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }),
          ...headers,
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
  return { ...storage, client, security, users, config, async close() { await new Promise((resolve) => listener.close(resolve)); } };
}

test('pantry create rejects coercion, SQL identity overflow and ownership overposting', () => {
  assert.deepEqual(validatePantryCreate({ ingredientId: 2_147_483_647 }), {
    ingredientId: 2_147_483_647, quantity: null, unit: null, expiryDate: null,
  });
  for (const body of [null, [], {}, { ingredientId: '1' }, { ingredientId: 0 }, { ingredientId: -1 },
    { ingredientId: 1.5 }, { ingredientId: 2_147_483_648 }, { ingredientId: true }, { ingredientId: NaN },
    { ingredientId: 1, userId: 2 }, { ingredientId: 1, userIngredientId: 2 }, { ingredientId: 1, role: 'Admin' }]) {
    assert.throws(() => validatePantryCreate(body), isHttpError(400));
  }
});

test('pantry quantities fit SQL decimal precision without rounding or coercion', () => {
  for (const value of [null, 0.01, 1, 12.34, 9_999_999_999.99]) assert.equal(readPantryQuantity(value), value);
  for (const value of [0, -1, 0.001, 1.005, 10_000_000_000, '1', '', undefined, Infinity, NaN, true]) {
    assert.throws(() => readPantryQuantity(value), isHttpError(400));
  }
});

test('pantry units normalize Unicode and require explicit nonblank units for known quantities', () => {
  assert.equal(normalizePantryUnit('  go\u0301i  '), 'gói');
  assert.deepEqual(validatePantryCreate({ ingredientId: 1, unit: '  kg ', quantity: 0.5 }), {
    ingredientId: 1, unit: 'kg', quantity: 0.5, expiryDate: null,
  });
  assert.equal(validatePantryCreate({ ingredientId: 1, unit: 'g' }).quantity, null);
  assert.throws(() => validatePantryCreate({ ingredientId: 1, quantity: 2 }), isHttpError(400));
  for (const unit of ['', '  ', '<script>', 'g\n', 'g\u200b', 'x'.repeat(31), 3, undefined]) {
    assert.throws(() => normalizePantryUnit(unit), isHttpError(400));
  }
});

test('pantry expiry validates the Gregorian calendar, retains date-only semantics and permits expired food records', () => {
  for (const value of [null, '0001-01-01', '2000-02-29', '2024-02-29', '2020-01-01', '9999-12-31']) {
    assert.equal(readPantryExpiryDate(value), value);
  }
  for (const value of ['0000-01-01', '1900-02-29', '2025-02-29', '2026-04-31', '2026-13-01',
    '2026-00-01', '2026-01-00', '2026-1-01', '2026-01-1', '2026-01-01T00:00:00Z', ' 2026-01-01', '', 1, undefined]) {
    assert.throws(() => readPantryExpiryDate(value), isHttpError(400));
  }
});

test('pantry patch/delete and query validation reject ambiguous or injected identifiers', () => {
  assert.deepEqual(validatePantryUpdate({ quantity: null }), { quantity: null });
  assert.deepEqual(validatePantryUpdate({ unit: null, expiryDate: null }), { unit: null, expiryDate: null });
  for (const body of [{}, { ingredientId: 2 }, { userId: 2 }, { userIngredientId: 1 }, { role: 'Admin' }, null, []]) {
    assert.throws(() => validatePantryUpdate(body), isHttpError(400));
  }
  validatePantryDelete({});
  for (const body of [undefined, null, [], { userId: 2 }, { ingredientId: 1 }]) {
    assert.throws(() => validatePantryDelete(body), isHttpError(400));
  }
  assert.equal(readPantryId('2147483647'), 2_147_483_647);
  for (const id of ['0', '01', '-1', '1e2', '1;DELETE FROM dbo.UserIngredients', '2147483648', ['1']]) {
    assert.throws(() => readPantryId(id), isHttpError(400));
  }
  assert.deepEqual(parsePantryQuery({}), { page: 1, limit: 100, offset: 0 });
  assert.deepEqual(parsePantryQuery({ page: '3', limit: '10' }), { page: 3, limit: 10, offset: 20 });
  for (const query of [{ userId: '2' }, { ingredientId: '1' }, { page: ['1', '2'] }, { page: '0' }, { limit: '101' }, { page: '100001' }]) {
    assert.throws(() => parsePantryQuery(query), isHttpError(400));
  }
});

test('pantry service CRUD is per owner and permits the same ingredient for different users', async () => {
  const { repository, ingredients } = memoryRepository();
  const service = createPantryService({ repository });
  const first = (await service.add(1, { ingredientId: 1, quantity: 2, unit: 'quả', expiryDate: '2020-01-01' })).data;
  await service.add(1, { ingredientId: 2 });
  const second = (await service.add(2, { ingredientId: 1 })).data;
  await assert.rejects(service.add(1, { ingredientId: 1 }), isHttpError(409));
  const list = await service.list(1, { page: '1', limit: '1' });
  assert.equal(list.pagination.total, 2);
  assert.equal(list.pagination.hasNextPage, true);
  assert.deepEqual(list.data.map((row) => row.userIngredientId), [first.userIngredientId]);
  await assert.rejects(service.update(2, String(first.userIngredientId), { quantity: 1 }), isHttpError(404));
  await assert.rejects(service.remove(2, String(first.userIngredientId), {}), isHttpError(404));
  assert.equal((await service.list(2, {})).data[0].userIngredientId, second.userIngredientId);
  await service.remove(1, String(first.userIngredientId), {});
  await assert.rejects(service.remove(1, String(first.userIngredientId), {}), isHttpError(404));
  assert.equal((await service.list(2, {})).data.length, 1);
  assert.deepEqual([...ingredients], [1, 2, 3]);
  await assert.rejects(service.add(1, { ingredientId: 99 }), isHttpError(404));
});

test('pantry patch validates the merged state and does not convert units or unspecified values', async () => {
  const { repository } = memoryRepository();
  const service = createPantryService({ repository });
  const row = (await service.add(1, { ingredientId: 1, quantity: 2, unit: 'kg', expiryDate: '2026-12-31' })).data;
  await assert.rejects(service.update(1, String(row.userIngredientId), { unit: null }), isHttpError(400));
  const changed = (await service.update(1, String(row.userIngredientId), { unit: 'g' })).data;
  assert.equal(changed.quantity, 2);
  assert.equal(changed.unit, 'g');
  assert.equal(changed.expiryDate, '2026-12-31');
  const cleared = (await service.update(1, String(row.userIngredientId), { quantity: null, unit: null, expiryDate: null })).data;
  assert.equal(cleared.quantity, null);
  assert.equal(cleared.unit, null);
  assert.equal(cleared.expiryDate, null);
  await assert.rejects(service.update(1, String(row.userIngredientId), { quantity: 3 }), isHttpError(400));
});

test('pantry service handles SQL unique races and preserves unexpected failures', async () => {
  for (const error of [{ number: 2601 }, { originalError: { info: { number: 2627 } } },
    { precedingErrors: [{ originalError: { number: 2627 } }] }]) {
    const service = createPantryService({ repository: {
      async ingredientExists() { return true; }, async findByIngredient() { return null; }, async create() { throw error; },
    } });
    await assert.rejects(service.add(1, { ingredientId: 1 }), isHttpError(409));
  }
  const failure = new Error('Unexpected storage failure');
  const service = createPantryService({ repository: {
    async ingredientExists() { return true; }, async findByIngredient() { return null; }, async create() { throw failure; },
  } });
  await assert.rejects(service.add(1, { ingredientId: 1 }), (error) => error === failure);
});

test('pantry service handles foreign-key deletion and SQL CHECK race without leaking SQL errors', async () => {
  let checks = 0;
  const vanished = createPantryService({ repository: {
    async ingredientExists() { return checks++ === 0; }, async findByIngredient() { return null; },
    async create() { throw { originalError: { info: { number: 547 } } }; },
  } });
  await assert.rejects(vanished.add(1, { ingredientId: 1 }), isHttpError(404));
  const checkFailure = createPantryService({ repository: {
    async ingredientExists() { return true; }, async findByIngredient() { return null; },
    async create() { throw { number: 547 }; },
    async findById() { return { quantity: null, unit: null }; },
    async update() { throw { precedingErrors: [{ originalError: { number: 547 } }] }; },
  } });
  await assert.rejects(checkFailure.add(1, { ingredientId: 1 }), isHttpError(400));
  await assert.rejects(checkFailure.update(1, '1', { expiryDate: null }), isHttpError(400));
  const lostRow = createPantryService({ repository: {
    async findById() { return { quantity: null, unit: null }; }, async update() { return null; },
  } });
  await assert.rejects(lostRow.update(1, '1', { expiryDate: null }), isHttpError(404));
});

test('pantry SQL repository normalizes native values and returns date-only strings', async () => {
  const inputs = new Map();
  const repository = createPantryRepository({ request: async () => ({
    input(name, _type, value) { inputs.set(name, value); return this; },
    async query() { return { recordsets: [[{ total: '1' }], [{
      userIngredientId: '12', ingredientId: '3', ingredientName: 'Cà chua', ingredientCategory: 'Rau',
      defaultUnit: 'quả', quantity: '2.50', unit: 'quả', expiryDate: '2026-12-31',
    }]] }; },
  }) });
  const page = await repository.list(7, { offset: 20, limit: 10 });
  assert.deepEqual(Object.fromEntries(inputs), { userId: 7, offset: 20, limit: 10 });
  assert.equal(page.total, 1);
  assert.equal(page.data[0].userIngredientId, 12);
  assert.equal(page.data[0].ingredientId, 3);
  assert.equal(page.data[0].quantity, 2.5);
  assert.equal(page.data[0].imageUrl, null);
  assert.equal(page.data[0].expiryDate, '2026-12-31');
});

test('pantry SQL mutations bind user data and delete only the owned UserIngredients row', async () => {
  const executions = [];
  const repository = createPantryRepository({ request: async () => {
    const inputs = new Map();
    return {
      input(name, _type, value) { inputs.set(name, value); return this; },
      async query(statement) {
        executions.push({ statement, inputs: Object.fromEntries(inputs) });
        return { recordset: [] };
      },
    };
  } });
  const hostileUnit = "g'); DELETE FROM dbo.Ingredients;--";
  await repository.update(7, 11, { quantity: 2.5, unit: hostileUnit, expiryDate: '2026-12-31' });
  assert.deepEqual(executions[0].inputs, { userId: 7, id: 11, quantity: 2.5, unit: hostileUnit, expiryDate: '2026-12-31' });
  assert.equal(executions[0].statement.includes(hostileUnit), false);
  assert.match(executions[0].statement, /WHERE UserID = @userId AND UserIngredientID = @id/u);
  assert.match(executions[0].statement, /CONVERT\(DATE, @expiryDate, 23\)/u);
  assert.equal(await repository.remove(7, 11), false);
  assert.deepEqual(executions[1].inputs, { userId: 7, id: 11 });
  assert.match(executions[1].statement, /DELETE FROM dbo\.UserIngredients/u);
  assert.doesNotMatch(executions[1].statement, /DELETE FROM dbo\.Ingredients\b/u);
  assert.match(executions[1].statement, /WHERE UserID = @userId AND UserIngredientID = @id/u);
});

test('pantry HTTP endpoints require an active account and send private no-store responses', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const guest = await f.client();
  for (const [path, options] of [
    ['/api/pantry', {}], ['/api/pantry', { method: 'POST', body: { ingredientId: 1 } }],
    ['/api/pantry/1', { method: 'PATCH', body: { quantity: null } }], ['/api/pantry/1', { method: 'DELETE', body: {} }],
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

test('pantry HTTP CRUD stores only the session owner and rejects cross-user access or overposting', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const first = await f.client(1);
  const second = await f.client(2);
  const created = await first.request('/api/pantry', { method: 'POST', body: { ingredientId: 1, quantity: 2, unit: 'quả', expiryDate: '2020-01-01' } });
  assert.equal(created.status, 201);
  const id = created.body.data.userIngredientId;
  assert.equal(created.body.data.ingredientId, 1);
  assert.equal(created.body.data.expiryDate, '2020-01-01');
  assert.equal(created.body.data.userId, undefined);
  assert.equal(created.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual((await second.request()).body.data, []);
  assert.equal((await second.request(`/api/pantry/${id}`, { method: 'PATCH', body: { quantity: 1 } })).status, 404);
  assert.equal((await second.request(`/api/pantry/${id}`, { method: 'DELETE', body: {} })).status, 404);
  assert.equal((await first.request('/api/pantry?userId=2')).status, 400);
  assert.equal((await first.request('/api/pantry', { method: 'POST', body: { ingredientId: 2, userId: 2 } })).status, 400);
  assert.equal((await first.request(`/api/pantry/${id}`, { method: 'PATCH', body: { ingredientId: 2 } })).status, 400);
  assert.equal((await first.request(`/api/pantry/${id}`, { method: 'PATCH', body: { quantity: 3 } })).body.data.quantity, 3);
  assert.equal((await first.request(`/api/pantry/${id}`, { method: 'PATCH', body: { unit: null } })).status, 400);
  assert.equal((await first.request('/api/pantry', { method: 'POST', body: { ingredientId: 1 } })).status, 409);
  assert.equal((await second.request('/api/pantry', { method: 'POST', body: { ingredientId: 1 } })).status, 201);
  assert.equal((await first.request(`/api/pantry/${id}`, { method: 'DELETE', body: {} })).status, 200);
  assert.equal((await first.request(`/api/pantry/${id}`, { method: 'DELETE', body: {} })).status, 404);
  assert.equal((await second.request()).body.data.length, 1);
  assert.deepEqual([...f.ingredients], [1, 2, 3]);
});

test('pantry HTTP mutations enforce CSRF, Origin and JSON without applying rejected requests', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const user = await f.client(1);
  for (const headers of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': '0'.repeat(64) }, { Origin: '' }, { Origin: 'null' }, { Origin: 'https://evil.example' }]) {
    assert.equal((await user.request('/api/pantry', { method: 'POST', body: { ingredientId: 1 }, headers })).status, 403);
  }
  assert.equal((await user.request('/api/pantry', { method: 'POST', body: { ingredientId: 1 }, headers: { 'Content-Type': 'text/plain' } })).status, 400);
  assert.equal(f.rows.size, 0);
  const created = await user.request('/api/pantry', { method: 'POST', body: { ingredientId: 1 } });
  const id = created.body.data.userIngredientId;
  assert.equal((await user.request(`/api/pantry/${id}`, { method: 'PATCH', body: { quantity: null }, headers: { 'X-CSRF-Token': '' } })).status, 403);
  assert.equal((await user.request(`/api/pantry/${id}`, { method: 'DELETE', body: {}, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal(f.rows.size, 1);
});

test('pantry HTTP rejects malformed pagination, quantity/date and delete bodies safely', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const user = await f.client(1);
  for (const suffix of ['?page=1&page=2', '?limit=101', '?page=01', '?limit=1%3BDROP%20TABLE%20dbo.Users']) {
    assert.equal((await user.request(`/api/pantry${suffix}`)).status, 400);
  }
  for (const body of [{ ingredientId: '1' }, { ingredientId: 1, quantity: 0 }, { ingredientId: 1, quantity: 1 },
    { ingredientId: 1, expiryDate: '2025-02-29' }, { ingredientId: 1, unit: '' }]) {
    assert.equal((await user.request('/api/pantry', { method: 'POST', body })).status, 400);
  }
  assert.equal((await user.request('/api/pantry', { method: 'POST', body: { ingredientId: 99 } })).status, 404);
  assert.equal((await user.request('/api/pantry/01', { method: 'PATCH', body: { quantity: null } })).status, 400);
  assert.equal((await user.request('/api/pantry/1', { method: 'DELETE', body: { userId: 2 } })).status, 400);
  assert.equal(f.rows.size, 0);
});

test('pantry HTTP rejects expired JWTs and replay after logout without modifying pantry', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const user = await f.client(1);
  const captured = [...user.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  const claims = jwt.decode(user.cookies.get(f.config.cookieName));
  const timestamp = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ ...claims, iat: timestamp - 60, exp: timestamp - 1 }, f.config.jwtSecret);
  assert.equal((await user.request('/api/pantry', { cookie: `${f.config.cookieName}=${expired}` })).status, 401);
  assert.equal((await user.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await user.request('/api/pantry', { cookie: captured })).status, 401);
  assert.equal((await user.request('/api/pantry', { method: 'POST', body: { ingredientId: 1 }, cookie: captured })).status, 401);
  assert.equal(f.rows.size, 0);
});
