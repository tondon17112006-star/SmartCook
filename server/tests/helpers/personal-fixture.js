import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { getPool, closePool, sql } from '../../src/config/database.js';
import { getAuthConfig } from '../../src/config/auth.js';
import { createUserRepository } from '../../src/services/user.repository.js';
import { createAuthSecurity } from '../../src/utilities/auth-security.js';
import { createAuthRouter } from '../../src/routes/auth.routes.js';
import { errorHandler } from '../../src/middlewares/error-handler.js';

// A fixture uses one real SQL transaction. Tests sharing it must run sequentially.
// Mount each feature repository with this request factory, never the global pool.
export async function createPersonalFixture({ routers, accountCount = 2, mapSessionUser = (user) => user } = {}) {
  const origin = 'http://localhost:5173';
  const config = getAuthConfig({
    JWT_SECRET: randomBytes(48).toString('hex'),
    PASSWORD_PEPPER: randomBytes(48).toString('hex'),
    CLIENT_ORIGIN: origin,
  });
  const accounts = [];
  const users = [];
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let begun = false;
  let server;
  let base;
  let closing;
  let closed = false;
  let queries = Promise.resolve();
  const request = () => {
    const query = new sql.Request(transaction);
    const execute = query.query.bind(query);
    // React can fetch public/private sections concurrently. A transaction has
    // one ODBC connection, so queue fixture queries while retaining real SQL.
    // Production repositories still use the connection pool without this queue.
    query.query = (...args) => {
      const result = queries.then(() => execute(...args));
      queries = result.catch(() => {});
      return result;
    };
    return query;
  };
  const repository = createUserRepository({ request });
  // A test may project a role onto a DTO without creating/promoting a SQL Admin.
  // This hook is fixture-only; production authentication has no role override.
  const security = createAuthSecurity({ config, repository: {
    ...repository,
    async findById(userId) { return mapSessionUser(await repository.findById(userId)); },
  } });
  const app = express();

  async function close() {
    if (closing) return closing;
    closing = (async () => {
      try {
        if (server?.listening) {
          await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
      } finally {
        try {
          if (begun) {
            await queries;
            await transaction.rollback();
            begun = false;
          }
          // Check only unique fixture addresses, preserving any existing users.
          for (const account of accounts) {
            const result = await pool.request().input('email', sql.NVarChar(255), account.email)
              .query('SELECT COUNT_BIG(*) AS total FROM dbo.Users WHERE Email = @email;');
            assert.equal(Number(result.recordset[0].total), 0, 'A fixture account survived transaction rollback.');
          }
        } finally {
          closed = true;
          await closePool();
        }
      }
    })();
    return closing;
  }

  function createClient() {
    const cookies = new Map();
    const client = { cookies, user: null };
    client.send = async (path, { method = 'GET', body, headers = {}, cookies: jar = cookies } = {}) => {
      assert.equal(closed, false, 'The SQL fixture has already closed.');
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Origin: origin,
          Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const item of response.headers.getSetCookie()) {
        const [name, ...parts] = item.split(';')[0].split('=');
        const value = parts.join('=');
        if (value) jar.set(name, value);
        else jar.delete(name);
      }
      const text = await response.text();
      let payload = null;
      if (text) {
        try { payload = JSON.parse(text); }
        catch { payload = text; }
      }
      return { status: response.status, headers: response.headers, body: payload };
    };
    client.mutate = async (path, body = {}, options = {}) => {
      const csrf = await client.send('/api/auth/csrf', { cookies: options.cookies });
      assert.equal(csrf.status, 200, 'Could not obtain the fixture CSRF token.');
      return client.send(path, {
        method: 'POST', body, ...options,
        headers: { 'X-CSRF-Token': csrf.body.csrfToken, ...options.headers },
      });
    };
    client.register = (body, options) => client.mutate('/api/auth/register', body, options);
    client.login = async (body, options) => {
      const result = await client.mutate('/api/auth/login', body, options);
      if (result.status === 200) client.user = result.body.data;
      return result;
    };
    client.logout = async (options) => {
      const result = await client.mutate('/api/auth/logout', {}, options);
      if (result.status === 200) client.user = null;
      return result;
    };
    return client;
  }

  async function createAccount() {
    const client = createClient();
    const credentials = {
      email: `personal-${randomBytes(16).toString('hex')}@example.test`,
      password: randomBytes(36).toString('base64url'),
    };
    // Record the address before registering so failure cleanup also checks it.
    accounts.push({ email: credentials.email });
    const registered = await client.register({ fullName: 'Người kiểm thử', ...credentials });
    assert.equal(registered.status, 201, 'Could not register a rollback fixture account.');
    assert.equal(registered.body.data.role, 'User');
    const loggedIn = await client.login(credentials);
    assert.equal(loggedIn.status, 200, 'Could not log in to the rollback fixture account.');
    assert.equal(loggedIn.body.data.role, 'User');
    users.push(client);
    return client;
  }

  try {
    await transaction.begin();
    begun = true;
    app.disable('x-powered-by');
    app.use(express.json({ limit: '100kb' }));
    app.use('/api/auth', createAuthRouter({ security }));
    if (routers) await routers({ app, security, request, sqlRequest: request });
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    base = `http://127.0.0.1:${server.address().port}`;
    for (let index = 0; index < accountCount; index += 1) await createAccount();
    const guest = createClient();
    return {
      app, base, origin, config, security, repository,
      request, sqlRequest: request, transaction,
      users, userA: users[0], userB: users[1], guest,
      send: guest.send, mutate: guest.mutate,
      createClient, createAccount, close,
    };
  } catch (error) {
    try { await close(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'SQL fixture setup and cleanup failed.'); }
    throw error;
  }
}
