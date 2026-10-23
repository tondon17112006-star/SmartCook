import { createHmac } from 'node:crypto';
import bcrypt from 'bcrypt';

export const PASSWORD_HASH_PREFIX = 'sc$bcrypt-hmac384$v1$';
const BCRYPT_ROUNDS = 12;

function prepare(password, pepper) {
  // SHA-384 base64 is 64 ASCII bytes, below bcrypt's 72-byte cutoff. HMAC also
  // prevents password shucking against hashes produced by unrelated services.
  return createHmac('sha384', pepper).update(password, 'utf8').digest('base64');
}

export async function hashPassword(password, pepper) {
  return PASSWORD_HASH_PREFIX + await bcrypt.hash(prepare(password, pepper), BCRYPT_ROUNDS);
}

export async function verifyPassword(password, storedHash, pepper) {
  if (typeof storedHash !== 'string' || !storedHash.startsWith(PASSWORD_HASH_PREFIX)) return false;
  const bcryptHash = storedHash.slice(PASSWORD_HASH_PREFIX.length);
  if (!/^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/u.test(bcryptHash)) return false;
  return bcrypt.compare(prepare(password, pepper), bcryptHash);
}

const dummyHashes = new Map();
export async function compareDummyPassword(password, pepper) {
  // One cached dummy hash per configured pepper; no password or pepper is logged.
  // Applications use one pepper; tests may create several independent factories.
  if (!dummyHashes.has(pepper)) {
    if (dummyHashes.size >= 8) dummyHashes.clear();
    dummyHashes.set(pepper, hashPassword('SmartCook dummy credential — never a real account', pepper));
  }
  return verifyPassword(password, await dummyHashes.get(pepper), pepper);
}
