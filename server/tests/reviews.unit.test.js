import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { getAuthConfig } from '../src/config/auth.js';
import { createAuthSecurity } from '../src/utilities/auth-security.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createReviewRouter, createPublicReviewRouter } from '../src/routes/review.routes.js';
import { createReviewService } from '../src/services/review.service.js';
import { createReviewRepository } from '../src/services/review.repository.js';
import { normalizeReviewComment, parseReviewQuery, readReviewId, validateReviewCreate, validateReviewUpdate, validateReviewDelete } from '../src/utilities/review-validation.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

const origin = 'http://localhost:5173';
const isHttpError = (status) => (error) => error.status === status;

function memoryRepository() {
  const rows = new Map();
  const recipes = new Set([1, 2]);
  let nextId = 1;
  const repository = {
    async recipeExists(recipeId) { return recipes.has(recipeId); },
    async findMine(userId, recipeId) { return [...rows.values()].find((row) => row.userId === userId && row.recipeId === recipeId) ?? null; },
    async create(userId, recipeId, changes) {
      if (await this.findMine(userId, recipeId)) throw { number: 2627 };
      const row = { reviewId: nextId++, recipeId, userId, fullName: `Test User ${userId}`, ...changes, createdAt: '2026-10-22T00:00:00.000Z' };
      rows.set(row.reviewId, row);
      return { ...row };
    },
    async update(userId, reviewId, changes) {
      const row = rows.get(reviewId);
      if (!row || row.userId !== userId) return null;
      return { ...Object.assign(row, changes) };
    },
    async remove(userId, reviewId) {
      const row = rows.get(reviewId);
      return row?.userId === userId ? rows.delete(reviewId) : false;
    },
    async list(recipeId, { offset, limit }) {
      const reviews = [...rows.values()].filter((row) => row.recipeId === recipeId).sort((a, b) => b.reviewId - a.reviewId);
      return {
        data: reviews.slice(offset, offset + limit).map((row) => ({ ...row })), total: reviews.length,
        averageRating: reviews.length ? reviews.reduce((total, row) => total + row.rating, 0) / reviews.length : 0,
      };
    },
  };
  return { repository, rows, recipes };
}

async function fixture() {
  const config = getAuthConfig({
    JWT_SECRET: randomBytes(48).toString('base64'), PASSWORD_PEPPER: randomBytes(48).toString('base64'), CLIENT_ORIGIN: origin,
  });
  const users = new Map([1, 2, 3].map((id) => [id, { userId: id, fullName: `Test User ${id}`, role: 'User' }]));
  const { repository, rows } = memoryRepository();
  const security = createAuthSecurity({ config, repository: { async findById(id) { return users.get(id) ?? null; } } });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ security }));
  app.use('/api/recipes', createPublicReviewRouter({ repository }));
  app.use('/api', createReviewRouter({ security, repository }));
  app.get('/api/recipes', (_req, res) => res.json({ data: [] }));
  app.use(errorHandler);
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;

  async function client(userId) {
    const cookies = new Map();
    let csrfToken = '';
    if (userId) security.establishSession({ headers: {} }, { cookie(name, value) { cookies.set(name, value); } }, users.get(userId));
    async function request(path, { method = 'GET', body, headers = {}, cookie } = {}) {
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
  return { client, repository, rows, users, security, async close() { await new Promise((resolve) => listener.close(resolve)); } };
}

test('reviews validate integer ratings 1–5 without coercion or identity overposting', () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.deepEqual(validateReviewCreate({ rating }), { rating, comment: null });
  for (const body of [null, [], {}, { rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: '5' }, { rating: true },
    { rating: 5, userId: 2 }, { rating: 5, recipeId: 1 }, { rating: 5, role: 'Admin' }]) {
    assert.throws(() => validateReviewCreate(body), isHttpError(400));
  }
});

