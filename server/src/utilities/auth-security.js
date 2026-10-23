import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getAuthConfig } from '../config/auth.js';
import { createUserRepository } from '../services/user.repository.js';
import { createAuthService } from '../services/auth.service.js';
import { createSessionStore, createCsrfStore } from './session-store.js';
import { createAuthRateLimiter } from './rate-limit.js';
import { HttpError } from './http-error.js';
import { authenticateJWT as createAuthenticateJWT } from '../middlewares/authenticateJWT.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';

const randomIdPattern = /^[a-f0-9]{64}$/u;

function requestCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  if (typeof header !== 'string' || header.length > 16_384) throw new HttpError(400, 'Cookie không hợp lệ.');
  const values = header.split(';').map((part) => part.trim()).filter((part) => part.slice(0, part.indexOf('=')) === name);
  // Duplicate cookies can otherwise be interpreted differently by proxies/frameworks.
  if (values.length > 1) throw new HttpError(400, 'Cookie không hợp lệ.');
  if (!values.length) return null;
  try { return decodeURIComponent(values[0].slice(name.length + 1)); }
  catch { throw new HttpError(400, 'Cookie không hợp lệ.'); }
}

export function createAuthSecurity({ config = getAuthConfig(), repository = createUserRepository(),
  sessionStore = createSessionStore(config), csrfStore = createCsrfStore(config),
  rateLimiter = createAuthRateLimiter(config), now = Date.now } = {}) {
  const cookieOptions = { httpOnly: true, secure: config.secureCookie, sameSite: 'lax', path: '/' };
  const service = createAuthService({ repository, config });

  function verifiedPayload(req, { ignoreExpiration = false } = {}) {
    const token = requestCookie(req, config.cookieName);
    if (!token || token.length > 2048) return null;
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'], issuer: config.issuer, audience: config.audience,
        clockTimestamp: Math.floor(now() / 1000), ignoreExpiration,
      });
      if (!payload || typeof payload !== 'object' || !/^\d{1,10}$/u.test(payload.sub || '')
          || !Number.isInteger(Number(payload.sub)) || Number(payload.sub) < 1 || Number(payload.sub) > 2_147_483_647
          || String(Number(payload.sub)) !== payload.sub || !randomIdPattern.test(payload.jti || '')
          || payload.iss !== config.issuer || payload.aud !== config.audience
          || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat)
          || payload.exp <= payload.iat || payload.exp - payload.iat > config.sessionTtlSeconds
          || payload.iat > Math.floor(now() / 1000)) return null;
      return payload;
    } catch { return null; }
  }

  function readSession(req) {
    const payload = verifiedPayload(req);
    if (!payload) return null;
    const record = sessionStore.get(payload.jti);
    return record && record.userId === Number(payload.sub) ? record : null;
  }

  function csrfContext(req) { return readSession(req)?.jti ?? null; }

  function setCsrfCookie(res, record) {
    res.cookie(config.csrfCookieName, record.nonce, { ...cookieOptions, maxAge: config.csrfTtlSeconds * 1000 });
  }

  function issueCsrf(req, res) {
    const origin = req.get('Origin');
    if (origin && !config.clientOrigins.includes(origin)) throw new HttpError(403, 'Nguồn yêu cầu không được phép truy cập.');
    const sessionId = csrfContext(req);
    const nonce = requestCookie(req, config.csrfCookieName);
    let record = nonce && randomIdPattern.test(nonce) ? csrfStore.get(nonce) : null;
    if (!record || record.sessionId !== sessionId) {
      const previous = record;
      record = csrfStore.create(sessionId);
      if (previous) csrfStore.revoke(previous.nonce);
      setCsrfCookie(res, record);
    }
    res.set('Cache-Control', 'no-store');
    return res.json({ csrfToken: record.token });
  }

  function csrfProtection(req, _res, next) {
    try {
      if (!config.clientOrigins.includes(req.get('Origin'))) {
        throw new HttpError(403, 'Nguồn yêu cầu không được phép truy cập.');
      }
      if (!req.is('application/json')) throw new HttpError(400, 'Yêu cầu xác thực phải sử dụng JSON.');
      const nonce = requestCookie(req, config.csrfCookieName);
      const token = req.get('X-CSRF-Token');
      const record = nonce && randomIdPattern.test(nonce) ? csrfStore.get(nonce) : null;
      if (!record || typeof token !== 'string' || !randomIdPattern.test(token)
          || record.sessionId !== csrfContext(req)
          || !timingSafeEqual(Buffer.from(record.token, 'hex'), Buffer.from(token, 'hex'))) {
        throw new HttpError(403, 'Phiên bảo vệ yêu cầu không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
      }
      return next();
    } catch (error) { return next(error); }
  }

  function revokeCookieCsrf(req) {
    const nonce = requestCookie(req, config.csrfCookieName);
    if (nonce) csrfStore.revoke(nonce);
  }

  function establishSession(req, res, user) {
    const record = sessionStore.create(user.userId);
    let csrf;
    try {
      csrf = csrfStore.create(record.jti);
      const token = jwt.sign({ iat: Math.floor(now() / 1000) }, config.jwtSecret, {
        algorithm: 'HS256', issuer: config.issuer, audience: config.audience,
        subject: String(user.userId), jwtid: record.jti, expiresIn: config.sessionTtlSeconds,
      });
      const previous = verifiedPayload(req, { ignoreExpiration: true });
      if (previous) sessionStore.revoke(previous.jti);
      revokeCookieCsrf(req);
      // No Max-Age for auth: this is a browser session cookie, never "remember me".
      res.cookie(config.cookieName, token, cookieOptions);
      setCsrfCookie(res, csrf);
    } catch (error) {
      sessionStore.revoke(record.jti);
      if (csrf) csrfStore.revoke(csrf.nonce);
      throw error;
    }
    return record;
  }

  function endSession(req, res) {
    // Expiration is ignored only to revoke a cryptographically valid old jti at logout.
    const payload = verifiedPayload(req, { ignoreExpiration: true });
    if (payload) sessionStore.revoke(payload.jti);
    revokeCookieCsrf(req);
    res.clearCookie(config.cookieName, cookieOptions);
    res.clearCookie(config.csrfCookieName, cookieOptions);
  }

  return {
    config, repository, sessionStore, csrfStore, rateLimiter, service, readSession,
    authenticateJWT: createAuthenticateJWT({ readSession, repository, sessionStore }),
    authorizeRoles, csrfProtection, issueCsrf, establishSession, endSession,
  };
}
