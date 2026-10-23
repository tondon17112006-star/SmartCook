import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getAuthConfig } from '../src/config/auth.js';
import {
  validateRegister, validateLogin, validateProfile, normalizeEmail,
} from '../src/utilities/auth-validation.js';
import { hashPassword, verifyPassword, PASSWORD_HASH_PREFIX } from '../src/utilities/passwords.js';
import { createSessionStore, createCsrfStore } from '../src/utilities/session-store.js';
import { createAuthRateLimiter } from '../src/utilities/rate-limit.js';
import { createAuthSecurity } from '../src/utilities/auth-security.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createAdminRouter } from '../src/routes/admin.routes.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

// Test-only credentials and random ephemeral keys never touch SQL or .env.
const password = 'A long test passphrase 123!';
const origin = 'http://localhost:5173';
const source = {
  JWT_SECRET: randomBytes(48).toString('base64'),
  PASSWORD_PEPPER: randomBytes(48).toString('base64'),
  CLIENT_ORIGIN: origin,
};
const config = getAuthConfig(source);
const storedHash = await hashPassword(password, config.passwordPepper);
const isHttpError = (status) => (error) => error.status === status;

async function fixture({ secure = false } = {}) {
  let clock = Date.now();
  const now = () => clock;
  const settings = secure ? getAuthConfig({ ...source, AUTH_COOKIE_SECURE: 'true' }) : config;
  const users = new Map();
  let nextId = 1;
  const safe = (user) => user && Object.fromEntries(Object.entries(user).filter(([key]) => key !== 'passwordHash'));
  const repository = {
    async findByEmail(email) { return [...users.values()].find((user) => user.email === email) ?? null; },
    async findById(id) { return safe(users.get(id)) ?? null; },
    async createUser(data) {
      if (await this.findByEmail(data.email)) throw Object.assign(new Error('unique index'), { number: 2627 });
      const user = { ...data, userId: nextId++, role: 'User', phone: null, avatar: null, createdAt: new Date(clock).toISOString() };
      users.set(user.userId, user);
      return safe(user);
    },
    async updateProfile(id, changes) {
      const user = users.get(id);
      return user ? safe(Object.assign(user, changes)) : null;
    },
  };
  const sessionStore = createSessionStore({ ...settings, now });
  const csrfStore = createCsrfStore({ ...settings, now });
  const security = createAuthSecurity({ config: settings, repository, sessionStore, csrfStore, now });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ security }));
  app.use('/api/admin', createAdminRouter({ security }));
  app.use(errorHandler);
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const cookies = new Map();
  let csrfToken;
  async function request(path, { method = 'GET', body, headers = {}, cookie } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Cookie: cookie ?? [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = response.headers.getSetCookie();
    for (const entry of setCookies) {
      const pair = entry.split(';')[0];
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: response.status, body: await response.json(), headers: response.headers, setCookies };
  }
  async function csrf() {
    const result = await request('/api/auth/csrf');
    assert.equal(result.status, 200);
    csrfToken = result.body.csrfToken;
    return result;
  }
  function seed(email = 'user@example.com') {
    const user = { userId: nextId++, fullName: 'Test User', email, passwordHash: storedHash, role: 'User', phone: null, avatar: null, createdAt: new Date(clock).toISOString() };
    users.set(user.userId, user);
    return user;
  }
  async function login(email = 'user@example.com') {
    await csrf();
    return request('/api/auth/login', { method: 'POST', body: { email, password } });
  }
  return {
    security, repository, users, settings, cookies, request, csrf, seed, login,
    advance(ms) { clock += ms; },
    get time() { return clock; },
    get csrfToken() { return csrfToken; },
    async close() { await new Promise((resolve) => listener.close(resolve)); },
  };
}

test('auth config rejects missing, weak, equal or placeholder keys', () => {
  for (const input of [
    {}, { ...source, JWT_SECRET: 'a'.repeat(64) },
    { ...source, PASSWORD_PEPPER: source.JWT_SECRET },
    { ...source, JWT_SECRET: 'replace-this-with-your-secret-placeholder-1234567890' },
  ]) assert.throws(() => getAuthConfig(input));
});

