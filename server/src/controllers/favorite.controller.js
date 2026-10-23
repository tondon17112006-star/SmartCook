export function createFavoriteController({ service }) {
  return {
    async list(req, res) { res.json(await service.list(req.user.userId, req.query)); },
    async ids(req, res) { res.json(await service.ids(req.user.userId)); },
    async add(req, res) { res.status(201).json(await service.add(req.user.userId, req.body)); },
    async remove(req, res) { res.json(await service.remove(req.user.userId, req.params.recipeId, req.body)); },
  };
}
