import { HttpError } from '../utilities/http-error.js';

export function authenticateJWT({ readSession, repository, sessionStore }) {
  return async (req, _res, next) => {
    try {
      const session = readSession(req);
      if (!session) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.');
      // Authorization always uses the current row, never a role claim from JWT/client.
      const user = await repository.findById(session.userId);
      if (!user || !['User', 'Admin'].includes(user.role)) {
        sessionStore.revoke(session.jti);
        throw new HttpError(401, 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
      }
      req.user = user;
      req.auth = { userId: user.userId, jti: session.jti };
      return next();
    } catch (error) { return next(error); }
  };
}
