import { HttpError } from '../utilities/http-error.js';
import { validateRegister, validateLogin, validateProfile } from '../utilities/auth-validation.js';
import { hashPassword, verifyPassword, compareDummyPassword } from '../utilities/passwords.js';

export function publicUser(user) {
  return {
    userId: user.userId, fullName: user.fullName, email: user.email,
    phone: user.phone ?? null, avatar: user.avatar ?? null, role: user.role,
    createdAt: user.createdAt,
  };
}

function duplicateEmail(error) {
  return [error, ...(error.precedingErrors || [])].some((item) =>
    [2601, 2627].includes(Number(item.number))
      || [2601, 2627].includes(Number(item.originalError?.number))
      || [2601, 2627].includes(Number(item.originalError?.info?.number))
      || [2601, 2627].includes(Number(item.originalError?.code)));
}

export function createAuthService({ repository, config }) {
  return {
    async register(body) {
      const input = validateRegister(body);
      if (await repository.findByEmail(input.email)) {
        throw new HttpError(409, 'Không thể đăng ký với email này. Hãy đăng nhập hoặc dùng email khác.');
      }
      const passwordHash = await hashPassword(input.password, config.passwordPepper);
      try {
        return publicUser(await repository.createUser({ fullName: input.fullName, email: input.email, passwordHash }));
      } catch (error) {
        // The unique index is authoritative when concurrent requests race.
        if (duplicateEmail(error)) throw new HttpError(409, 'Không thể đăng ký với email này. Hãy đăng nhập hoặc dùng email khác.');
        throw error;
      }
    },
    async login(body) {
      const input = validateLogin(body);
      const user = await repository.findByEmail(input.email);
      const valid = user
        ? await verifyPassword(input.password, user.passwordHash, config.passwordPepper)
        : await compareDummyPassword(input.password, config.passwordPepper);
      if (!user || !valid || !['User', 'Admin'].includes(user.role)) {
        throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.');
      }
      return publicUser(user);
    },
    async updateProfile(userId, body) {
      const changes = validateProfile(body);
      const user = await repository.updateProfile(userId, changes);
      if (!user) throw new HttpError(401, 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
      return publicUser(user);
    },
  };
}
