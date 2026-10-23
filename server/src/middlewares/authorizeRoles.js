import { HttpError } from '../utilities/http-error.js';

export function authorizeRoles(...roles) {
  if (!roles.length || roles.some((role) => !['User', 'Admin'].includes(role))) {
    throw new TypeError('Vai trò phân quyền không hợp lệ.');
  }
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Bạn không có quyền truy cập chức năng này.'));
    return next();
  };
}
