const drivers = new Set([
  'ODBC Driver 18 for SQL Server',
  'ODBC Driver 17 for SQL Server',
  'SQL Server Native Client 11.0',
]);

function invalid(message) {
  const error = new Error(message);
  error.code = 'EDBCONFIG';
  throw error;
}

function text(source, key, fallback, maxLength = 255) {
  const value = source[key] ?? fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength
      || /[\u0000-\u001f\u007f]/u.test(value)) {
    invalid(`${key} không hợp lệ.`);
  }
  return value.trim();
}

function boolean(source, key, fallback) {
  const value = source[key] ?? String(fallback);
  if (value !== 'true' && value !== 'false') invalid(`${key} phải là true hoặc false.`);
  return value === 'true';
}

function integer(source, key, fallback, min, max) {
  const value = source[key] ?? String(fallback);
  if (typeof value !== 'string' || !/^\d+$/u.test(value)
      || Number(value) < min || Number(value) > max) invalid(`${key} không hợp lệ.`);
  return Number(value);
}

function isLocal(server) {
  const host = server.toLowerCase().replace(/^(lpc|tcp|np):/u, '').split('\\')[0].split(',')[0];
  return ['localhost', '.', '(local)', '127.0.0.1', '::1', '[::1]'].includes(host);
}

function odbcValue(value) {
  return `{${value.replaceAll('}', '}}')}}`;
}

// This project uses the current Windows identity, never a guessed SQL login.
// A connection string is built here because the mssql native adapter does not
// forward every TLS option when building its own ODBC string.
export function buildDatabaseConfig(source = process.env) {
  const nodeEnv = text(source, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) invalid('NODE_ENV không hợp lệ.');
  const production = nodeEnv === 'production';
  const server = text(source, 'DB_SERVER', production ? 'localhost' : 'lpc:localhost');
  if (/[;{}]/u.test(server)) invalid('DB_SERVER không hợp lệ.');
  const database = text(source, 'DB_NAME', 'SmartCookDB', 128);
  if (text(source, 'DB_AUTH', 'windows') !== 'windows') invalid('DB_AUTH hiện chỉ hỗ trợ windows.');
  const driver = text(source, 'DB_DRIVER', production
    ? 'ODBC Driver 18 for SQL Server' : 'SQL Server Native Client 11.0');
  if (!drivers.has(driver)) invalid('DB_DRIVER không thuộc danh sách driver SQL Server được hỗ trợ.');

  const encrypt = boolean(source, 'DB_ENCRYPT', true);
  const trustServerCertificate = boolean(source, 'DB_TRUST_SERVER_CERTIFICATE', false);
  const localDevelopment = !production && isLocal(server);
  if ((!encrypt || trustServerCertificate) && !localDevelopment) {
    invalid('Chỉ development/test trên máy local mới được dùng ngoại lệ TLS.');
  }
  if (production && (/^lpc:/iu.test(server) || driver === 'SQL Server Native Client 11.0')) {
    invalid('Production yêu cầu ODBC Driver 17/18 và kết nối máy chủ được cấu hình phù hợp.');
  }

  const port = source.DB_PORT === undefined || source.DB_PORT === ''
    ? null : integer(source, 'DB_PORT', 1433, 1, 65535);
  if (port !== null && (/^lpc:/iu.test(server) || /[\\,]/u.test(server))) {
    invalid('Không đặt DB_PORT khi DB_SERVER đã có instance, cổng hoặc dùng shared memory.');
  }
  const address = port === null ? server : `${server},${port}`;
  const connectionString = [
    `Driver=${odbcValue(driver)}`,
    `Server=${odbcValue(address)}`,
    `Database=${odbcValue(database)}`,
    'Trusted_Connection=Yes',
    `Encrypt=${encrypt ? 'Yes' : 'No'}`,
    `TrustServerCertificate=${trustServerCertificate ? 'Yes' : 'No'}`,
    'APP=SmartCook API',
  ].join(';') + ';';

  return {
    server,
    database,
    driver,
    connectionString,
    connectionTimeout: integer(source, 'DB_CONNECTION_TIMEOUT', 10000, 1000, 60000),
    requestTimeout: integer(source, 'DB_REQUEST_TIMEOUT', 15000, 1000, 120000),
    options: { trustedConnection: true, useUTC: true, encrypt, trustServerCertificate },
    pool: {
      max: integer(source, 'DB_POOL_MAX', 10, 1, 50),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}
