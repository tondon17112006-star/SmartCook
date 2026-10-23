export function createAdminController({ service }) {
  return {
    async dashboard(_req, res) { res.json(await service.dashboard()); },
    async listRecipes(req, res) { res.json(await service.listRecipes(req.query)); },
    async getRecipe(req, res) { res.json(await service.getRecipe(req.params.id)); },
    async createRecipe(req, res) { res.status(201).json(await service.createRecipe(req.user.userId, req.body)); },
    async updateRecipe(req, res) { res.json(await service.updateRecipe(req.params.id, req.body)); },
    async deleteRecipe(req, res) { res.json(await service.deleteRecipe(req.params.id, req.body)); },
    async listCategories(req, res) { res.json(await service.listCategories(req.query)); },
    async createCategory(req, res) { res.status(201).json(await service.createCategory(req.body)); },
    async updateCategory(req, res) { res.json(await service.updateCategory(req.params.id, req.body)); },
    async deleteCategory(req, res) { res.json(await service.deleteCategory(req.params.id, req.body)); },
    async listIngredients(req, res) { res.json(await service.listIngredients(req.query)); },
    async createIngredient(req, res) { res.status(201).json(await service.createIngredient(req.body)); },
    async updateIngredient(req, res) { res.json(await service.updateIngredient(req.params.id, req.body)); },
    async deleteIngredient(req, res) { res.json(await service.deleteIngredient(req.params.id, req.body)); },
    async listUsers(req, res) { res.json(await service.listUsers(req.query)); },
    async getUser(req, res) { res.json(await service.getUser(req.params.id)); },
    async listReviews(req, res) { res.json(await service.listReviews(req.query)); },
    async deleteReview(req, res) { res.json(await service.deleteReview(req.params.id, req.body)); },
  };
}