test('auth config uses short sessions and strict production cookie/origin defaults', () => {
  assert.equal(config.sessionTtlSeconds, 900);
  assert.equal(config.cookieName, 'smartcook_session');
  const secure = getAuthConfig({ ...source, NODE_ENV: 'production', CLIENT_ORIGIN: 'https://smartcook.example' });
  assert.equal(secure.cookieName, '__Host-smartcook_session');
  assert.equal(secure.secureCookie, true);
  assert.throws(() => getAuthConfig({ ...source, NODE_ENV: 'production' }));
  assert.throws(() => getAuthConfig({ ...source, NODE_ENV: 'production', AUTH_COOKIE_SECURE: 'false' }));
  for (const CLIENT_ORIGIN of ['*', 'null', `${origin}/`, `${origin}/path`, 'javascript:alert(1)']) {
    assert.throws(() => getAuthConfig({ ...source, CLIENT_ORIGIN }));
  }
});

test('registration normalizes full name/email and preserves exact passphrase', () => {
  const input = validateRegister({ fullName: '  Nguy\u1ec5n   V\u0103n A  ', email: ' User@Example.COM ', password: ` ${password} ` });
  assert.equal(input.fullName, 'Nguy\u1ec5n V\u0103n A');
  assert.equal(input.email, 'user@example.com');
  assert.equal(input.password, ` ${password} `);
});

test('auth validation rejects overposting, malformed identity and unsafe length', () => {
  const valid = { fullName: 'Test User', email: 'user@example.com', password };
  for (const body of [null, [], {}, { ...valid, role: 'Admin' }, { ...valid, userId: 1 }, { ...valid, fullName: '<script>' }, { ...valid, fullName: '\u200bhidden' }, { ...valid, password: 'short' }, { ...valid, password: 'x'.repeat(1025) }, { ...valid, password: `${password}\0` }]) {
    assert.throws(() => validateRegister(body), isHttpError(400));
  }
  for (const email of ['bad', 'a..b@example.com', '.a@example.com', 'a.@example.com', 'a@localhost', 'a@example.com\r\nx:1']) {
    assert.throws(() => normalizeEmail(email), isHttpError(400));
  }
  assert.throws(() => validateLogin({ email: valid.email, password, role: 'Admin' }), isHttpError(400));
});

test('profile validation allows only own editable fields with nullable phone', () => {
  assert.deepEqual(validateProfile({ phone: '' }), { phone: null });
  assert.deepEqual(validateProfile({ fullName: '  Test   User ', phone: '+84 123 456 789' }), { fullName: 'Test User', phone: '+84 123 456 789' });
  for (const body of [{}, { role: 'Admin' }, { userId: 2 }, { email: 'other@example.com' }, { avatar: 'javascript:alert(1)' }, { phone: 'abc' }]) {
    assert.throws(() => validateProfile(body), isHttpError(400));
  }
});

test('HMAC+bcrypt stores versioned salted hashes and verifies with the same pepper only', async () => {
  assert.ok(storedHash.startsWith(PASSWORD_HASH_PREFIX));
  assert.ok(storedHash.length < 255);
  assert.equal(await verifyPassword(password, storedHash, config.passwordPepper), true);
  assert.equal(await verifyPassword(`${password}wrong`, storedHash, config.passwordPepper), false);
  assert.equal(await verifyPassword(password, storedHash, randomBytes(48).toString('base64')), false);
  assert.equal(await verifyPassword(password, '$2b$12$invalid', config.passwordPepper), false);
  assert.equal(await verifyPassword(password, null, config.passwordPepper), false);
  const second = await hashPassword(password, config.passwordPepper);
  assert.notEqual(second, storedHash);
});

test('HMAC preprocessing preserves differences after bcrypt 72-byte cutoff and Unicode', async () => {
  const common = '\u1ebf'.repeat(80);
  const hash = await hashPassword(`${common}A`, config.passwordPepper);
  assert.equal(await verifyPassword(`${common}A`, hash, config.passwordPepper), true);
  assert.equal(await verifyPassword(`${common}B`, hash, config.passwordPepper), false);
  assert.equal(await verifyPassword(`${common}A `, hash, config.passwordPepper), false);
});

