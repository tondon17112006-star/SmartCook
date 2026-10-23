export function createReviewController({ service }) {
  return {
    async list(req, res) { res.json(await service.list(req.params.id, req.query)); },
    async mine(req, res) { res.json(await service.mine(req.user.userId, req.params.id)); },
    async add(req, res) { res.status(201).json(await service.add(req.user.userId, req.params.id, req.body)); },
    async update(req, res) { res.json(await service.update(req.user.userId, req.params.reviewId, req.body)); },
    async remove(req, res) { res.json(await service.remove(req.user.userId, req.params.reviewId, req.body)); },
  };
}
