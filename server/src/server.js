import { app } from './app.js';
import { env } from './config/env.js';
import { getListenErrorMessage } from './utilities/listen-error.js';
import { closePool } from './config/database.js';

const server = app.listen(env.port, env.host, () => {
  console.log(`SmartCook API đang chạy tại http://${env.host}:${env.port}`);
});

server.on('error', (error) => {
  console.error(getListenErrorMessage(error, env.host, env.port));
  process.exitCode = 1;
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => { process.exit(1); }, 10000);
  deadline.unref();
  server.close(async (error) => {
    try {
      await closePool();
      process.exitCode = error ? 1 : 0;
    } catch {
      console.error('Không thể đóng connection pool đúng hạn.');
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  });
  server.closeIdleConnections();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
