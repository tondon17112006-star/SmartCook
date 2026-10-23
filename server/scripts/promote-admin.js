import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getPool, closePool, sql } from '../src/config/database.js';
import { normalizeEmail } from '../src/utilities/auth-validation.js';

// Local operator tool only. No public endpoint can change roles or create an Admin.
async function main() {
  const email = normalizeEmail(process.argv[2]);
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Chỉ chạy tương tác từ terminal để xác nhận thủ công.');
  const pool = await getPool();
  const found = await pool.request().input('email', sql.NVarChar(255), email)
    .query('SELECT UserID AS userId, Email AS email, Role AS role FROM dbo.Users WHERE Email=@email;');
  const user = found.recordset[0];
  if (!user) throw new Error('Không tìm thấy tài khoản. Hãy đăng ký tài khoản trước.');
  if (user.role === 'Admin') { console.log('Tài khoản đã có vai trò Admin; không thay đổi.'); return; }
  const terminal = createInterface({ input: stdin, output: stdout });
  let answer;
  try { answer = await terminal.question(`Cấp Admin cho ${user.email}? Nhập chính xác CAP ADMIN ${user.email}: `); }
  finally { terminal.close(); }
  if (answer !== `CAP ADMIN ${user.email}`) { console.log('Đã hủy; không thay đổi quyền.'); return; }
  const result = await pool.request().input('id', sql.Int, Number(user.userId)).input('email', sql.NVarChar(255), email)
    .query("UPDATE dbo.Users SET Role=N'Admin' WHERE UserID=@id AND Email=@email AND Role=N'User';");
  if (result.rowsAffected[0] !== 1) throw new Error('Tài khoản đã thay đổi; kiểm tra lại trước khi cấp quyền.');
  console.log('Đã cấp quyền Admin cho tài khoản được xác nhận.');
}
main().catch(() => { console.error('Không thể cấp quyền. Kiểm tra email, kết nối và xác nhận thủ công.'); process.exitCode = 1; })
  .finally(closePool);
