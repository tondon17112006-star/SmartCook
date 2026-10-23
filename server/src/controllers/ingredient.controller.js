import { getIngredients } from '../services/ingredient.service.js';

export async function ingredientController(req, res) {
  res.status(200).json(await getIngredients(req.query));
}
