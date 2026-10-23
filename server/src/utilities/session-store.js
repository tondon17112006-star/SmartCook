import { randomBytes } from 'node:crypto';
import { HttpError } from './http-error.js';

export function createSessionStore({ sessionTtlSeconds = 900, maxSessions = 10_000, now = Date.now } = {}) {
  const records = new Map();
  function prune() {
    const time = now();
    for (const [key, value] of records) if (value.expiresAt <= time) records.delete(key);
  }
  return {
    create(userId) {
      prune();
      if (records.size >= maxSessions) throw new HttpError(503, 'Dịch vụ đăng nhập đang bận. Vui lòng thử lại sau.');
      const record = { jti: randomBytes(32).toString('hex'), userId, expiresAt: now() + sessionTtlSeconds * 1000 };
      records.set(record.jti, record);
      return { ...record };
    },
    get(jti) {
      const record = records.get(jti);
      if (record && record.expiresAt <= now()) { records.delete(jti); return null; }
      return record ? { ...record } : null;
    },
    revoke(jti) { records.delete(jti); },
    prune,
    get size() { prune(); return records.size; },
  };
}

export function createCsrfStore({ csrfTtlSeconds = 900, maxCsrfRecords = 10_000, now = Date.now } = {}) {
  const records = new Map();
  function prune() {
    const time = now();
    for (const [key, value] of records) if (value.expiresAt <= time) records.delete(key);
  }
  return {
    create(sessionId = null) {
      prune();
      if (records.size >= maxCsrfRecords) throw new HttpError(503, 'Dịch vụ xác thực đang bận. Vui lòng thử lại sau.');
      const record = { nonce: randomBytes(32).toString('hex'), token: randomBytes(32).toString('hex'), sessionId, expiresAt: now() + csrfTtlSeconds * 1000 };
      records.set(record.nonce, record);
      return { ...record };
    },
    get(nonce) {
      const record = records.get(nonce);
      if (record && record.expiresAt <= now()) { records.delete(nonce); return null; }
      return record ? { ...record } : null;
    },
    revoke(nonce) { records.delete(nonce); },
    prune,
    get size() { prune(); return records.size; },
  };
}
