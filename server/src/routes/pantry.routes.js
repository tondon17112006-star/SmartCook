import { Router } from 'express';
import { createPantryRepository } from '../services/pantry.repository.js';
import { createPantryService } from '../services/pantry.service.js';
import { createPantryController } from '../controllers/pantry.controller.js';

export function createPantryRouter({ security, repository = createPantryRepository() }) {
  const router = Router();
  const controller = createPantryController({ service: createPantryService({ repository }) });
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.use(security.authenticateJWT);
  router.get('/', controller.list);
  router.post('/', security.csrfProtection, controller.add);
  router.patch('/:id', security.csrfProtection, controller.update);
  router.delete('/:id', security.csrfProtection, controller.remove);
  return router;
}
