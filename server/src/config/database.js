import sql from 'mssql/msnodesqlv8.js';
import './env.js';
import { buildDatabaseConfig } from '../utilities/database-config.js';
import { HttpError } from '../utilities/http-error.js';

let pool = null;
let connecting = null;

// Lazily connect so /api/health remains independent of database availability.
// Concurrent first requests await the same promise instead of opening many pools.
export async function getPool() {
  if (pool?.connected) return pool;
  if (!connecting) {
    connecting = (async () => {
      let candidate;
      try {
        if (pool) await pool.close();
        pool = null;
        candidate = new sql.ConnectionPool(buildDatabaseConfig());
        candidate.on('error', () => {
          console.error('Connection pool SQL Server gặp lỗi.');
        });
        await candidate.connect();
        pool = candidate;
        return pool;
      } catch {
        if (candidate) await candidate.close().catch(() => {});
        const error = new HttpError(503, 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.');
        error.code = 'DB_CONNECTION_FAILED';
        throw error;
      }
    })().finally(() => { connecting = null; });
  }
  return connecting;
}

export async function closePool() {
  if (connecting) await connecting.catch(() => {});
  const current = pool;
  pool = null;
  if (current) await current.close();
}

export { sql };
