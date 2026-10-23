import { getRecipeById, listRecipes } from '../services/recipe.service.js';
import { suggestRecipes } from '../services/suggestion.service.js';

export async function recipeListController(req, res) {
  res.status(200).json(await listRecipes(req.query));
}

export async function recipeDetailController(req, res) {
  res.status(200).json(await getRecipeById(req.params.id));
}

export async function recipeSuggestionController(req, res) {
  res.status(200).json(await suggestRecipes(req.body));
}
