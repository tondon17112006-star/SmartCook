import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import express from 'express';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { HttpError } from '../src/utilities/http-error.js';

const secret = 'Password=do-not-log-this;Server=private-sql;SELECT sensitive_column FROM private_table';
const errorCases = new Map([
  ['validation', { error: new HttpError(400, 'page phải là số nguyên dương.'), status: 400 }],
  ['not-found', { error: new HttpError(404, 'Không tìm thấy món ăn.'), status: 404 }],
  ['unexpected', { error: new Error(secret), status: 500 }],
  ['sql-request', { error: Object.assign(new Error(secret), { code: 'EREQUEST', number: 208 }), status: 500 }],
  ['sql-login', { error: Object.assign(new Error(secret), { code: 'ELOGIN' }), status: 503 }],
  ['sql-socket', { error: Object.assign(new Error(secret), { code: 'ESOCKET' }), status: 503 }],
  ['sql-closed', { error: Object.assign(new Error(secret), { code: 'ECONNCLOSED' }), status: 503 }],
  ['sql-not-open', { error: Object.assign(new Error(secret), { code: 'ENOTOPEN' }), status: 503 }],
  ['sql-no-connection', { error: Object.assign(new Error(secret), { code: 'ENOCONN' }), status: 503 }],
  ['sql-instance', { error: Object.assign(new Error(secret), { code: 'EINSTLOOKUP' }), status: 503 }],
  ['sql-connection', { error: Object.assign(new Error(secret), { name: 'ConnectionError' }), status: 503 }],
  ['sql-timeout', { error: Object.assign(new Error(secret), { code: 'ETIMEOUT' }), status: 504 }],
  ['native-timeout', { error: Object.assign(new Error(secret), { code: 'EREQUEST', state: 'HYT00' }), status: 504 }],
  ['native-login-timeout', { error: Object.assign(new Error(secret), { code: 'EREQUEST', state: 'HYT01' }), status: 504 }],
  ['native-nested-timeout', { error: Object.assign(new Error(secret), { code: 'EREQUEST', originalError: { sqlstate: 'HYT00', message: secret } }), status: 504 }],
  ['native-preceding-timeout', { error: Object.assign(new Error(secret), { code: 'EREQUEST', precedingErrors: [{ state: 'HYT00', message: secret }] }), status: 504 }],
  ['native-connection', { error: Object.assign(new Error(secret), { code: 'EREQUEST', state: '08S01' }), status: 503 }],
  ['native-syntax', { error: Object.assign(new Error(secret), { code: 'EREQUEST', state: '42000' }), status: 500 }],
]);

let server;
let baseUrl;

before(async () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.get('/error/:name', (req) => {
    throw errorCases.get(req.params.name).error;
  });
  testApp.post('/body', (_req, res) => res.json({ ok: true }));
  testApp.use(errorHandler);
  server = testApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('error middleware returns safe 400/404/500/503/504 JSON and redacts SQL errors in responses and logs', async (context) => {
  for (const [name, { status }] of errorCases) {
    await context.test(name, async (subcontext) => {
      const log = subcontext.mock.method(console, 'error', () => {});
      const response = await fetch(`${baseUrl}/error/${name}`, { signal: AbortSignal.timeout(5_000) });
      assert.equal(response.status, status);
      assert.match(response.headers.get('content-type') || '', /application\/json/);
      const body = await response.json();
      assert.deepEqual(Object.keys(body), ['message']);
      assert.equal(typeof body.message, 'string');
      assert.ok(body.message.length > 0);
      assert.equal(JSON.stringify(body).includes(secret), false);
      assert.equal(inspect(log.mock.calls, { depth: 10 }).includes(secret), false);
      if (status >= 500) {
        assert.doesNotMatch(body.message, /password|select |private-sql|stack|EREQUEST/i);
      }
    });
  }
});

test('malformed JSON returns HTTP 400 without echoing the submitted body', async () => {
  const response = await fetch(`${baseUrl}/body`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: `{"password":"${secret}",`,
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(typeof body.message, 'string');
  assert.equal(JSON.stringify(body).includes(secret), false);
});

test('middleware forwards errors after HTTP headers have already been sent', () => {
  const error = new Error(secret);
  let forwarded;
  errorHandler(error, {}, { headersSent: true }, (value) => { forwarded = value; });
  assert.equal(forwarded, error);
});
