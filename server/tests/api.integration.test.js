import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { app } from '../src/app.js';
import { closePool, getPool, sql } from '../src/config/database.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

// This suite reads the existing SQL Server seed data. It never seeds, updates or deletes data.
let server;
let baseUrl;
let pool;
let originalCounts;

before(async () => {
  pool = await getPool();
  originalCounts = (await pool.request().query(`
    SELECT (SELECT COUNT(*) FROM dbo.Categories) AS categories,
           (SELECT COUNT(*) FROM dbo.Ingredients) AS ingredients,
           (SELECT COUNT(*) FROM dbo.Recipes) AS recipes;
  `)).recordset[0];
  assert.ok(originalCounts.categories >= 8, 'The existing category seed data is required.');
  assert.ok(originalCounts.ingredients >= 64, 'The existing ingredient seed data is required.');
  assert.ok(originalCounts.recipes >= 20, 'The existing recipe seed data is required.');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 60_000 });

after(async () => {
  try {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } finally {
    await closePool();
  }
});

async function get(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, expectedStatus, `${path}: expected HTTP ${expectedStatus}`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  return response.json();
}

function queryPath(path, query) {
  return `${path}?${new URLSearchParams(query)}`;
}

function assertPagination(body, { page = 1, limit = 20, total }) {
  assert.ok(Array.isArray(body.data));
  assert.deepEqual(body.pagination, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPreviousPage: page > 1,
  });
  assert.ok(body.data.length <= limit);
}

test('GET /api/health preserves the original health response', async () => {
  const body = await get('/api/health');
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'SmartCook API');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});

test('GET /api/health/db confirms SQL readiness without exposing connection configuration', async () => {
  const body = await get('/api/health/db');
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'SmartCook Database');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  assert.doesNotMatch(JSON.stringify(body), /password|connectionString|trusted_connection|driver=|server=/i);
});

test('GET /api/categories returns all real SQL Server rows and public fields', async () => {
  const body = await get('/api/categories');
  const expected = await pool.request().query(`
    SELECT CategoryID AS categoryId, CategoryName AS categoryName,
           Description AS description, ImageUrl AS imageUrl
    FROM dbo.Categories ORDER BY CategoryName ASC, CategoryID ASC;
  `);
  assert.deepEqual(body.data, expected.recordset.map((row) => ({ ...row, categoryId: Number(row.categoryId) })));
  assert.equal(body.data.length, originalCounts.categories);
});

test('GET /api/ingredients returns paginated SQL Server ingredients', async () => {
  const body = await get('/api/ingredients');
  const expected = await pool.request().query(`
    SELECT TOP (20) IngredientID AS ingredientId, IngredientName AS ingredientName,
           IngredientCategory AS ingredientCategory, DefaultUnit AS defaultUnit, ImageUrl AS imageUrl
    FROM dbo.Ingredients ORDER BY IngredientName ASC, IngredientID ASC;
  `);
  assert.deepEqual(body.data, expected.recordset.map((row) => ({ ...row, ingredientId: Number(row.ingredientId) })));
  assertPagination(body, { total: originalCounts.ingredients });
});

test('GET /api/ingredients?search=trứng preserves Vietnamese Unicode and filters SQL data', async () => {
  const body = await get(queryPath('/api/ingredients', { search: 'trứng' }));
  const expected = await pool.request().input('search', sql.NVarChar(302), '%trứng%').query(`
    SELECT IngredientID AS ingredientId FROM dbo.Ingredients
    WHERE IngredientName LIKE @search ORDER BY IngredientName ASC, IngredientID ASC;
  `);
  assert.ok(expected.recordset.length > 0);
  assert.deepEqual(body.data.map((row) => row.ingredientId), expected.recordset.map((row) => Number(row.ingredientId)));
  assertPagination(body, { total: expected.recordset.length });
  const decomposed = await get(queryPath('/api/ingredients', { search: 'trứng'.normalize('NFD') }));
  assert.deepEqual(decomposed, body);
});

