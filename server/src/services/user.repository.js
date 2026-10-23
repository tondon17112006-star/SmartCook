import { getPool, sql } from '../config/database.js';

const safeColumns = `UserID AS userId, FullName AS fullName, Email AS email,
  Phone AS phone, Avatar AS avatar, Role AS role, CreatedAt AS createdAt`;

function normalize(row) {
  if (!row) return null;
  return {
    userId: Number(row.userId), fullName: row.fullName, email: row.email,
    phone: row.phone ?? null, avatar: row.avatar ?? null, role: row.role,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    ...(Object.hasOwn(row, 'passwordHash') ? { passwordHash: row.passwordHash } : {}),
  };
}

// Injectable request factory allows real SQL tests inside a rollback transaction.
export function createUserRepository({ request = async () => (await getPool()).request() } = {}) {
  return {
    async findByEmail(email) {
      const query = await request();
      query.input('email', sql.NVarChar(255), email);
      const result = await query.query(`SELECT ${safeColumns}, PasswordHash AS passwordHash
        FROM dbo.Users WHERE Email = @email;`);
      return normalize(result.recordset[0]);
    },
    async findById(userId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      const result = await query.query(`SELECT ${safeColumns} FROM dbo.Users WHERE UserID = @userId;`);
      return normalize(result.recordset[0]);
    },
    async createUser({ fullName, email, passwordHash }) {
      const query = await request();
      query.input('fullName', sql.NVarChar(150), fullName);
      query.input('email', sql.NVarChar(255), email);
      query.input('passwordHash', sql.NVarChar(255), passwordHash);
      // Public registration never accepts a role, including through the repository.
      const result = await query.query(`INSERT INTO dbo.Users (FullName, Email, PasswordHash, Role)
        OUTPUT INSERTED.UserID AS userId, INSERTED.FullName AS fullName, INSERTED.Email AS email,
          INSERTED.Phone AS phone, INSERTED.Avatar AS avatar, INSERTED.Role AS role,
          INSERTED.CreatedAt AS createdAt
        VALUES (@fullName, @email, @passwordHash, N'User');`);
      return normalize(result.recordset[0]);
    },
    async updateProfile(userId, changes) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      const assignments = [];
      if (Object.hasOwn(changes, 'fullName')) {
        query.input('fullName', sql.NVarChar(150), changes.fullName);
        assignments.push('FullName = @fullName');
      }
      if (Object.hasOwn(changes, 'phone')) {
        query.input('phone', sql.NVarChar(20), changes.phone);
        assignments.push('Phone = @phone');
      }
      if (!assignments.length) return this.findById(userId);
      const result = await query.query(`UPDATE dbo.Users SET ${assignments.join(', ')}
        OUTPUT INSERTED.UserID AS userId, INSERTED.FullName AS fullName, INSERTED.Email AS email,
          INSERTED.Phone AS phone, INSERTED.Avatar AS avatar, INSERTED.Role AS role,
          INSERTED.CreatedAt AS createdAt
        WHERE UserID = @userId;`);
      return normalize(result.recordset[0]);
    },
  };
}