test('session store bounds capacity, returns copies, expires and revokes sessions', () => {
  let time = 1000;
  const store = createSessionStore({ sessionTtlSeconds: 1, maxSessions: 1, now: () => time });
  const record = store.create(7);
  record.userId = 9;
  assert.equal(store.get(record.jti).userId, 7);
  assert.throws(() => store.create(8), isHttpError(503));
  time += 1000;
  assert.equal(store.get(record.jti), null);
  assert.equal(store.size, 0);
  const next = store.create(8);
  store.revoke(next.jti);
  assert.equal(store.get(next.jti), null);
});

test('CSRF store is bounded, binds session, expires and does not expose mutable records', () => {
  let time = 1000;
  const store = createCsrfStore({ csrfTtlSeconds: 1, maxCsrfRecords: 1, now: () => time });
  const record = store.create('session');
  const original = record.token;
  record.token = 'tampered';
  assert.equal(store.get(record.nonce).token, original);
  assert.equal(store.get(record.nonce).sessionId, 'session');
  assert.throws(() => store.create(), isHttpError(503));
  time += 1000;
  assert.equal(store.get(record.nonce), null);
  assert.equal(store.size, 0);
  const next = store.create();
  store.revoke(next.nonce);
  assert.equal(store.size, 0);
});

test('rate limiter caps attempts, ignores forwarded IP, recovers after window and fails closed at capacity', () => {
  let time = 1000;
  const limiter = createAuthRateLimiter({ maxRateRecords: 1, loginLimit: 2, loginWindowMs: 1000, now: () => time });
  const headers = {};
  const res = { set(name, value) { headers[name] = value; } };
  const errors = [];
  const call = (ip = '127.0.0.1') => limiter.middleware('login')({ ip, headers: { 'x-forwarded-for': randomBytes(8).toString('hex') } }, res, (error) => errors.push(error));
  call(); call(); call();
  assert.equal(errors[0], undefined);
  assert.equal(errors[1], undefined);
  assert.equal(errors[2].status, 429);
  assert.equal(headers['Retry-After'], '1');
  call('127.0.0.2');
  assert.equal(errors[3].status, 429);
  assert.equal(limiter.size, 1);
  time += 1000;
  call('127.0.0.2');
  assert.equal(errors[4], undefined);
  assert.throws(() => limiter.middleware('other'));
});

test('registration validates, hashes, defaults User, never logs in and safely rejects duplicates', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  await f.csrf();
  const result = await f.request('/api/auth/register', { method: 'POST', body: { fullName: ' Test   User ', email: ' User@Example.com ', password } });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.role, 'User');
  assert.equal(result.body.data.fullName, 'Test User');
  assert.equal(result.body.data.email, 'user@example.com');
  assert.equal(JSON.stringify(result.body).includes('password'), false);
  const row = f.users.get(result.body.data.userId);
  assert.notEqual(row.passwordHash, password);
  assert.equal(await verifyPassword(password, row.passwordHash, config.passwordPepper), true);
  assert.equal((await f.request('/api/auth/me')).status, 401);
  assert.equal((await f.request('/api/auth/register', { method: 'POST', body: { fullName: 'Test User', email: 'user@example.com', password } })).status, 409);
  assert.equal(f.users.size, 1);
});

test('registration/profile reject self-assigned Admin and unexpected fields through HTTP', async (t) => {
  const f = await fixture(); t.after(() => f.close());
  f.seed(); await f.csrf();
  assert.equal((await f.request('/api/auth/register', { method: 'POST', body: { fullName: 'Test User', email: 'new@example.com', password, role: 'Admin' } })).status, 400);
  assert.equal((await f.login()).status, 200); await f.csrf();
  for (const body of [{ role: 'Admin' }, { userId: 2 }, { email: 'other@example.com' }]) {
    assert.equal((await f.request('/api/auth/profile', { method: 'PATCH', body })).status, 400);
  }
  assert.equal(f.users.get(1).role, 'User');
});