test('ingredientCategory matches its group and pagination never duplicates rows', async () => {
  const group = (await pool.request().query(`
    SELECT TOP (1) IngredientCategory AS ingredientCategory FROM dbo.Ingredients ORDER BY IngredientID;
  `)).recordset[0].ingredientCategory;
  const filtered = await get(queryPath('/api/ingredients', { ingredientCategory: group, limit: '100' }));
  const expected = (await pool.request().input('group', sql.NVarChar(100), group).query(`
    SELECT COUNT(*) AS total FROM dbo.Ingredients WHERE IngredientCategory = @group;
  `)).recordset[0].total;
  assertPagination(filtered, { limit: 100, total: expected });
  assert.ok(filtered.data.every((row) => row.ingredientCategory === group));
  const first = await get('/api/ingredients?page=1&limit=5');
  const second = await get('/api/ingredients?page=2&limit=5');
  assertPagination(second, { page: 2, limit: 5, total: originalCounts.ingredients });
  assert.equal(new Set([...first.data, ...second.data].map((row) => row.ingredientId)).size, 10);
});

test('GET /api/recipes returns computed times, required public fields and SQL totals', async () => {
  const body = await get('/api/recipes');
  assertPagination(body, { total: originalCounts.recipes });
  for (const row of body.data) {
    for (const key of ['recipeId', 'recipeName', 'description', 'imageUrl', 'prepTime', 'cookTime', 'totalTime', 'servings', 'difficulty', 'categoryName']) {
      assert.ok(Object.hasOwn(row, key), `Missing recipe field: ${key}`);
    }
    assert.equal(row.totalTime, row.prepTime + row.cookTime);
    assert.ok(Number.isSafeInteger(row.recipeId) && row.recipeId > 0);
    for (const key of ['prepTime', 'cookTime', 'totalTime', 'servings']) {
      assert.ok(Number.isSafeInteger(row[key]), `${key} must be a JSON number`);
    }
    assert.ok(row.servings > 0);
    assert.ok(['Dễ', 'Trung bình', 'Khó'].includes(row.difficulty));
  }
  const expectedIds = (await pool.request().query(`
    SELECT TOP (20) RecipeID AS recipeId FROM dbo.Recipes ORDER BY CreatedAt DESC, RecipeID DESC;
  `)).recordset.map((row) => Number(row.recipeId));
  assert.deepEqual(body.data.map((row) => row.recipeId), expectedIds);
});

test('GET /api/recipes?categoryId=1 matches real category rows', async () => {
  const body = await get('/api/recipes?categoryId=1&limit=100');
  const expected = await pool.request().input('categoryId', sql.Int, 1).query(`
    SELECT RecipeID AS recipeId FROM dbo.Recipes WHERE CategoryID = @categoryId
    ORDER BY CreatedAt DESC, RecipeID DESC;
  `);
  assert.deepEqual(body.data.map((row) => row.recipeId), expected.recordset.map((row) => Number(row.recipeId)));
  assertPagination(body, { limit: 100, total: expected.recordset.length });
});

test('GET /api/recipes?search=trứng searches real Vietnamese recipe names', async () => {
  const body = await get(queryPath('/api/recipes', { search: 'trứng', limit: '100' }));
  const expected = await pool.request().input('search', sql.NVarChar(302), '%trứng%').query(`
    SELECT RecipeID AS recipeId FROM dbo.Recipes WHERE RecipeName LIKE @search
    ORDER BY CreatedAt DESC, RecipeID DESC;
  `);
  assert.ok(expected.recordset.length > 0);
  assert.deepEqual(body.data.map((row) => row.recipeId), expected.recordset.map((row) => Number(row.recipeId)));
  assertPagination(body, { limit: 100, total: expected.recordset.length });
});

test('recipe time and difficulty filters work together', async () => {
  const body = await get(queryPath('/api/recipes', { maxTime: '30', difficulty: 'Dễ', limit: '100' }));
  const expected = await pool.request().input('maxTime', sql.Int, 30).input('difficulty', sql.NVarChar(30), 'Dễ').query(`
    SELECT RecipeID AS recipeId FROM dbo.Recipes
    WHERE PrepTime + CookTime <= @maxTime AND Difficulty = @difficulty
    ORDER BY CreatedAt DESC, RecipeID DESC;
  `);
  assert.ok(expected.recordset.length > 0);
  assert.deepEqual(body.data.map((row) => row.recipeId), expected.recordset.map((row) => Number(row.recipeId)));
  assertPagination(body, { limit: 100, total: expected.recordset.length });
});

