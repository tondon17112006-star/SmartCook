import { getPool, closePool } from '../src/config/database.js';
import { buildDatabaseConfig } from '../src/utilities/database-config.js';

try {
  // Validate separately so configuration errors can name the field safely.
  buildDatabaseConfig();
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT DB_NAME() AS databaseName,
           (SELECT COUNT(*) FROM dbo.Recipes) AS recipeCount,
           CAST(CONNECTIONPROPERTY('net_transport') AS nvarchar(40)) AS transport;
    SELECT encrypt_option AS encrypted
    FROM sys.dm_exec_connections WHERE session_id = @@SPID;
  `);
  console.log(JSON.stringify({
    status: 'ok',
    node: process.version,
    ...result.recordsets[0][0],
    encrypted: result.recordsets[1][0]?.encrypted ?? null,
  }, null, 2));
} catch (error) {
  console.error(error.code === 'EDBCONFIG' ? error.message
    : 'Kiểm tra SQL Server thất bại. Kiểm tra dịch vụ, driver, quyền Windows và cấu hình .env.');
  process.exitCode = 1;
} finally {
  await closePool();
}