test('review comments normalize Unicode, allow optional/blank text and preserve literal HTML', () => {
  assert.equal(normalizeReviewComment(null), null);
  assert.equal(normalizeReviewComment(' \n\t '), null);
  assert.equal(normalizeReviewComment('  Mo\u0301n ngon\n\tCa\u0309m o\u031bn!  '), 'Món ngon\n\tCảm ơn!');
  const html = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  assert.equal(normalizeReviewComment(html), html);
  assert.equal(normalizeReviewComment('x'.repeat(2000)).length, 2000);
  assert.equal(normalizeReviewComment('😀'.repeat(1000)).length, 2000);
  for (const comment of [undefined, 1, {}, [], 'x'.repeat(2001), '😀'.repeat(1001), '\0bad', '\u000bbad', 'bad\u007f']) {
    assert.throws(() => normalizeReviewComment(comment), isHttpError(400));
  }
});

test('review edits accept a nonempty partial of rating/comment only; delete requires JSON {}', () => {
  assert.deepEqual(validateReviewUpdate({ rating: 3 }), { rating: 3 });
  assert.deepEqual(validateReviewUpdate({ comment: '' }), { comment: null });
  assert.deepEqual(validateReviewUpdate({ rating: 4, comment: ' Đã thử ' }), { rating: 4, comment: 'Đã thử' });
  for (const body of [{}, null, [], { userId: 1 }, { rating: 4, recipeId: 2 }, { rating: 0 }, { comment: undefined }]) {
    assert.throws(() => validateReviewUpdate(body), isHttpError(400));
  }
  assert.equal(validateReviewDelete({}), undefined);
  for (const body of [undefined, null, [], { userId: 2 }, { rating: 5 }]) {
    assert.throws(() => validateReviewDelete(body), isHttpError(400));
  }
});