test('all whitelisted recipe sort orders match SQL Server ordering', async (context) => {
  const orders = {
    name_asc: 'RecipeName ASC, RecipeID ASC',
    name_desc: 'RecipeName DESC, RecipeID DESC',
    time_asc: '(PrepTime + CookTime) ASC, RecipeID ASC',
    time_desc: '(PrepTime + CookTime) DESC, RecipeID DESC',
    newest: 'CreatedAt DESC, RecipeID DESC',
  };
  for (const [sort, order] of Object.entries(orders)) {
    await context.test(sort, async () => {
      const body = await get(queryPath('/api/recipes', { sort, limit: '100' }));
      // order comes only from the static test-owned whitelist above.
      const expected = await pool.request().query(`SELECT TOP (100) RecipeID AS recipeId FROM dbo.Recipes ORDER BY ${order};`);
      assert.deepEqual(body.data.map((row) => row.recipeId), expected.recordset.map((row) => Number(row.recipeId)));
    });
  }
});

test('recipe pagination has no duplicates and empty pages retain matching totals', async () => {
  const first = await get('/api/recipes?page=1&limit=5');
  const second = await get('/api/recipes?page=2&limit=5');
  assertPagination(second, { page: 2, limit: 5, total: originalCounts.recipes });
  assert.equal(new Set([...first.data, ...second.data].map((row) => row.recipeId)).size, 10);
  const beyond = await get('/api/recipes?page=100000&limit=5');
  assert.deepEqual(beyond.data, []);
  assertPagination(beyond, { page: 100_000, limit: 5, total: originalCounts.recipes });
  const empty = await get(queryPath('/api/recipes', { search: 'Không Có Món Này 987654321' }));
  assert.deepEqual(empty.data, []);
  assertPagination(empty, { total: 0 });
});

test('GET /api/recipes/1 contains real ingredients, quantities and ordered cooking steps', async () => {
  const { data } = await get('/api/recipes/1');
  assert.equal(data.recipeId, 1);
  assert.equal(data.totalTime, data.prepTime + data.cookTime);
  const expected = await pool.request().input('id', sql.Int, 1).query(`
    SELECT c.CategoryID AS categoryId, c.CategoryName AS categoryName,
           c.Description AS description, c.ImageUrl AS imageUrl
    FROM dbo.Recipes AS r INNER JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
    WHERE r.RecipeID = @id;
    SELECT i.IngredientID AS ingredientId, ri.Quantity AS quantity, ri.Unit AS unit,
           ri.IsRequired AS isRequired
    FROM dbo.RecipeIngredients AS ri INNER JOIN dbo.Ingredients AS i ON i.IngredientID = ri.IngredientID
    WHERE ri.RecipeID = @id;
    SELECT StepID AS stepId, StepNumber AS stepNumber, Instruction AS instruction, ImageUrl AS imageUrl
    FROM dbo.CookingSteps WHERE RecipeID = @id ORDER BY StepNumber ASC;
  `);
  const expectedCategory = expected.recordsets[0][0];
  assert.deepEqual(data.category, { ...expectedCategory, categoryId: Number(expectedCategory.categoryId) });
  assert.ok(data.ingredients.length > 0);
  const sortId = (left, right) => left.ingredientId - right.ingredientId;
  const actualIngredients = data.ingredients.map(({ ingredientId, quantity, unit, isRequired }) => ({ ingredientId, quantity, unit, isRequired }));
  const expectedIngredients = expected.recordsets[1].map((ingredient) => ({
    ...ingredient,
    ingredientId: Number(ingredient.ingredientId),
    quantity: Number(ingredient.quantity),
    isRequired: Boolean(ingredient.isRequired),
  }));
  assert.deepEqual(actualIngredients.sort(sortId), expectedIngredients.sort(sortId));
  for (const ingredient of data.ingredients) {
    assert.ok(Number.isSafeInteger(ingredient.ingredientId));
    assert.ok(ingredient.quantity > 0);
    assert.equal(typeof ingredient.unit, 'string');
    assert.equal(typeof ingredient.isRequired, 'boolean');
    assert.equal(typeof ingredient.ingredientName, 'string');
  }
  assert.ok(data.steps.length >= 3);
  assert.ok(data.steps.every((step) => Number.isSafeInteger(step.stepId) && Number.isSafeInteger(step.stepNumber)));
  assert.deepEqual(data.steps, expected.recordsets[2].map((step) => ({ ...step, stepId: Number(step.stepId) })));
});

