import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import { categoryRouter } from './category.routes.js';
import { ingredientRouter } from './ingredient.routes.js';
import { recipeRouter } from './recipe.routes.js';
import { getPool } from '../config/database.js';

export const apiRouter = Router();

apiRouter.get('/health', healthController);
apiRouter.get('/health/db', async (_req, res) => {
  const pool = await getPool();
  await pool.request().query('SELECT 1 AS connected;');
  res.json({ status: 'ok', service: 'SmartCook Database', timestamp: new Date().toISOString() });
});
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/ingredients', ingredientRouter);
apiRouter.use('/recipes', recipeRouter);
