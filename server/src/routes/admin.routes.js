import { Router } from 'express';
import { createAdminRepository } from '../services/admin.repository.js';
import { createAdminService } from '../services/admin.service.js';
import { createAdminController } from '../controllers/admin.controller.js';

export function createAdminRouter({ security, repository = createAdminRepository() }) {
  const router = Router();
  const controller = createAdminController({ service: createAdminService({ repository }) });
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(security.authenticateJWT, security.authorizeRoles('Admin'));
  router.get('/check', (_req, res) => res.json({ message: 'Bạn có quyền truy cập khu vực quản trị.' }));
  router.get('/dashboard', controller.dashboard);
  router.get('/recipes', controller.listRecipes);
  router.get('/recipes/:id', controller.getRecipe);
  router.post('/recipes', security.csrfProtection, controller.createRecipe);
  router.patch('/recipes/:id', security.csrfProtection, controller.updateRecipe);
  router.delete('/recipes/:id', security.csrfProtection, controller.deleteRecipe);
  router.get('/categories', controller.listCategories);
  router.post('/categories', security.csrfProtection, controller.createCategory);
  router.patch('/categories/:id', security.csrfProtection, controller.updateCategory);
  router.delete('/categories/:id', security.csrfProtection, controller.deleteCategory);
  router.get('/ingredients', controller.listIngredients);
  router.post('/ingredients', security.csrfProtection, controller.createIngredient);
  router.patch('/ingredients/:id', security.csrfProtection, controller.updateIngredient);
  router.delete('/ingredients/:id', security.csrfProtection, controller.deleteIngredient);
  router.get('/users', controller.listUsers);
  router.get('/users/:id', controller.getUser);
  router.get('/reviews', controller.listReviews);
  router.delete('/reviews/:id', security.csrfProtection, controller.deleteReview);
  return router;
}
