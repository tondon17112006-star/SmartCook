import { Router } from 'express';
import { createMealPlanRepository } from '../services/meal-plan.repository.js';
import { createMealPlanService } from '../services/meal-plan.service.js';
import { createMealPlanController } from '../controllers/meal-plan.controller.js';

export function createMealPlanRouter({ security, repository = createMealPlanRepository() }) {
  const router = Router();
  const controller = createMealPlanController({ service: createMealPlanService({ repository }) });
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.use(security.authenticateJWT);
  router.get('/', controller.getWeek);
  router.get('/shopping-list', controller.shoppingList);
  router.post('/items', security.csrfProtection, controller.add);
  router.patch('/items/:id', security.csrfProtection, controller.update);
  router.delete('/items/:id', security.csrfProtection, controller.remove);
  return router;
}
