import { Router } from 'express';
import { createReviewRepository } from '../services/review.repository.js';
import { createReviewService } from '../services/review.service.js';
import { createReviewController } from '../controllers/review.controller.js';

function privateCache(_req, res, next) { res.set('Cache-Control', 'private, no-store'); next(); }

export function createPublicReviewRouter({ repository = createReviewRepository() } = {}) {
  const router = Router();
  const controller = createReviewController({ service: createReviewService({ repository }) });
  router.get('/:id/reviews', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, controller.list);
  return router;
}

export function createReviewRouter({ security, repository = createReviewRepository() }) {
  const router = Router();
  const controller = createReviewController({ service: createReviewService({ repository }) });
  // This router mounts at /api: auth/cache apply only to matching personal endpoints.
  router.get('/recipes/:id/reviews/mine', privateCache, security.authenticateJWT, controller.mine);
  router.post('/recipes/:id/reviews', privateCache, security.authenticateJWT, security.csrfProtection, controller.add);
  router.patch('/reviews/:reviewId', privateCache, security.authenticateJWT, security.csrfProtection, controller.update);
  router.delete('/reviews/:reviewId', privateCache, security.authenticateJWT, security.csrfProtection, controller.remove);
  return router;
}
