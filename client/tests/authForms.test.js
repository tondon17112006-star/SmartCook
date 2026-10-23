import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeEmail, normalizeFullName, normalizePhone, safeReturnPath, validateEmail, validateFullName, validateLogin, validatePassword, validatePhone, validateProfile, validateRegister } from '../src/utilities/authForms.js'

test('auth form names normalize NFC and spaces, reject HTML/control, support Vietnamese', () => {
  assert.equal(normalizeFullName('  Nguyễn   Thị A  '), 'Nguyễn Thị A')
  for (const name of ['A', '12', '<script>', 'Tên\u200bẨn', 'A'.repeat(151)]) assert.ok(validateFullName(name))
  assert.equal(validateFullName('Nguyễn Thị Mai'), '')
})
test('auth email normalization and validation match common ASCII server addresses', () => {
  assert.equal(normalizeEmail('  MAI+BEp@Example.COM '), 'mai+bep@example.com')
  assert.equal(validateEmail('MAI+BEp@Example.COM'), '')
  for (const email of ['.a@example.com', 'a..b@example.com', 'a.@example.com', 'a@localhost', 'a@-example.com', 'tên@example.com', 'a'.repeat(250) + '@example.com']) assert.ok(validateEmail(email), email)
})
test('password validation preserves Unicode and whitespace and enforces exact limits', () => {
  assert.equal(validatePassword('  cụm mật khẩu dài  '), '')
  assert.equal(validatePassword('a'.repeat(12)), '')
  assert.equal(validatePassword('🙂'.repeat(1024)), '')
  for (const value of ['', 'a'.repeat(11), 'a'.repeat(1025), 'abcd\u0000123456789']) assert.ok(validatePassword(value))
  assert.deepEqual(validateLogin({ email: 'test@example.com', password: '  cụm mật khẩu dài  ' }), {})
})
test('registration validates confirmation, profile phones accept only supported formats', () => {
  const values = { fullName: 'Nguyễn Mai', email: 'mai@example.com', password: 'mật khẩu rất dài', confirmPassword: 'mật khẩu rất dài' }
  assert.deepEqual(validateRegister(values), {})
  assert.ok(validateRegister({ ...values, confirmPassword: 'khác' }).confirmPassword)
  assert.equal(normalizePhone('  +84 (90) 123-456  '), '+84 (90) 123-456')
  assert.equal(normalizePhone('   '), null)
  for (const phone of ['', '+84 (90) 123-456', '0901234567', '1234567']) assert.equal(validatePhone(phone), '')
  for (const phone of ['abc12345', '123456', '+090123x4567', '1'.repeat(21)]) assert.ok(validatePhone(phone))
  assert.deepEqual(validateProfile({ fullName: 'Nguyễn Mai', phone: '' }), {})
})
test('return paths preserve valid internal route details and block external, encoded and auth-loop targets', () => {
  assert.equal(safeReturnPath('/recipes/8?servings=4#steps'), '/recipes/8?servings=4#steps')
  assert.equal(safeReturnPath({ pathname: '/ingredients', search: '?search=trung', hash: '#pick' }), '/ingredients?search=trung#pick')
  for (const path of [undefined, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/%252f%252fevil.test', '/%5cevil.test', '/login', '/register?from=/login', '/LOGIN#form', '/foo/../login', '/%6cogin', '/\n/evil.test', '/%ZZ']) assert.equal(safeReturnPath(path), '/profile', String(path))
})
