import { Router } from 'express';
import { createFavoriteRepository } from '../services/favorite.repository.js';
import { createFavoriteService } from '../services/favorite.service.js';
import { createFavoriteController } from '../controllers/favorite.controller.js';

export function createFavoriteRouter({ security, repository = createFavoriteRepository() }) {
  const router = Router();
  const controller = createFavoriteController({ service: createFavoriteService({ repository }) });
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.use(security.authenticateJWT);
  router.get('/', controller.list);
  router.get('/ids', controller.ids);
  router.post('/', security.csrfProtection, controller.add);
  router.delete('/:recipeId', security.csrfProtection, controller.remove);
  return router;
}
