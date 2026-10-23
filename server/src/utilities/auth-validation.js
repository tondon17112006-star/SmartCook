import { HttpError } from './http-error.js';

function invalid(message) { throw new HttpError(400, message); }

export function validateBody(body, allowed, required = allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !allowed.includes(key))
      || required.some((key) => !Object.hasOwn(body, key))) {
    invalid('Dữ liệu yêu cầu có trường thiếu hoặc không được phép.');
  }
}

export function normalizeFullName(value) {
  if (typeof value !== 'string') invalid('Họ tên phải là chuỗi ký tự.');
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  // NVARCHAR limits UTF-16 units; reject invisible/control formatting characters.
  if (normalized.length < 2 || normalized.length > 150 || /[\p{Cc}\p{Cf}<>]/u.test(normalized)
      || !/\p{L}/u.test(normalized)) invalid('Họ tên phải từ 2 đến 150 ký tự hợp lệ.');
  return normalized;
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') invalid('Email không hợp lệ.');
  const email = value.normalize('NFC').trim().toLowerCase();
  // Deliberately accept common ASCII mailboxes only, consistently with browser validation.
  if (email.length > 255 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/u.test(email)
      || email.startsWith('.') || email.includes('..') || email.includes('.@')) {
    invalid('Vui lòng nhập địa chỉ email hợp lệ.');
  }
  return email;
}

export function validatePassword(value) {
  // Do not trim or normalize passwords: long Unicode passphrases remain exact.
  // UTF-8 would silently replace an unpaired UTF-16 surrogate with U+FFFD.
  // Reject malformed strings before HMAC instead of accepting password aliases.
  if (typeof value !== 'string' || !value.isWellFormed() || [...value].length < 12 || [...value].length > 1024
      || Buffer.byteLength(value, 'utf8') > 4096 || value.includes('\u0000')) {
    invalid('Mật khẩu phải có từ 12 đến 1024 ký tự, tối đa 4096 byte.');
  }
  return value;
}

export function normalizePhone(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') invalid('Số điện thoại không hợp lệ.');
  const phone = value.trim();
  if (!phone) return null;
  if (phone.length > 20 || !/^\+?[0-9][0-9 ()-]{5,18}[0-9]$/u.test(phone)) {
    invalid('Số điện thoại phải từ 7 đến 20 ký tự gồm chữ số, dấu +, khoảng trắng, () hoặc -.');
  }
  return phone;
}

export function validateRegister(body) {
  validateBody(body, ['fullName', 'email', 'password']);
  return { fullName: normalizeFullName(body.fullName), email: normalizeEmail(body.email), password: validatePassword(body.password) };
}

export function validateLogin(body) {
  validateBody(body, ['email', 'password']);
  return { email: normalizeEmail(body.email), password: validatePassword(body.password) };
}

export function validateProfile(body) {
  validateBody(body, ['fullName', 'phone'], []);
  if (Object.keys(body).length === 0) invalid('Hãy cung cấp thông tin hồ sơ cần cập nhật.');
  return {
    ...(Object.hasOwn(body, 'fullName') ? { fullName: normalizeFullName(body.fullName) } : {}),
    ...(Object.hasOwn(body, 'phone') ? { phone: normalizePhone(body.phone) } : {}),
  };
}
