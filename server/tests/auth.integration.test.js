import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import express from 'express';
import { getPool, closePool, sql } from '../src/config/database.js';
import { getAuthConfig } from '../src/config/auth.js';
import { createUserRepository } from '../src/services/user.repository.js';
import { createAuthSecurity } from '../src/utilities/auth-security.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createAdminRouter } from '../src/routes/admin.routes.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { verifyPassword, PASSWORD_HASH_PREFIX } from '../src/utilities/passwords.js';

const origin = 'http://localhost:5173';
const config = getAuthConfig({ JWT_SECRET: randomBytes(48).toString('hex'), PASSWORD_PEPPER: randomBytes(48).toString('hex'), CLIENT_ORIGIN: origin });
const email = `auth-${randomBytes(10).toString('hex')}@example.test`;
const password = `${'Ẩm thực Việt 🍳 '.repeat(8)}khác sau 72 byte`;
let transaction, repository, security, server, base, registered, baseline;
const jar = new Map();

async function send(path, { method = 'GET', body, headers = {}, cookies = jar } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Origin: origin, Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  for (const item of response.headers.getSetCookie()) {
    const [name, ...rest] = item.split(';')[0].split('=');
    if (rest.join('=')) cookies.set(name, rest.join('=')); else cookies.delete(name);
  }
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function mutate(path, body, options = {}) {
  const csrf = await send('/auth/csrf', { cookies: options.cookies });
  assert.equal(csrf.status, 200);
  return send(path, { method: 'POST', body, ...options, headers: { 'X-CSRF-Token': csrf.body.csrfToken, ...options.headers } });
}

before(async () => {
  const pool = await getPool();
  baseline = (await pool.request().query('SELECT COUNT_BIG(*) AS total FROM dbo.Users;')).recordset[0].total;
  transaction = new sql.Transaction(pool);
  await transaction.begin();
  repository = createUserRepository({ request: async () => new sql.Request(transaction) });
  security = createAuthSecurity({ config, repository });
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/auth', createAuthRouter({ security }));
  app.use('/admin', createAdminRouter({ security }));
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (transaction) await transaction.rollback();
    const pool = await getPool();
    const result = await pool.request().input('email', sql.NVarChar(255), email)
      .query('SELECT COUNT_BIG(*) AS total, SUM(CASE WHEN Email=@email THEN 1 ELSE 0 END) AS testUsers FROM dbo.Users;');
    assert.equal(String(result.recordset[0].total), String(baseline));
    assert.equal(Number(result.recordset[0].testUsers ?? 0), 0);
  } finally { await closePool(); }
});