test('login failure is generic for wrong password and unknown email; valid login returns safe user', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.csrf();
  const wrong = await f.request('/api/auth/login', { method: 'POST', body: { email: 'user@example.com', password: 'A wrong test passphrase' } });
  const unknown = await f.request('/api/auth/login', { method: 'POST', body: { email: 'absent@example.com', password } });
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
  const login = await f.login(); assert.equal(login.status, 200);
  assert.equal(JSON.stringify(login.body).includes('password'), false);
  assert.equal(JSON.stringify(login.body).includes('token'), false);
  const token = jwt.decode(f.cookies.get(f.settings.cookieName));
  assert.deepEqual(Object.keys(token).sort(), ['aud', 'exp', 'iat', 'iss', 'jti', 'sub']);
  assert.equal(token.exp - token.iat, 900);
});

test('me restores a cookie session and current database role controls Admin on every request', async (t) => {
  const f = await fixture(); t.after(() => f.close()); const user = f.seed();
  assert.equal((await f.request('/api/auth/me')).status, 401);
  await f.login();
  assert.equal((await f.request('/api/auth/me')).body.data.userId, user.userId);
  assert.equal((await f.request('/api/admin/check')).status, 403);
  // Controlled memory repository only: no SQL account is created/promoted.
  user.role = 'Admin'; assert.equal((await f.request('/api/admin/check')).status, 200);
  user.role = 'User'; assert.equal((await f.request('/api/admin/check')).status, 403);
  f.users.delete(user.userId); assert.equal((await f.request('/api/auth/me')).status, 401);
  assert.equal(f.security.sessionStore.size, 0);
});

test('JWT rejects bad signature, HS384/none, issuer/audience, missing expiry and noncanonical subject', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.login();
  const original = f.cookies.get(f.settings.cookieName);
  const claims = jwt.decode(original);
  const wrongKey = randomBytes(48).toString('base64');
  const withoutExpiry = { ...claims };
  delete withoutExpiry.exp;
  const invalid = [
    jwt.sign(claims, wrongKey, { algorithm: 'HS256' }),
    jwt.sign(claims, config.jwtSecret, { algorithm: 'HS384' }),
    jwt.sign(claims, null, { algorithm: 'none' }),
    jwt.sign({ ...claims, iss: 'wrong' }, config.jwtSecret),
    jwt.sign({ ...claims, aud: ['smartcook-web'] }, config.jwtSecret),
    jwt.sign({ ...claims, sub: '01' }, config.jwtSecret),
    jwt.sign(withoutExpiry, config.jwtSecret),
    'not-a-jwt',
  ];
  for (const value of invalid) {
    f.cookies.set(f.settings.cookieName, value);
    assert.equal((await f.request('/api/auth/me')).status, 401);
  }
  f.cookies.set(f.settings.cookieName, original);
  assert.equal((await f.request('/api/auth/me')).status, 200);
});

test('JWT expiry rejects an otherwise active session and expired signed logout revokes it', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.login();
  const claims = jwt.decode(f.cookies.get(f.settings.cookieName));
  const expired = jwt.sign({ ...claims, iat: Math.floor(f.time / 1000) - 60, exp: Math.floor(f.time / 1000) - 1 }, config.jwtSecret);
  assert.equal(f.security.sessionStore.size, 1);
  f.cookies.set(f.settings.cookieName, expired);
  assert.equal((await f.request('/api/auth/me')).status, 401);
  await f.csrf();
  assert.equal((await f.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal(f.security.sessionStore.size, 0);
});

test('JWT forged role claim cannot grant Admin, and malformed/duplicate cookies fail closed', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.login();
  const token = f.cookies.get(f.settings.cookieName);
  const claims = jwt.decode(token);
  f.cookies.set(f.settings.cookieName, jwt.sign({ ...claims, role: 'Admin' }, config.jwtSecret));
  assert.equal((await f.request('/api/admin/check')).status, 403);
  assert.equal((await f.request('/api/auth/me', { cookie: `${f.settings.cookieName}=${token}; ${f.settings.cookieName}=${token}` })).status, 400);
  assert.equal((await f.request('/api/auth/me', { cookie: `${f.settings.cookieName}=%ZZ` })).status, 400);
});

