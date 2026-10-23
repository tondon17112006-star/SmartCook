import { randomBytes } from 'node:crypto';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const target = fileURLToPath(new URL('../.env', import.meta.url));
try {
  let contents;
  try { contents = await readFile(target, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await copyFile(new URL('../.env.example', import.meta.url), target);
    contents = await readFile(target, 'utf8');
  }
  const values = dotenv.parse(contents);
  let changed = false;
  for (const name of ['JWT_SECRET', 'PASSWORD_PEPPER']) {
    const existing = values[name];
    if (existing && !/change[-_ ]?me|your[-_ ]|example|placeholder|replace|secret[-_ ]?here/iu.test(existing)) {
      if (existing.length < 32 || existing.length > 512 || new Set(existing).size < 12) {
        throw new Error(`${name} hiện có không hợp lệ; hãy tự kiểm tra, công cụ không ghi đè khóa đang dùng.`);
      }
      continue;
    }
    const line = `${name}=${randomBytes(48).toString('base64url')}`;
    const pattern = new RegExp(`^${name}=.*$`, 'mu');
    contents = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
    changed = true;
  }
  const next = dotenv.parse(contents);
  if (next.JWT_SECRET === next.PASSWORD_PEPPER) throw new Error('Hai khóa phải khác nhau; công cụ không tự đổi khóa đang dùng.');
  if (changed) await writeFile(target, contents, { mode: 0o600 });
  console.log(changed ? 'Đã bổ sung khóa vào server/.env. Khởi động lại Backend để áp dụng.' : 'Khóa đã tồn tại; không thay đổi.');
  console.log('Giữ PASSWORD_PEPPER ổn định, sao lưu an toàn ngoài Git. Không chia sẻ tệp .env.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
