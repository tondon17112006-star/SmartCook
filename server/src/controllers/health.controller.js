import { getHealth } from '../services/health.service.js';

export function healthController(_req, res) {
  res.status(200).json(getHealth());
}
