import { HttpError } from './http-error.js';

export function createAuthRateLimiter({ maxRateRecords = 10_000, now = Date.now,
  loginLimit = 10, loginWindowMs = 15 * 60 * 1000,
  registerLimit = 5, registerWindowMs = 60 * 60 * 1000 } = {}) {
  const records = new Map();
  const rules = { login: { limit: loginLimit, window: loginWindowMs }, register: { limit: registerLimit, window: registerWindowMs } };
  function prune() {
    const time = now();
    for (const [key, value] of records) if (value.expiresAt <= time) records.delete(key);
  }
  return {
    middleware(action) {
      if (!rules[action]) throw new TypeError('Unknown authentication rate limit action.');
      return (req, res, next) => {
        prune();
        // Express does not trust proxy headers unless explicitly configured by the operator.
        const key = `${action}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
        const rule = rules[action];
        let record = records.get(key);
        if (!record) {
          if (records.size >= maxRateRecords) {
            res.set('Retry-After', '60');
            return next(new HttpError(429, 'Có quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.'));
          }
          record = { count: 0, expiresAt: now() + rule.window };
          records.set(key, record);
        }
        record.count += 1;
        if (record.count > rule.limit) {
          res.set('Retry-After', String(Math.max(1, Math.ceil((record.expiresAt - now()) / 1000))));
          return next(new HttpError(429, 'Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.'));
        }
        return next();
      };
    },
    prune,
    get size() { prune(); return records.size; },
  };
}
