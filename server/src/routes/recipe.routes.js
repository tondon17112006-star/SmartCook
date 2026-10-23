import { Router } from 'express';
import {
  recipeDetailController,
  recipeListController,
  recipeSuggestionController,
} from '../controllers/recipe.controller.js';

export const recipeRouter = Router();

recipeRouter.get('/', recipeListController);
recipeRouter.post('/suggest', recipeSuggestionController);
recipeRouter.get('/:id', recipeDetailController);
