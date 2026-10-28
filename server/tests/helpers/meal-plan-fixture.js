import { createPersonalFixture } from './personal-fixture.js';
import { createMealPlanRepository } from '../../src/services/meal-plan.repository.js';
import { createMealPlanRouter } from '../../src/routes/meal-plan.routes.js';
import { createAdminRepository } from '../../src/services/admin.repository.js';
import { createAdminRouter } from '../../src/routes/admin.routes.js';
import { createFavoriteRepository } from '../../src/services/favorite.repository.js';
import { createFavoriteRouter } from '../../src/routes/favorite.routes.js';
import { createReviewRepository } from '../../src/services/review.repository.js';
import { createPublicReviewRouter, createReviewRouter } from '../../src/routes/review.routes.js';
import { createPantryRepository } from '../../src/services/pantry.repository.js';
import { createPantryRouter } from '../../src/routes/pantry.routes.js';
import { listRecipes, getRecipeById } from '../../src/services/recipe.service.js';
import { suggestRecipes } from '../../src/services/suggestion.service.js';
import { apiRouter } from '../../src/routes/api.routes.js';

// Every write belongs to one outer rollback transaction. The Admin role is a
// fixture-only DTO projection; Users.Role stays User in SQL Server.
export async function createMealPlanFixture() {
  const adminIds = new Set();
  let savepoint = 0; let failure = null; let queuedMutations = Promise.resolve();
  let mealRepository; let adminRepository; let withTransaction;
  const fixture = await createPersonalFixture({
    mapSessionUser(user) { return user && adminIds.has(user.userId) ? { ...user, role: 'Admin' } : user; },
    routers({ app, security, request }) {
      const trackedRequest = () => {
        const query = request(); const execute = query.query.bind(query);
        query.query = (statement, ...args) => {
          if (failure?.test(statement)) {
            failure = null;
            return execute("RAISERROR(N'Meal planner fixture SQL failure', 16, 1);");
          }
          return execute(statement, ...args);
        };
        return query;
      };
      withTransaction = (work) => {
        // Queue the complete callback, not just statements: overlapping savepoints
        // on one ODBC connection could otherwise roll back another HTTP mutation.
        const result = queuedMutations.then(async () => {
          const name = `meal_fixture_${++savepoint}`;
          await request().query(`SAVE TRANSACTION ${name};`);
          try { return await work(trackedRequest); }
          catch (error) {
            await request().query(`IF XACT_STATE() = 1 ROLLBACK TRANSACTION ${name};`);
            throw error;
          }
        });
        queuedMutations = result.catch(() => {});
        return result;
      };
      mealRepository = createMealPlanRepository({ request: trackedRequest, withTransaction });
      adminRepository = createAdminRepository({ request: trackedRequest, withTransaction });
      app.use('/api/meal-plans', createMealPlanRouter({ security, repository: mealRepository }));
      app.use('/api/admin', createAdminRouter({ security, repository: adminRepository }));
      app.use('/api/favorites', createFavoriteRouter({ security, repository: createFavoriteRepository({ request }) }));
      app.use('/api/pantry', createPantryRouter({ security, repository: createPantryRepository({ request }) }));
      const reviews = createReviewRepository({ request });
      app.use('/api/recipes', createPublicReviewRouter({ repository: reviews }));
      app.use('/api', createReviewRouter({ security, repository: reviews }));
      // Production public recipe/suggestion services see uncommitted fixture
      // recipes through their existing connection injection seam.
      const connection = { getConnection: async () => ({ request }) };
      app.get('/api/recipes', async (req, res) => res.json(await listRecipes(req.query, connection)));
      app.post('/api/recipes/suggest', async (req, res) => res.json(await suggestRecipes(req.body, connection)));
      app.get('/api/recipes/:id', async (req, res) => res.json(await getRecipeById(req.params.id, connection)));
      // Unmodified committed category/ingredient catalog and health endpoints.
      app.use('/api', apiRouter);
    },
  });
  adminIds.add(fixture.userA.user.userId);
  return { ...fixture, admin: fixture.userA, ordinary: fixture.userB, adminIds,
    mealRepository, adminRepository, withTransaction,
    failNextQuery(pattern) { failure = pattern; },
  };
}
