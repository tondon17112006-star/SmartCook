import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const run = promisify(execFile);
async function probe(extraEnv, checks) {
  const source = `
    import assert from 'node:assert/strict';
    import { once } from 'node:events';
    import { app } from './src/app.js';
    const server = app.listen(0,'127.0.0.1');
    await once(server,'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    try { ${checks} }
    finally { await new Promise(resolve => server.close(resolve)); }
  `;
  const result = await run(process.execPath, ['--input-type=module', '-e', source], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), timeout: 15000,
    env: { ...process.env, NODE_ENV: 'test', AUTH_COOKIE_SECURE: 'false', CLIENT_ORIGIN: 'http://localhost:5173', ...extraEnv },
  });
  assert.equal(result.stderr, '');
}

test('app remains healthy with missing auth secrets while auth fails closed with safe503', async () => {
  await probe({ JWT_SECRET: '', PASSWORD_PEPPER: '' }, `
    assert.equal((await fetch(base+'/api/health')).status,200);
    const response = await fetch(base+'/api/auth/me');
    assert.equal(response.status,503);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match((await response.json()).message,/Xác thực chưa được cấu hình/u);
  `);
});

test('mounted auth routes allow exact credentialed CORS and preflight but reject foreign Origin', async () => {
  await probe({ JWT_SECRET: randomBytes(48).toString('hex'), PASSWORD_PEPPER: randomBytes(48).toString('hex') }, `
    const origin='http://localhost:5173';
    const response=await fetch(base+'/api/auth/csrf',{headers:{Origin:origin}});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('access-control-allow-origin'),origin);
    assert.equal(response.headers.get('access-control-allow-credentials'),'true');
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.ok((await response.json()).csrfToken);
    const preflight=await fetch(base+'/api/auth/profile',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'PATCH','Access-Control-Request-Headers':'content-type,x-csrf-token'}});
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');
    assert.match(preflight.headers.get('access-control-allow-headers'),/x-csrf-token/u);
    assert.equal((await fetch(base+'/api/auth/me')).status,401);
    assert.equal((await fetch(base+'/api/admin/check')).status,401);
    const denied=await fetch(base+'/api/auth/csrf',{headers:{Origin:'https://evil.example'}});
    assert.equal(denied.status,403);
    assert.equal(denied.headers.get('cache-control'),'no-store');
    const malformed=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{'});
    assert.equal(malformed.status,400);
    assert.equal(malformed.headers.get('cache-control'),'no-store');
    assert.equal((await fetch(base+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403);
  `);
});