test('SQL: guest gets 401 and CSRF/Origin reject unsafe requests before creating an account', async () => {
  assert.equal((await send('/auth/me')).status, 401);
  assert.equal((await send('/admin/check')).status, 401);
  assert.equal((await send('/auth/register', { method: 'POST', body: { fullName: 'Kiểm thử', email, password } })).status, 403);
  assert.equal((await mutate('/auth/register', { fullName: 'Kiểm thử', email, password }, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal(await repository.findByEmail(email), null);
});

test('SQL: register rejects role injection and stores an HMAC+bcrypt hash as User without signing in', async () => {
  assert.equal((await mutate('/auth/register', { fullName: 'Kiểm thử', email, password, role: 'Admin' })).status, 400);
  const result = await mutate('/auth/register', { fullName: '  Người  kiểm thử ', email: email.toUpperCase(), password });
  assert.equal(result.status, 201);
  registered = result.body.data;
  assert.equal(registered.email, email);
  assert.equal(registered.fullName, 'Người kiểm thử');
  assert.equal(registered.role, 'User');
  assert.equal('passwordHash' in registered, false);
  assert.equal('token' in result.body, false);
  assert.equal(jar.has(config.cookieName), false);
  assert.equal((await send('/auth/me')).status, 401);
  const stored = await repository.findByEmail(email);
  assert.ok(stored.passwordHash.startsWith(PASSWORD_HASH_PREFIX));
  assert.notEqual(stored.passwordHash, password);
  assert.equal(stored.role, 'User');
  assert.equal(await verifyPassword(password, stored.passwordHash, config.passwordPepper), true);
  assert.equal(await verifyPassword(`${password.slice(0, -1)}x`, stored.passwordHash, config.passwordPepper), false);
});

test('SQL: duplicate409, wrong password401, login cookie and me safe DTO', async () => {
  assert.equal((await mutate('/auth/register', { fullName: 'Người kiểm thử', email, password })).status, 409);
  const wrong = await mutate('/auth/login', { email, password: `${password}x` });
  assert.equal(wrong.status, 401);
  const result = await mutate('/auth/login', { email, password });
  assert.equal(result.status, 200);
  assert.ok(result.headers.getSetCookie().some((value) => value.includes(`${config.cookieName}=`) && /HttpOnly/iu.test(value) && /SameSite=Lax/iu.test(value)));
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.body.data.userId, registered.userId);
  assert.equal('passwordHash' in result.body.data, false);
  const me = await send('/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.userId, registered.userId);
  assert.equal('passwordHash' in me.body.data, false);
  assert.equal((await send('/admin/check')).status, 403);
});

test('SQL: profile only changes owner fullName/phone and cannot elevate privileges', async () => {
  for (const body of [{ role: 'Admin' }, { email: 'other@example.test' }, { userId: registered.userId + 1 }, { avatar: 'https://x.example' }, {}]) {
    assert.equal((await mutate('/auth/profile', body, { method: 'PATCH' })).status, 400);
  }
  const updated = await mutate('/auth/profile', { fullName: 'Hồ sơ đã sửa', phone: '+84 912 345 678' }, { method: 'PATCH' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.fullName, 'Hồ sơ đã sửa');
  assert.equal(updated.body.data.phone, '+84 912 345 678');
  const stored = await repository.findByEmail(email);
  assert.equal(stored.role, 'User');
  assert.equal(stored.email, email);
  assert.equal(stored.fullName, 'Hồ sơ đã sửa');
  assert.equal((await send('/admin/check')).status, 403);
});

test('SQL: injection-like values are bound as data and cannot read another account or run SQL', async () => {
  assert.equal(await repository.findByEmail("' OR 1=1;--"), null);
  const attempt = await mutate('/auth/login', { email: "test'OR'1'='1@example.test", password });
  assert.equal(attempt.status, 401);
  const name = "Hồ sơ '; DROP TABLE dbo.Users;--";
  const result = await mutate('/auth/profile', { fullName: name }, { method: 'PATCH' });
  assert.equal(result.status, 200);
  assert.equal((await repository.findByEmail(email)).fullName, name);
  assert.equal((await repository.findById(registered.userId)).role, 'User');
  assert.equal((await mutate('/auth/profile', { fullName: 'Hồ sơ đã sửa' }, { method: 'PATCH' })).status, 200);
});

test('SQL: logout revokes old JWT/CSRF; captured cookie replay cannot restore a session', async () => {
  const old = new Map(jar);
  const oldCsrf = (await send('/auth/csrf')).body.csrfToken;
  assert.equal((await mutate('/auth/logout', {})).status, 200);
  assert.equal(jar.has(config.cookieName), false);
  assert.equal(security.sessionStore.size, 0);
  assert.equal((await send('/auth/me', { cookies: old })).status, 401);
  assert.equal((await send('/auth/profile', { method: 'PATCH', body: { fullName: 'Không được sửa' }, cookies: old, headers: { 'X-CSRF-Token': oldCsrf } })).status, 403);
  assert.equal((await mutate('/auth/logout', {})).status, 200);
  assert.equal((await repository.findByEmail(email)).fullName, 'Hồ sơ đã sửa');
});
