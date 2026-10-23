export function createPantryController({ service }) {
  return {
    async list(req, res) { res.json(await service.list(req.user.userId, req.query)); },
    async add(req, res) { res.status(201).json(await service.add(req.user.userId, req.body)); },
    async update(req, res) { res.json(await service.update(req.user.userId, req.params.id, req.body)); },
    async remove(req, res) { res.json(await service.remove(req.user.userId, req.params.id, req.body)); },
  };
}