test('review paths and pagination reject malformed, duplicate and unexpected inputs', () => {
  assert.equal(readReviewId('2147483647'), 2_147_483_647);
  for (const id of ['0', '-1', '01', '1e2', '2147483648', '1 OR 1=1', 1, ['1']]) assert.throws(() => readReviewId(id), isHttpError(400));
  assert.deepEqual(parseReviewQuery({}), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(parseReviewQuery({ page: '2', limit: '5' }), { page: 2, limit: 5, offset: 5 });
  for (const query of [{ userId: '2' }, { page: '0' }, { limit: '101' }, { page: ['1', '2'] }]) {
    assert.throws(() => parseReviewQuery(query), isHttpError(400));
  }
});

test('review summary includes all ratings across pages and rounds to two decimals', async () => {
  const { repository } = memoryRepository();
  const service = createReviewService({ repository });
  assert.deepEqual((await service.list('1', {})).summary, { averageRating: 0, reviewCount: 0 });
  await service.add(1, '1', { rating: 5 });
  await service.add(2, '1', { rating: 4, comment: 'Ngon' });
  await service.add(3, '1', { rating: 2 });
  const result = await service.list('1', { page: '2', limit: '1' });
  assert.deepEqual(result.summary, { averageRating: 3.67, reviewCount: 3 });
  assert.equal(result.pagination.totalPages, 3);
  assert.deepEqual(result.data.map((row) => row.userId), [2]);
  await assert.rejects(service.list('99', {}), isHttpError(404));
  await assert.rejects(service.mine(1, '99'), isHttpError(404));
});

test('review ownership limits lookup/update/delete and duplicate reviews are rejected', async () => {
  const { repository } = memoryRepository();
  const service = createReviewService({ repository });
  const { data: review } = await service.add(1, '1', { rating: 5, comment: 'Ban đầu' });
  assert.equal((await service.mine(1, '1')).data.reviewId, review.reviewId);
  assert.deepEqual(await service.mine(2, '1'), { data: null });
  await assert.rejects(service.add(1, '1', { rating: 4 }), isHttpError(409));
  await assert.rejects(service.update(2, String(review.reviewId), { rating: 1 }), isHttpError(404));
  await assert.rejects(service.remove(2, String(review.reviewId), {}), isHttpError(404));
  const updated = await service.update(1, String(review.reviewId), { rating: 3 });
  assert.equal(updated.data.rating, 3);
  assert.equal(updated.data.comment, 'Ban đầu');
  assert.equal(updated.data.createdAt, review.createdAt);
  await service.remove(1, String(review.reviewId), {});
  assert.deepEqual(await service.mine(1, '1'), { data: null });
});

test('review service maps concurrent unique/FK races and propagates unexpected failures safely', async () => {
  for (const error of [{ number: 2601 }, { originalError: { info: { number: 2627 } } }, { precedingErrors: [{ number: 2627 }] }]) {
    const service = createReviewService({ repository: {
      async recipeExists() { return true; }, async findMine() { return null; }, async create() { throw error; },
    } });
    await assert.rejects(service.add(1, '1', { rating: 4 }), isHttpError(409));
  }
  let existsCalls = 0;
  const deletedRecipe = createReviewService({ repository: {
    async recipeExists() { return existsCalls++ === 0; }, async findMine() { return null; }, async create() { throw { number: 547 }; },
  } });
  await assert.rejects(deletedRecipe.add(1, '1', { rating: 4 }), isHttpError(404));
  const failure = new Error('Storage failure');
  const broken = createReviewService({ repository: {
    async recipeExists() { return true; }, async findMine() { return null; }, async create() { throw failure; },
  } });
  await assert.rejects(broken.add(1, '1', { rating: 4 }), (error) => error === failure);
});

test('review SQL repository binds user text and excludes private Users fields from its DTO', async () => {
  const comment = "<script>alert(1)</script>'; DELETE FROM dbo.Recipes;--";
  const inputs = new Map();
  let statement;
  const repository = createReviewRepository({ request: async () => ({
    input(name, _type, value) { inputs.set(name, value); return this; },
    async query(value) { statement = value; return { recordset: [{
      reviewId: '12', recipeId: '3', userId: '7', fullName: 'Test User', rating: '5', comment,
      createdAt: new Date('2026-10-22T00:00:00Z'), email: 'private@example.com', passwordHash: 'private', role: 'Admin',
    }] }; },
  }) });
  const result = await repository.create(7, 3, { rating: 5, comment });
  assert.deepEqual(Object.fromEntries(inputs), { userId: 7, recipeId: 3, rating: 5, comment });
  assert.equal(statement.includes(comment), false);
  assert.deepEqual(Object.keys(result).sort(), ['comment', 'createdAt', 'fullName', 'rating', 'recipeId', 'reviewId', 'userId']);
  assert.equal(result.reviewId, 12);
  assert.equal(result.comment, comment);
  assert.equal(result.createdAt, '2026-10-22T00:00:00.000Z');
});

test('public review routes remain available to guests and leave unrelated public API paths alone', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const guest = await f.client();
  const response = await guest.request('/api/recipes/1/reviews');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, []);
  assert.deepEqual(response.body.summary, { averageRating: 0, reviewCount: 0 });
  assert.equal((await guest.request('/api/recipes')).status, 200);
  for (const [path, options] of [
    ['/api/recipes/1/reviews/mine', {}],
    ['/api/recipes/1/reviews', { method: 'POST', body: { rating: 5 } }],
    ['/api/reviews/1', { method: 'PATCH', body: { rating: 2 } }],
    ['/api/reviews/1', { method: 'DELETE', body: {} }],
  ]) {
    const blocked = await guest.request(path, options);
    assert.equal(blocked.status, 401);
    assert.equal(blocked.headers.get('cache-control'), 'private, no-store');
  }
});

