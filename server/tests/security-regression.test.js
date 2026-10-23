import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import { validatePassword } from '../src/utilities/auth-validation.js';
import { hashPassword, verifyPassword } from '../src/utilities/passwords.js';

const origin = 'http://localhost:5173';
const protectedEnv = ['NODE_ENV', 'AUTH_COOKIE_SECURE', 'CLIENT_ORIGIN', 'JWT_SECRET', 'PASSWORD_PEPPER'];
const originalEnv = new Map(protectedEnv.map((key) => [key, process.env[key]]));
let server, base;

before(async () => {
  // The Node test runner isolates this file in its own process. These ephemeral
  // keys never change .env or any running server; every path below avoids SQL.
  process.env.NODE_ENV = 'test';
  process.env.AUTH_COOKIE_SECURE = 'false';
  process.env.CLIENT_ORIGIN = origin;
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.PASSWORD_PEPPER = randomBytes(48).toString('hex');
  const { app } = await import('../src/app.js');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } finally {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

function request(path, options = {}) { return fetch(`${base}${path}`, { signal: AbortSignal.timeout(5_000), ...options }); }
function headers(response) {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-powered-by'), null);
}
async function safeJson(response, expectedStatus, privateMarker = '') {
  assert.equal(response.status, expectedStatus); headers(response);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json; charset=utf-8/iu);
  const body = await response.json();
  if (expectedStatus >= 400) {
    assert.deepEqual(Object.keys(body), ['message']);
    assert.equal(typeof body.message, 'string'); assert.ok(body.message.length > 0);
    assert.doesNotMatch(body.message, /stack|EREQUEST|Driver=|PasswordHash|JWT_SECRET|PASSWORD_PEPPER/iu);
  }
  if (privateMarker) assert.equal(JSON.stringify(body).includes(privateMarker), false);
  return body;
}
async function csrf() {
  const response = await request('/api/auth/csrf', { headers: { Origin: origin } });
  const body = await safeJson(response, 200);
  const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  return { Origin: origin, Cookie: cookie, 'X-CSRF-Token': body.csrfToken, 'Content-Type': 'application/json' };
}

test('security headers cover successful JSON health responses without framework disclosure', async () => {
  const body = await safeJson(await request('/api/health', { headers: { Accept: 'text/html' } }), 200);
  assert.equal(body.status, 'ok'); assert.equal(body.service, 'SmartCook API');
  assert.equal(typeof body.timestamp, 'string');
});

test('security headers and safe JSON cover unknown routes without reflecting path input', async () => {
  const marker = 'private-token-must-not-echo';
  await safeJson(await request(`/api/${marker}/%3Cscript%3E`), 404, marker);
});

test('Guest and invalid-cookie requests across private API groups fail closed before SQL with no-store', async () => {
  for (const path of ['/api/auth/me', '/api/favorites', '/api/pantry', '/api/admin/dashboard', '/api/admin/users', '/api/recipes/1/reviews/mine']) {
    const response = await request(path, { headers: { Cookie: 'smartcook_session=not-a-valid-jwt' } });
    await safeJson(response, 401); assert.match(response.headers.get('cache-control'), /no-store/u);
  }
});

test('credentialed CORS accepts only exact origin and retains security headers on preflight', async () => {
  const response = await request('/api/health', { headers: { Origin: origin } });
  await safeJson(response, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('vary'), /Origin/u);
  const preflight = await request('/api/admin/recipes/1', { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type,x-csrf-token',
  } });
  assert.equal(preflight.status, 204); headers(preflight);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.match(preflight.headers.get('access-control-allow-headers'), /x-csrf-token/u);
});

test('CORS rejects null, lookalike, wrong scheme/port and foreign origins without reflecting them', async () => {
  for (const foreign of ['null', 'https://evil.example', 'http://localhost:5173.evil.example', 'https://localhost:5173', 'http://localhost:5174']) {
    const response = await request('/api/auth/csrf', { headers: { Origin: foreign } });
    await safeJson(response, 403, foreign);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
    assert.match(response.headers.get('cache-control'), /no-store/u);
  }
});

