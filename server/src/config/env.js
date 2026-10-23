import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { parseClientOrigins, parsePort } from '../utilities/config.js';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: parsePort(process.env.PORT || '5000'),
  clientOrigins: parseClientOrigins(
    process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173',
  ),
});
