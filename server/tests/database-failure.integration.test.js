import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('health stays available and database errors return safe HTTP 503 when database is unavailable', { timeout: 20_000 }, async () => {
  const unavailableName = `SmartCook_Failure_${randomUUID().replaceAll('-', '')}`;
  const probe = `
    import { app } from './src/app.js';
    import { closePool } from './src/config/database.js';
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve); server.once('error', reject);
    });
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const results = [];
      for (const path of ['/api/health', '/api/categories', '/api/health']) {
        const response = await fetch(base + path, {signal: AbortSignal.timeout(10_000)});
        results.push({status: response.status, body: await response.json()});
      }
      console.log(JSON.stringify(results));
    } finally {
      await new Promise(resolve => server.close(resolve));
      await closePool();
    }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', probe], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DB_NAME: unavailableName, DB_CONNECTION_TIMEOUT: '2000' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  // Consume stderr; production-style safe logging is separately asserted in unit tests.
  child.stderr.resume();
  const timer = setTimeout(() => child.kill(), 15_000);
  try {
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    assert.equal(exitCode, 0, 'Isolated database failure probe must exit cleanly.');
    const results = JSON.parse(output.trim());
    assert.deepEqual(results.map((result) => result.status), [200, 503, 200]);
    assert.equal(results[0].body.status, 'ok');
    assert.equal(results[2].body.status, 'ok');
    assert.equal(typeof results[1].body.message, 'string');
    assert.deepEqual(Object.keys(results[1].body), ['message']);
    assert.equal(output.includes(unavailableName), false);
    assert.doesNotMatch(results[1].body.message, /stack|password|driver=|select |login failed/i);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill();
  }
});