test('GET /api/recipes/999999 and unknown routes return JSON 404 errors', async () => {
  for (const path of ['/api/recipes/999999', '/api/not-a-route']) {
    const body = await get(path, 404);
    assert.equal(typeof body.message, 'string');
    assert.ok(body.message.length > 0);
    assert.equal(Object.hasOwn(body, 'stack'), false);
  }
});

test('a real native SQL Server request timeout returns safe HTTP 504 through the middleware', async (context) => {
  // The delay belongs only to this isolated test app; no test route is added to the real API.
  const testApp = express();
  const log = context.mock.method(console, 'error', () => {});
  let observedError;
  testApp.get('/timeout', async (_req, res) => {
    try {
      await pool.request({ requestTimeout: 1000 }).query("WAITFOR DELAY '00:00:03'; SELECT 1 AS connected;");
      res.json({ unexpectedSuccess: true });
    } catch (error) {
      observedError = error;
      throw error;
    }
  });
  testApp.use(errorHandler);
  const timeoutServer = testApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    timeoutServer.once('listening', resolve);
    timeoutServer.once('error', reject);
  });
  try {
    const response = await fetch(`http://127.0.0.1:${timeoutServer.address().port}/timeout`, {
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, 504);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    const body = await response.json();
    assert.deepEqual(body, { message: 'Truy vấn cơ sở dữ liệu quá thời gian cho phép. Vui lòng thử lại sau.' });
    assert.ok(observedError, 'The SQL request must fail before the isolated app sends a response.');
    assert.ok(['EREQUEST', 'ETIMEOUT'].includes(observedError.code));
    assert.doesNotMatch(JSON.stringify(body), /WAITFOR|SELECT |password|stack|HYT00|EREQUEST/i);
    assert.doesNotMatch(JSON.stringify(log.mock.calls.map((call) => call.arguments)), /WAITFOR|SELECT |password|HYT00|EREQUEST/i);
  } finally {
    await new Promise((resolve, reject) => timeoutServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('invalid IDs, pagination and filters return HTTP 400', async (context) => {
  const paths = [
    '/api/recipes/0', '/api/recipes/-1', '/api/recipes/1.5', '/api/recipes/2147483648',
    '/api/recipes/1%20OR%201%3D1', '/api/recipes?page=0', '/api/recipes?page=-1',
    '/api/recipes?page=1&page=2', '/api/recipes?page=1e2', '/api/recipes?page=100001',
    '/api/recipes?limit=1000', '/api/recipes?limit=0', '/api/recipes?limit=1.5',
    '/api/recipes?categoryId=0', '/api/recipes?categoryId=abc', '/api/recipes?maxTime=-1',
    '/api/recipes?maxTime=0', '/api/recipes?difficulty=easy', '/api/recipes?sort=unknown',
    '/api/recipes?sort=name_asc&sort=newest', '/api/recipes?search=a&search=b',
    '/api/ingredients?page=0', '/api/ingredients?limit=101', '/api/ingredients?search=a&search=b',
    '/api/ingredients?ingredientCategory=a&ingredientCategory=b',
    queryPath('/api/recipes', { search: 'x'.repeat(151) }),
    queryPath('/api/ingredients', { search: 'x'.repeat(151) }),
    queryPath('/api/ingredients', { ingredientCategory: 'x'.repeat(101) }),
    queryPath('/api/recipes', { sort: 'name_asc; DROP TABLE dbo.Recipes;--' }),
  ];
  for (const path of paths) {
    await context.test(path, async () => {
      const body = await get(path, 400);
      assert.equal(typeof body.message, 'string');
      assert.equal(Object.hasOwn(body, 'stack'), false);
    });
  }
});

test('SQL injection and LIKE wildcard strings are literal searches without changing row counts', async (context) => {
  for (const endpoint of ['/api/recipes', '/api/ingredients']) {
    for (const search of ["' OR 1=1;--", '%', '_', '[', '~']) {
      await context.test(`${endpoint}: ${search}`, async () => {
        const body = await get(queryPath(endpoint, { search }));
        assert.deepEqual(body.data, []);
        assertPagination(body, { total: 0 });
      });
    }
  }
  const currentCounts = (await pool.request().query(`
    SELECT (SELECT COUNT(*) FROM dbo.Categories) AS categories,
           (SELECT COUNT(*) FROM dbo.Ingredients) AS ingredients,
           (SELECT COUNT(*) FROM dbo.Recipes) AS recipes;
  `)).recordset[0];
  assert.deepEqual(currentCounts, originalCounts);
});
