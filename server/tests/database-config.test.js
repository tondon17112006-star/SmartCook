import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDatabaseConfig } from '../src/utilities/database-config.js';

const isInvalidConfig = (error) => error.code === 'EDBCONFIG';

test('database defaults use Windows identity, encrypted local SQL Server and bounded pooling', () => {
  const config = buildDatabaseConfig({});
  assert.equal(config.server, 'lpc:localhost');
  assert.equal(config.database, 'SmartCookDB');
  assert.equal(config.driver, 'SQL Server Native Client 11.0');
  assert.deepEqual(config.options, {
    trustedConnection: true, useUTC: true, encrypt: true, trustServerCertificate: false,
  });
  assert.equal(config.pool.max, 10);
  assert.equal(config.pool.min, 0);
  assert.match(config.connectionString, /Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=No;/);
  assert.doesNotMatch(config.connectionString, /UID=|PWD=|Password=/i);
});

test('production defaults use a supported modern driver and retain certificate verification', () => {
  const config = buildDatabaseConfig({ NODE_ENV: 'production', DB_SERVER: 'sql.example.internal' });
  assert.equal(config.driver, 'ODBC Driver 18 for SQL Server');
  assert.equal(config.options.encrypt, true);
  assert.equal(config.options.trustServerCertificate, false);
  assert.match(config.connectionString, /Server=\{sql\.example\.internal\}/);
});

test('production rejects TLS bypasses, shared memory and the legacy native driver', () => {
  for (const unsafe of [
    { DB_ENCRYPT: 'false' },
    { DB_TRUST_SERVER_CERTIFICATE: 'true' },
    { DB_SERVER: 'lpc:localhost' },
    { DB_DRIVER: 'SQL Server Native Client 11.0' },
  ]) {
    assert.throws(() => buildDatabaseConfig({ NODE_ENV: 'production', ...unsafe }), isInvalidConfig);
  }
});

test('development TLS exceptions are restricted to local addresses', () => {
  for (const server of ['lpc:localhost', 'localhost', '.', '(local)', '127.0.0.1', '[::1]']) {
    const config = buildDatabaseConfig({
      NODE_ENV: 'development', DB_SERVER: server, DB_TRUST_SERVER_CERTIFICATE: 'true',
    });
    assert.equal(config.options.trustServerCertificate, true);
  }
  for (const server of ['sql.example.internal', 'localhost.example.internal', 'tcp:10.0.0.2']) {
    for (const exception of [{ DB_ENCRYPT: 'false' }, { DB_TRUST_SERVER_CERTIFICATE: 'true' }]) {
      assert.throws(() => buildDatabaseConfig({ NODE_ENV: 'test', DB_SERVER: server, ...exception }), isInvalidConfig);
    }
  }
});

test('ODBC attributes cannot be injected through server names and braced database values are escaped', () => {
  for (const server of ['localhost;UID=evil', 'localhost} ;PWD=evil;{', 'localhost\nPassword=evil']) {
    assert.throws(() => buildDatabaseConfig({ DB_SERVER: server }), isInvalidConfig);
  }
  const config = buildDatabaseConfig({ DB_NAME: 'SmartCook};UID=evil;{rest' });
  assert.ok(config.connectionString.includes('Database={SmartCook}};UID=evil;{rest};'));
  assert.equal(config.options.trustedConnection, true);
});

test('connection ports, timeouts and pool size enforce their documented bounds', () => {
  const config = buildDatabaseConfig({
    DB_SERVER: 'localhost', DB_PORT: '1444', DB_CONNECTION_TIMEOUT: '1000',
    DB_REQUEST_TIMEOUT: '120000', DB_POOL_MAX: '50',
  });
  assert.match(config.connectionString, /Server=\{localhost,1444\}/);
  assert.equal(config.connectionTimeout, 1000);
  assert.equal(config.requestTimeout, 120000);
  assert.equal(config.pool.max, 50);
  for (const invalid of [
    { DB_PORT: '1433' },
    { DB_SERVER: 'localhost\\SQLEXPRESS', DB_PORT: '1433' },
    { DB_SERVER: 'localhost,1433', DB_PORT: '1433' },
    { DB_SERVER: 'localhost', DB_PORT: '0' },
    { DB_SERVER: 'localhost', DB_PORT: '65536' },
    { DB_CONNECTION_TIMEOUT: '999' }, { DB_CONNECTION_TIMEOUT: '60001' },
    { DB_REQUEST_TIMEOUT: '120001' }, { DB_POOL_MAX: '0' }, { DB_POOL_MAX: '51' },
  ]) {
    assert.throws(() => buildDatabaseConfig(invalid), isInvalidConfig);
  }
});

test('unsupported authentication, drivers and malformed booleans fail without reflecting secret values', () => {
  const secret = 'do-not-reflect-secret-value';
  for (const invalid of [
    { DB_AUTH: secret }, { DB_DRIVER: secret }, { DB_ENCRYPT: secret },
    { DB_TRUST_SERVER_CERTIFICATE: secret }, { NODE_ENV: secret }, { DB_SERVER: `${secret};UID=evil` },
  ]) {
    assert.throws(() => buildDatabaseConfig(invalid), (error) => {
      assert.equal(error.code, 'EDBCONFIG');
      assert.equal(error.message.includes(secret), false);
      return true;
    });
  }
});
