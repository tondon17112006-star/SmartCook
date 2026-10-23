import { getCategories } from '../services/category.service.js';

export async function categoryController(_req, res) {
  res.status(200).json(await getCategories());
}
