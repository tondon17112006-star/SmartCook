import { Router } from 'express';
import { ingredientController } from '../controllers/ingredient.controller.js';

export const ingredientRouter = Router();

ingredientRouter.get('/', ingredientController);
