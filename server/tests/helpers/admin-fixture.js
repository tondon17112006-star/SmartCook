import { createPersonalFixture } from './personal-fixture.js';
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

// All SQL is real and confined to the outer fixture transaction. No account is
// promoted: the Admin role exists only on a test repository's session DTO.
export async function createAdminFixture() {
  const adminIds = new Set();
  let savepoint = 0;
  let failure = null;
  let repository;
  const fixture = await createPersonalFixture({
    mapSessionUser(user) {
      return user && adminIds.has(user.userId) ? { ...user, role: 'Admin' } : user;
    },
    routers({ app, security, request }) {
      const trackedRequest = () => {
        const query = request();
        const execute = query.query.bind(query);
        query.query = (statement, ...args) => {
          if (failure?.test(statement)) {
            failure = null;
            // RAISERROR simulates an actual SQL statement failure, after the
            // parent insert, without installing a trigger or aborting outer tx.
            return execute("RAISERROR(N'Fixture child insert failure', 16, 1);");
          }
          return execute(statement, ...args);
        };
        return query;
      };
      const withTransaction = async (work) => {
        const name = `admin_fixture_${++savepoint}`;
        await request().query(`SAVE TRANSACTION ${name};`);
        try { return await work(trackedRequest); }
        catch (error) {
          await request().query(`IF XACT_STATE() = 1 ROLLBACK TRANSACTION ${name};`);
          throw error;
        }
      };
      repository = createAdminRepository({ request: trackedRequest, withTransaction });
      app.use('/api/admin', createAdminRouter({ security, repository }));
      app.use('/api/favorites', createFavoriteRouter({ security, repository: createFavoriteRepository({ request }) }));
      const reviews = createReviewRepository({ request });
      app.use('/api/recipes', createPublicReviewRouter({ repository: reviews }));
      app.use('/api', createReviewRouter({ security, repository: reviews }));
      app.use('/api/pantry', createPantryRouter({ security, repository: createPantryRepository({ request }) }));
      // These are the same public services used by production controllers. The
      // connection points to this transaction so uncommitted test rows are visible.
      const connection = { getConnection: async () => ({ request }) };
      app.get('/api/recipes', async (req, res) => res.json(await listRecipes(req.query, connection)));
      app.post('/api/recipes/suggest', async (req, res) => res.json(await suggestRecipes(req.body, connection)));
      app.get('/api/recipes/:id', async (req, res) => res.json(await getRecipeById(req.params.id, connection)));
    },
  });
  const admin = fixture.userA;
  adminIds.add(admin.user.userId);
  return {
    ...fixture, admin, ordinary: fixture.userB, adminIds, adminRepository: repository,
    failNextQuery(pattern) { failure = pattern; },
  };
}
