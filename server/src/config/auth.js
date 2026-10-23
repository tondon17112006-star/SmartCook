import './env.js';

function readSecret(value, name) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 512
      || /change[-_ ]?me|your[-_ ]|example|placeholder|replace|secret[-_ ]?here/iu.test(value)
      || new Set(value).size < 12) {
    throw new Error(`${name} phải là secret ngẫu nhiên riêng biệt, ít nhất 32 ký tự.`);
  }
  return value;
}

// Read lazily: public health/catalog endpoints remain usable before auth setup.
export function getAuthConfig(source = process.env) {
  const jwtSecret = readSecret(source.JWT_SECRET, 'JWT_SECRET');
  const passwordPepper = readSecret(source.PASSWORD_PEPPER, 'PASSWORD_PEPPER');
  if (jwtSecret === passwordPepper) throw new Error('JWT_SECRET và PASSWORD_PEPPER phải khác nhau.');
  const secureCookie = source.NODE_ENV === 'production' || source.AUTH_COOKIE_SECURE === 'true';
  if (source.NODE_ENV === 'production' && source.AUTH_COOKIE_SECURE === 'false') {
    throw new Error('Cookie xác thực phải dùng Secure trong production.');
  }
  const clientOrigins = (source.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  if (clientOrigins.length === 0 || clientOrigins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)
        || (source.NODE_ENV === 'production' && parsed.protocol !== 'https:');
    } catch { return true; }
  })) throw new Error('CLIENT_ORIGIN phải là danh sách origin đầy đủ, dùng HTTPS trong production.');
  return Object.freeze({
    jwtSecret, passwordPepper, secureCookie, clientOrigins,
    issuer: 'smartcook-api', audience: 'smartcook-web',
    sessionTtlSeconds: 15 * 60, csrfTtlSeconds: 15 * 60,
    maxSessions: 10_000, maxCsrfRecords: 10_000, maxRateRecords: 10_000,
    cookieName: secureCookie ? '__Host-smartcook_session' : 'smartcook_session',
    csrfCookieName: secureCookie ? '__Host-smartcook_csrf' : 'smartcook_csrf',
  });
}