test('malformed JSON and oversized JSON return safe400/413 before auth, retaining no-store and security headers', async () => {
  const marker = 'private-credential-body-marker';
  const malformed = await request('/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: `{"password":"${marker}",` });
  await safeJson(malformed, 400, marker);
  assert.match(malformed.headers.get('cache-control'), /no-store/u);
  const oversized = await request('/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: marker + 'x'.repeat(103_000) }) });
  await safeJson(oversized, 413, marker);
  assert.match(oversized.headers.get('cache-control'), /no-store/u);
});

test('mounted auth refuses privilege overposting and missing Origin without database writes', async () => {
  const authHeaders = await csrf();
  const body = JSON.stringify({ fullName: 'Người kiểm thử', email: 'never-written@example.test', password: 'Only a synthetic test passphrase!', role: 'Admin' });
  await safeJson(await request('/api/auth/register', { method: 'POST', headers: authHeaders, body }), 400);
  const withoutOrigin = { ...authHeaders }; delete withoutOrigin.Origin;
  await safeJson(await request('/api/auth/register', { method: 'POST', headers: withoutOrigin, body }), 403);
  // CSRF is valid, so authentication itself determines the anonymous profile status.
  await safeJson(await request('/api/auth/profile', { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ fullName: 'Tên mới' }) }), 401);
});

test('public API rejects malformed IDs, pagination, sort and suggestion payloads with safe400 before SQL', async () => {
  for (const path of ['/api/recipes/01', '/api/recipes/1%20OR%201%3D1', '/api/ingredients?limit=101', '/api/ingredients?page=1&page=2', '/api/recipes?sort=RecipeID%3BDROP']) {
    await safeJson(await request(path), 400);
  }
  await safeJson(await request('/api/recipes/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ingredientIds: ['1 OR 1=1'] }) }), 400);
});

test('password validation rejects malformed UTF-16 before UTF-8 can create replacement-character aliases', () => {
  const prefix = 'Synthetic Unicode passphrase ';
  const replacement = prefix + '\uFFFD';
  for (const suffix of ['\uD800', '\uDC00', '\uD800x', '\uDC00\uD800']) {
    assert.throws(() => validatePassword(prefix + suffix), (error) => error.status === 400);
  }
  assert.notEqual(prefix + '\uD800', replacement);
  assert.deepEqual(Buffer.from(prefix + '\uD800', 'utf8'), Buffer.from(replacement, 'utf8'));
  for (const suffix of ['\uFFFD', '\uD83D\uDE42', 'tiếng Việt']) {
    const value = prefix + suffix;
    assert.equal(validatePassword(value), value);
  }
});

test('register and login return400 for lone high/low surrogate passwords before any repository call', async () => {
  const authHeaders = await csrf();
  for (const suffix of ['\uD800', '\uDC00']) {
    const credentials = { email: 'never-written@example.test', password: 'Synthetic passphrase ' + suffix };
    const register = await request('/api/auth/register', { method: 'POST', headers: authHeaders, body: JSON.stringify({ fullName: 'Người kiểm thử', ...credentials }) });
    await safeJson(register, 400);
    const login = await request('/api/auth/login', { method: 'POST', headers: authHeaders, body: JSON.stringify(credentials) });
    await safeJson(login, 400);
  }
});

test('well-formed emoji and literal U+FFFD keep distinct HMAC+bcrypt credentials without changing normalization', async () => {
  const pepper = randomBytes(48).toString('hex');
  const first = validatePassword('Synthetic Unicode passphrase \uD83D\uDE42');
  const second = validatePassword('Synthetic Unicode passphrase \uFFFD');
  const stored = await hashPassword(first, pepper);
  assert.equal(await verifyPassword(first, stored, pepper), true);
  assert.equal(await verifyPassword(second, stored, pepper), false);
  assert.equal(validatePassword('  Synthetic password  '), '  Synthetic password  ');
});