test('review HTTP CRUD enforces ownership, public privacy, duplicates and live summary updates', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const first = await f.client(1);
  // Controlled memory user only; no database Admin is created or promoted.
  f.users.get(2).role = 'Admin';
  const second = await f.client(2);
  const guest = await f.client();
  const html = '<img src=x onerror="alert(1)">';
  const created = await first.request('/api/recipes/1/reviews', { method: 'POST', body: { rating: 5, comment: html } });
  assert.equal(created.status, 201);
  const id = created.body.data.reviewId;
  assert.equal(created.body.data.comment, html);
  assert.equal((await first.request('/api/recipes/1/reviews', { method: 'POST', body: { rating: 1 } })).status, 409);
  assert.equal((await first.request('/api/recipes/1/reviews/mine')).body.data.reviewId, id);
  assert.deepEqual((await second.request('/api/recipes/1/reviews/mine')).body, { data: null });
  assert.equal((await second.request(`/api/reviews/${id}`, { method: 'PATCH', body: { rating: 1 } })).status, 404);
  assert.equal((await second.request(`/api/reviews/${id}`, { method: 'DELETE', body: {} })).status, 404);
  const publicList = await guest.request('/api/recipes/1/reviews');
  assert.deepEqual(Object.keys(publicList.body.data[0]).sort(), ['comment', 'createdAt', 'fullName', 'rating', 'recipeId', 'reviewId', 'userId']);
  assert.deepEqual(publicList.body.summary, { averageRating: 5, reviewCount: 1 });
  const edited = await first.request(`/api/reviews/${id}`, { method: 'PATCH', body: { rating: 3, comment: null } });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.comment, null);
  assert.deepEqual((await guest.request('/api/recipes/1/reviews')).body.summary, { averageRating: 3, reviewCount: 1 });
  assert.equal((await first.request(`/api/reviews/${id}`, { method: 'DELETE', body: {} })).status, 200);
  assert.deepEqual((await guest.request('/api/recipes/1/reviews')).body.summary, { averageRating: 0, reviewCount: 0 });
});

test('review HTTP validates rating/comment/path/JSON and rejects identity mass assignment', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const user = await f.client(1);
  for (const body of [{ rating: 0 }, { rating: '5' }, { rating: 4, comment: 'x'.repeat(2001) }, { rating: 4, userId: 2 }, { rating: 4, recipeId: 2 }]) {
    assert.equal((await user.request('/api/recipes/1/reviews', { method: 'POST', body })).status, 400);
  }
  assert.equal((await user.request('/api/recipes/99/reviews', { method: 'POST', body: { rating: 4 } })).status, 404);
  assert.equal((await user.request('/api/recipes/01/reviews')).status, 400);
  assert.equal((await user.request('/api/recipes/1/reviews?page=1&page=2')).status, 400);
  assert.equal((await user.request('/api/recipes/1/reviews', { method: 'POST', body: { rating: 4 }, headers: { 'Content-Type': 'text/plain' } })).status, 400);
  const { body: { data } } = await user.request('/api/recipes/1/reviews', { method: 'POST', body: { rating: 4 } });
  for (const body of [{}, { userId: 2 }, { recipeId: 2 }, { rating: 6 }]) {
    assert.equal((await user.request(`/api/reviews/${data.reviewId}`, { method: 'PATCH', body })).status, 400);
  }
  assert.equal((await user.request(`/api/reviews/${data.reviewId}`, { method: 'DELETE', body: { userId: 2 } })).status, 400);
  assert.equal(f.rows.size, 1);
});

test('review HTTP mutations enforce Origin/CSRF and reject revoked session replay', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  const user = await f.client(1);
  for (const headers of [{ 'X-CSRF-Token': '' }, { 'X-CSRF-Token': '0'.repeat(64) }, { Origin: '' }, { Origin: 'https://evil.example' }]) {
    assert.equal((await user.request('/api/recipes/1/reviews', { method: 'POST', body: { rating: 5 }, headers })).status, 403);
  }
  assert.equal(f.rows.size, 0);
  const { body: { data } } = await user.request('/api/recipes/1/reviews', { method: 'POST', body: { rating: 5 } });
  for (const [method, body] of [['PATCH', { rating: 1 }], ['DELETE', {}]]) {
    assert.equal((await user.request(`/api/reviews/${data.reviewId}`, { method, body, headers: { 'X-CSRF-Token': '' } })).status, 403);
  }
  const captured = [...user.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  assert.equal((await user.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await user.request('/api/recipes/1/reviews/mine', { cookie: captured })).status, 401);
  assert.equal((await user.request(`/api/reviews/${data.reviewId}`, { method: 'DELETE', body: {}, cookie: captured })).status, 401);
  assert.equal((await (await f.client()).request('/api/recipes/1/reviews')).status, 200);
  assert.equal(f.rows.size, 1);
});
