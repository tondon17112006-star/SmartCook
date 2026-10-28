import { validateMealPlanMutationQuery } from '../utilities/meal-plan-validation.js';

export function createMealPlanController({ service }) {
  return {
    async getWeek(req, res) { res.json(await service.getWeek(req.user.userId, req.query)); },
    async shoppingList(req, res) { res.json(await service.shoppingList(req.user.userId, req.query)); },
    async add(req, res) { validateMealPlanMutationQuery(req.query); res.status(201).json(await service.add(req.user.userId, req.body)); },
    async update(req, res) { validateMealPlanMutationQuery(req.query); res.json(await service.update(req.user.userId, req.params.id, req.body)); },
    async remove(req, res) { validateMealPlanMutationQuery(req.query); res.json(await service.remove(req.user.userId, req.params.id, req.body)); },
  };
}