test('CSRF GET reuses a valid token, rotates after login, and rejects pre-auth token reuse', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed();
  const first = await f.csrf(); const token = f.csrfToken;
  const second = await f.csrf(); assert.equal(f.csrfToken, token);
  assert.equal(second.setCookies.length, 0);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  await f.login();
  assert.equal((await f.request('/api/auth/profile', { method: 'PATCH', body: { fullName: 'Updated User' } })).status, 403);
  await f.csrf(); assert.notEqual(f.csrfToken, token);
  assert.equal((await f.request('/api/auth/profile', { method: 'PATCH', body: { fullName: 'Updated User', phone: '+84 123 456 789' } })).status, 200);
});

test('CSRF rejects missing/wrong token, foreign/missing Origin and non-JSON unsafe requests', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.csrf();
  const body = { email: 'user@example.com', password };
  for (const headers of [
    { 'X-CSRF-Token': '' }, { 'X-CSRF-Token': '0'.repeat(64) },
    { Origin: 'https://evil.example' }, { Origin: '' }, { Origin: 'null' },
  ]) assert.equal((await f.request('/api/auth/login', { method: 'POST', body, headers })).status, 403);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body, headers: { 'Content-Type': 'text/plain' } })).status, 400);
  assert.equal((await f.request('/api/auth/csrf', { headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('CSRF expiration requires a renewed token and an invalid token never changes profile', async (t) => {
  const f = await fixture(); t.after(() => f.close()); const user = f.seed(); await f.login(); await f.csrf();
  f.advance(901_000);
  assert.equal((await f.request('/api/auth/profile', { method: 'PATCH', body: { fullName: 'Unexpected' } })).status, 403);
  assert.equal(user.fullName, 'Test User');
  const previous = f.csrfToken; await f.csrf(); assert.notEqual(f.csrfToken, previous);
  assert.equal((await f.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
});

test('logout revokes server session so replay of captured cookie fails and repeat logout is safe', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.login(); await f.csrf();
  const captured = [...f.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  const logout = await f.request('/api/auth/logout', { method: 'POST', body: {} });
  assert.equal(logout.status, 200); assert.equal(f.security.sessionStore.size, 0);
  assert.equal(logout.setCookies.length, 2);
  assert.equal((await f.request('/api/auth/me', { cookie: captured })).status, 401);
  await f.csrf();
  assert.equal((await f.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
});

test('relogin rotates jti and revokes the previously captured session', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.login();
  const captured = `${f.settings.cookieName}=${f.cookies.get(f.settings.cookieName)}`;
  await f.login();
  assert.equal(f.security.sessionStore.size, 1);
  assert.equal((await f.request('/api/auth/me', { cookie: captured })).status, 401);
  assert.equal((await f.request('/api/auth/me')).status, 200);
});

test('server restart invalidates a valid JWT by losing its active session record', async (t) => {
  const f = await fixture(); t.after(() => f.close()); f.seed(); await f.login();
  const req = { headers: { cookie: `${f.settings.cookieName}=${f.cookies.get(f.settings.cookieName)}` } };
  assert.ok(f.security.readSession(req));
  const restarted = createAuthSecurity({ config: f.settings, repository: f.repository });
  assert.equal(restarted.readSession(req), null);
});

test('HttpOnly session cookies use Lax/host scope and HTTPS cookies have __Host prefix', async (t) => {
  for (const secure of [false, true]) {
    const f = await fixture({ secure }); t.after(() => f.close()); f.seed();
    const login = await f.login();
    const sessionCookie = login.setCookies.find((entry) => entry.startsWith(`${f.settings.cookieName}=`));
    assert.match(sessionCookie, /HttpOnly/iu); assert.match(sessionCookie, /SameSite=Lax/iu);
    assert.match(sessionCookie, /Path=\//iu); assert.doesNotMatch(sessionCookie, /Domain=|Max-Age=/iu);
    if (secure) { assert.match(sessionCookie, /; Secure/iu); assert.ok(f.settings.cookieName.startsWith('__Host-')); }
    else assert.doesNotMatch(sessionCookie, /; Secure/iu);
  }
});

test('HTTP login rate limiting includes malformed credentials and returns Retry-After', async (t) => {
  const f = await fixture(); t.after(() => f.close()); await f.csrf();
  for (let index = 0; index < 10; index += 1) {
    assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { email: 'invalid', password: 'short' } })).status, 400);
  }
  const blocked = await f.request('/api/auth/login', { method: 'POST', body: { email: 'invalid', password: 'short' } });
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});
