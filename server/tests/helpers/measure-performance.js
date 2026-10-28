import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { getPool, closePool } from '../../src/config/database.js';
import { suggestRecipes } from '../../src/services/suggestion.service.js';
import { listRecipes, getRecipeById } from '../../src/services/recipe.service.js';
import { createAdminFixture } from './admin-fixture.js';

// Standalone QA measurement, NOT a load test. Run from server:
// node tests/helpers/measure-performance.js
// Five sequential samples per endpoint, one preceding warm-up. No SLA invented.
const api = process.env.SMARTCOOK_TEST_API_URL || 'http://127.0.0.1:5000/api';
const report = { samplesPerEndpoint: 5, concurrency: 1, warmupPerEndpoint: 1, publicApi: api,
  clock: 'performance.now', metrics: [], roundTrips: {}, fixture: 'Admin DTO only; SQL Users stay User, outer transaction rollback' };
const round = (value) => Number(value.toFixed(2));
async function measure(name, action) {
  const once = async () => {
    const start = performance.now(); await action(); return performance.now() - start;
  };
  const warmupMs = await once();
  const samples = [];
  for (let index = 0; index < report.samplesPerEndpoint; index++) samples.push(await once());
  const sorted = [...samples].sort((a, b) => a - b);
  report.metrics.push({ endpoint: name, warmupMs: round(warmupMs), samplesMs: samples.map(round),
    minMs: round(sorted[0]), medianMs: round(sorted[2]), p95Ms: round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    maxMs: round(sorted.at(-1)) });
}
async function publicRequest(path, body) {
  const response = await fetch(`${api}${path}`, { signal: AbortSignal.timeout(15000),
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  assert.equal(response.status, 200, path);
  return response.json();
}
function countedConnection(pool) {
  let count = 0;
  return {
    count: () => count,
    getConnection: async () => ({ request() {
      const query = pool.request(), execute = query.query.bind(query);
      query.query = (...args) => { count++; return execute(...args); };
      return query;
    } }),
  };
}
let fixture;
try {
  const pool = await getPool();
  const ingredientRows = (await pool.request().query(`SELECT IngredientID AS id, IngredientName AS name FROM dbo.Ingredients
    WHERE IngredientName IN (N'Trứng gà', N'Dầu ăn', N'Cà chua');`)).recordset;
  assert.equal(ingredientRows.length, 3);
  const body = { ingredientIds: ingredientRows.map((row) => Number(row.id)), servings: 4 };
  const recipes = await publicRequest('/recipes?search=' + encodeURIComponent('Trứng chiên'));
  const recipeId = recipes.data.find((row) => row.recipeName === 'Trứng chiên')?.recipeId;
  assert.ok(recipeId);
  const cases = [
    ['/health'], ['/health/db'], ['/categories'], ['/ingredients?search=' + encodeURIComponent('Trứng') + '&limit=20'],
    ['/recipes?limit=12'], [`/recipes/${recipeId}`], [`/recipes/${recipeId}/reviews`], ['/recipes/suggest', body],
  ];
  for (const [path, payload] of cases) await measure(path, () => publicRequest(path, payload));
  const suggestions = await publicRequest('/recipes/suggest', body);
  report.suggestions = { ingredients: ingredientRows.map((row) => row.name), total: suggestions.pagination.total,
    ready: suggestions.data.filter((row) => row.status === 'ready').length,
    missing: suggestions.data.filter((row) => row.status === 'missing').length,
    pageSize: suggestions.pagination.limit };
  for (const limit of [1, 12]) {
    const counter = countedConnection(pool);
    await suggestRecipes({ ...body, limit }, { getConnection: counter.getConnection });
    assert.equal(counter.count(), 3);
    report.roundTrips[`suggestions limit=${limit}`] = counter.count();
  }
  for (const limit of [1, 12]) {
    const counter = countedConnection(pool);
    await listRecipes({ limit: String(limit) }, { getConnection: counter.getConnection });
    assert.equal(counter.count(), 1);
    report.roundTrips[`recipes limit=${limit}`] = counter.count();
  }
  const detailCounter = countedConnection(pool);
  await getRecipeById(String(recipeId), { getConnection: detailCounter.getConnection });
  assert.equal(detailCounter.count(), 1);
  report.roundTrips.recipeDetail = detailCounter.count();
  // Release the public pool before constructing the isolated private fixture.
  await closePool();
  fixture = await createAdminFixture();
  for (const path of ['/auth/me', '/favorites?limit=12', '/pantry?limit=20', '/admin/dashboard', '/admin/recipes?limit=12', '/admin/users?limit=10']) {
    await measure(`${path} [rollback fixture]`, async () => {
      assert.equal((await fixture.admin.send(`/api${path}`)).status, 200);
    });
  }
} finally {
  if (fixture) await fixture.close(); else await closePool();
}
await writeFile(new URL('../../../.cache/step11-performance.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
