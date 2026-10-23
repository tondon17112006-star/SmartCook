import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { app } from '../src/app.js';
import { closePool, getPool, sql } from '../src/config/database.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { suggestRecipes } from '../src/services/suggestion.service.js';

// Every public response below comes from the existing SQL Server database.
// No seed, mutation, persistent fixture, or fake API response is used.
let server;
let baseUrl;
let pool;
let originalSnapshot;
let recipes;
let ingredients;
let recipeIngredients;
let eggId;
let oilId;
let tomatoId;
let noMatchId;

const tables = [
  ['Users', 'UserID'], ['Categories', 'CategoryID'], ['Ingredients', 'IngredientID'],
  ['Recipes', 'RecipeID'], ['RecipeIngredients', 'RecipeID, IngredientID'],
  ['CookingSteps', 'StepID'], ['Favorites', 'FavoriteID'], ['Reviews', 'ReviewID'],
  ['UserIngredients', 'UserIngredientID'], ['SearchHistory', 'SearchID'],
];

async function snapshotDatabase() {
  const snapshot = {};
  for (const [table, order] of tables) {
    // Table/column fragments come exclusively from the static list above.
    const { recordset } = await pool.request().query(`
      SELECT (SELECT * FROM dbo.${table} ORDER BY ${order}
              FOR JSON PATH, INCLUDE_NULL_VALUES) AS payload,
             (SELECT COUNT_BIG(*) FROM dbo.${table}) AS [rowCount];
    `);
    // The native driver exposes the FOR JSON scalar for an empty table as null.
    assert.ok(typeof recordset[0].payload === 'string' || Number(recordset[0].rowCount) === 0);
    snapshot[table] = {
      rows: Number(recordset[0].rowCount),
      sha256: createHash('sha256').update(recordset[0].payload ?? '[]', 'utf8').digest('hex'),
    };
  }
  return snapshot;
}

async function listen(targetApp) {
  const targetServer = targetApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    targetServer.once('listening', resolve);
    targetServer.once('error', reject);
  });
  return targetServer;
}

async function closeServer(targetServer) {
  if (targetServer) {
    await new Promise((resolve, reject) => targetServer.close((error) => error ? reject(error) : resolve()));
  }
}

before(async () => {
  pool = await getPool();
  originalSnapshot = await snapshotDatabase();
  const result = await pool.request().query(`
    SELECT RecipeID AS recipeId, RecipeName AS recipeName, Description AS description,
           ImageUrl AS imageUrl, PrepTime AS prepTime, CookTime AS cookTime,
           Servings AS servings, Difficulty AS difficulty
    FROM dbo.Recipes ORDER BY RecipeID;
    SELECT IngredientID AS ingredientId, IngredientName AS ingredientName
    FROM dbo.Ingredients ORDER BY IngredientID;
    SELECT ri.RecipeID AS recipeId, ri.IngredientID AS ingredientId,
           i.IngredientName AS ingredientName, ri.Quantity AS quantity,
           ri.Unit AS unit, ri.IsRequired AS isRequired
    FROM dbo.RecipeIngredients AS ri
    INNER JOIN dbo.Ingredients AS i ON i.IngredientID = ri.IngredientID
    ORDER BY ri.RecipeID, ri.IngredientID;
  `);
  recipes = result.recordsets[0].map((row) => ({ ...row, recipeId: Number(row.recipeId) }));
  ingredients = result.recordsets[1].map((row) => ({ ...row, ingredientId: Number(row.ingredientId) }));
  recipeIngredients = result.recordsets[2].map((row) => ({
    ...row,
    recipeId: Number(row.recipeId),
    ingredientId: Number(row.ingredientId),
    quantity: Number(row.quantity),
    isRequired: Boolean(row.isRequired),
  }));
  assert.ok(recipes.length >= 20, 'Existing SmartCook recipe seed data is required.');
  assert.ok(ingredients.length >= 64, 'Existing SmartCook ingredient seed data is required.');
  assert.ok(ingredients.length <= 100, 'This seed-data suite sends all existing ingredients in one valid request.');

  // Resolve the actual seed IDs by typed Unicode parameters rather than example IDs.
  const named = await pool.request()
    .input('eggName', sql.NVarChar(150), 'Trứng gà')
    .input('oilName', sql.NVarChar(150), 'Dầu ăn')
    .input('tomatoName', sql.NVarChar(150), 'Cà chua')
    .query(`SELECT IngredientID AS ingredientId, IngredientName AS ingredientName
            FROM dbo.Ingredients WHERE IngredientName IN (@eggName, @oilName, @tomatoName);`);
  const namedIds = new Map(named.recordset.map((row) => [row.ingredientName, Number(row.ingredientId)]));
  eggId = namedIds.get('Trứng gà');
  oilId = namedIds.get('Dầu ăn');
  tomatoId = namedIds.get('Cà chua');
  assert.ok(eggId && oilId && tomatoId, 'Named example ingredients must exist.');
  noMatchId = ingredients.find((ingredient) => !recipeIngredients.some((link) => (
    link.ingredientId === ingredient.ingredientId && link.isRequired
  )))?.ingredientId;
  assert.ok(noMatchId, 'The existing seed must contain an ingredient used by no required recipe link.');
  assert.ok(!ingredients.some((ingredient) => ingredient.ingredientId === 2_147_483_647));
  server = await listen(app);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 60_000 });

after(async () => {
  try {
    // This also runs after failed tests, so accidental mutations cannot hide behind a failure.
    if (originalSnapshot) assert.deepEqual(await snapshotDatabase(), originalSnapshot);
  } finally {
    try { await closeServer(server); } finally { await closePool(); }
  }
});

async function post(body, expectedStatus = 200, url = `${baseUrl}/api/recipes/suggest`) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, expectedStatus, `POST suggestion: ${JSON.stringify(body)}`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  return response.json();
}

function assertPagination(body, { page = 1, limit = 12, total }) {
  assert.deepEqual(body.pagination, {
    page, limit, total, totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit), hasPreviousPage: page > 1,
  });
  assert.ok(body.data.length <= limit);
}

// Independent oracle: count links from raw SQL rows, then sort in JavaScript.
// This imports no production scoring, ranking, or normalization helpers.
function expectedScores(ingredientIds) {
  const selected = new Set(ingredientIds);
  return recipes.flatMap((recipe) => {
    const required = recipeIngredients.filter((row) => row.recipeId === recipe.recipeId && row.isRequired);
    const matches = required.filter((row) => selected.has(row.ingredientId)).length;
    if (!required.length || !matches) return [];
    return [{
      recipeId: recipe.recipeId,
      matchPercentage: Math.round(matches * 100 / required.length),
      matchedRequiredCount: matches,
      totalRequiredCount: required.length,
      missingRequiredCount: required.length - matches,
      totalTime: recipe.prepTime + recipe.cookTime,
    }];
  }).sort((left, right) => (
    right.matchPercentage - left.matchPercentage
    || left.missingRequiredCount - right.missingRequiredCount
    || left.totalTime - right.totalTime
    || left.recipeId - right.recipeId
  ));
}

function assertRecipeMatchesSql(actual, selectedIds, requestedServings = null) {
  const original = recipes.find((row) => row.recipeId === actual.recipeId);
  assert.ok(original, 'Every returned recipe must exist in SQL Server.');
  for (const field of ['recipeName', 'description', 'imageUrl', 'prepTime', 'cookTime', 'servings', 'difficulty']) {
    assert.equal(actual[field], original[field], `${actual.recipeId}: ${field}`);
  }
  assert.equal(actual.requestedServings, requestedServings);
  assert.equal(actual.totalTime, original.prepTime + original.cookTime);
  const expected = expectedScores(selectedIds).find((row) => row.recipeId === actual.recipeId);
  for (const field of ['matchPercentage', 'matchedRequiredCount', 'totalRequiredCount', 'missingRequiredCount']) {
    assert.equal(actual[field], expected[field], `${actual.recipeId}: ${field}`);
    assert.ok(Number.isSafeInteger(actual[field]));
  }
  assert.equal(actual.status, expected.missingRequiredCount === 0 ? 'ready' : 'missing');
  const selected = new Set(selectedIds);
  const allLinks = recipeIngredients.filter((row) => row.recipeId === actual.recipeId);
  const groups = [
    ['matchedIngredients', (row) => row.isRequired && selected.has(row.ingredientId)],
    ['missingIngredients', (row) => row.isRequired && !selected.has(row.ingredientId)],
    ['optionalIngredients', (row) => !row.isRequired],
  ];
  for (const [key, filter] of groups) {
    const expectedRows = allLinks.filter(filter);
    assert.ok(Array.isArray(actual[key]));
    assert.deepEqual(actual[key].map((row) => row.ingredientId).sort((a, b) => a - b),
      expectedRows.map((row) => row.ingredientId).sort((a, b) => a - b));
    for (const ingredient of actual[key]) {
      const source = expectedRows.find((row) => row.ingredientId === ingredient.ingredientId);
      for (const field of ['ingredientName', 'quantity', 'unit', 'isRequired']) {
        assert.equal(ingredient[field], source[field], `${actual.recipeId}: ingredient ${ingredient.ingredientId}: ${field}`);
      }
      assert.ok(Number.isSafeInteger(ingredient.ingredientId));
      assert.equal(ingredient.isAvailable, selected.has(ingredient.ingredientId));
      const expectedQuantity = requestedServings === null
        ? source.quantity : source.quantity * requestedServings / original.servings;
      assert.ok(Number.isFinite(ingredient.adjustedQuantity) && ingredient.adjustedQuantity > 0);
      assert.ok(Math.abs(ingredient.adjustedQuantity - expectedQuantity) <= Math.max(1, Math.abs(expectedQuantity)) * 1e-10);
    }
  }
}

test('suggestion rejects invalid ingredient arrays with safe Vietnamese HTTP 400 messages', async (context) => {
  const cases = [
    ['missing IDs', {}], ['empty', { ingredientIds: [] }],
    ['negative', { ingredientIds: [-1] }], ['zero', { ingredientIds: [0] }],
    ['fractional', { ingredientIds: [1.5] }], ['string ID', { ingredientIds: ['1'] }],
    ['SQL INT overflow', { ingredientIds: [2_147_483_648] }],
    ['unsafe integer', { ingredientIds: [Number.MAX_SAFE_INTEGER + 1] }],
    ['null ID', { ingredientIds: [null] }], ['boolean ID', { ingredientIds: [true] }],
    ['object ID', { ingredientIds: [{}] }], ['nested array', { ingredientIds: [[1]] }],
    ['null array', { ingredientIds: null }], ['string array', { ingredientIds: '1,2' }],
    ['object array', { ingredientIds: { 0: 1 } }],
    ['over 100 raw items', { ingredientIds: Array(101).fill(eggId) }],
    ['nonexistent ID', { ingredientIds: [2_147_483_647] }],
    ['valid and nonexistent IDs', { ingredientIds: [eggId, 2_147_483_647] }],
    ['SQL injection ID', { ingredientIds: ["1); DROP TABLE dbo.Recipes;--"] }],
  ];
  for (const [label, body] of cases) {
    await context.test(label, async () => {
      const error = await post(body, 400);
      assert.deepEqual(Object.keys(error), ['message']);
      assert.equal(typeof error.message, 'string');
      assert.match(error.message, /[àáảãạăâđèéêìíòóôơùúưỳýạệốữ]/iu);
      assert.doesNotMatch(error.message, /SELECT |DROP TABLE|stack|driver=|password/i);
    });
  }
});

test('servings, page and limit accept only bounded JSON integer numbers', async (context) => {
  const fields = {
    servings: [0, -1, 21, 1.5, '2', null, true, {}, []],
    page: [0, -1, 100_001, 1.5, '1', null, false, {}, []],
    limit: [0, -1, 51, 1.5, '12', null, false, {}, []],
  };
  for (const [field, values] of Object.entries(fields)) {
    for (const value of values) {
      await context.test(`${field}=${JSON.stringify(value)}`, async () => {
        const error = await post({ ingredientIds: [eggId], [field]: value }, 400);
        assert.deepEqual(Object.keys(error), ['message']);
        assert.equal(typeof error.message, 'string');
      });
    }
  }
});

test('one available egg gives Trứng chiên 50% and correctly identifies missing oil', async () => {
  const body = await post({ ingredientIds: [eggId], limit: 50 });
  assertPagination(body, { limit: 50, total: expectedScores([eggId]).length });
  const friedEgg = body.data.find((row) => row.recipeName === 'Trứng chiên');
  assert.ok(friedEgg);
  assert.equal(friedEgg.matchPercentage, 50);
  assert.equal(friedEgg.matchedRequiredCount, 1);
  assert.equal(friedEgg.totalRequiredCount, 2);
  assert.equal(friedEgg.missingRequiredCount, 1);
  assert.equal(friedEgg.status, 'missing');
  assert.deepEqual(friedEgg.matchedIngredients.map((row) => row.ingredientId), [eggId]);
  assert.deepEqual(friedEgg.missingIngredients.map((row) => row.ingredientId), [oilId]);
  for (const recipe of body.data) assertRecipeMatchesSql(recipe, [eggId]);
});

test('egg and oil make Trứng chiên ready at 100% using actual required links', async () => {
  const selected = [eggId, oilId];
  const body = await post({ ingredientIds: selected, limit: 50 });
  const friedEgg = body.data.find((row) => row.recipeName === 'Trứng chiên');
  assert.ok(friedEgg);
  assert.equal(friedEgg.matchPercentage, 100);
  assert.equal(friedEgg.status, 'ready');
  assert.deepEqual(friedEgg.missingIngredients, []);
  for (const recipe of body.data) assertRecipeMatchesSql(recipe, selected);
});

test('egg, tomato and oil make the actual three-required-ingredient tomato egg recipe ready', async () => {
  const selected = [eggId, tomatoId, oilId];
  const body = await post({ ingredientIds: selected, servings: 2, limit: 50 });
  const tomatoEgg = body.data.find((row) => row.recipeName === 'Trứng xào cà chua');
  assert.ok(tomatoEgg);
  assert.equal(tomatoEgg.matchPercentage, 100);
  assert.equal(tomatoEgg.totalRequiredCount, 3);
  assert.equal(tomatoEgg.status, 'ready');
  for (const recipe of body.data) assertRecipeMatchesSql(recipe, selected, 2);
});

test('duplicate IDs are removed without inflating matches or changing result order', async () => {
  const unique = await post({ ingredientIds: [eggId, oilId], limit: 50 });
  const duplicate = await post({ ingredientIds: [eggId, eggId, oilId, oilId], limit: 50 });
  assert.deepEqual(duplicate, unique);
  const maximumValid = await post({ ingredientIds: Array(100).fill(eggId), limit: 50 });
  const single = await post({ ingredientIds: [eggId], limit: 50 });
  assert.deepEqual(maximumValid, single);
});

test('optional ingredients change availability but never increase a recipe match percentage', async () => {
  const reference = recipes.find((recipe) => (
    recipeIngredients.some((row) => row.recipeId === recipe.recipeId && row.isRequired)
    && recipeIngredients.some((row) => row.recipeId === recipe.recipeId && !row.isRequired)
  ));
  assert.ok(reference);
  const links = recipeIngredients.filter((row) => row.recipeId === reference.recipeId);
  const firstRequired = links.find((row) => row.isRequired).ingredientId;
  const optionalIds = links.filter((row) => !row.isRequired).map((row) => row.ingredientId);
  const baseline = await post({ ingredientIds: [firstRequired], limit: 50 });
  const withOptional = await post({ ingredientIds: [firstRequired, ...optionalIds], limit: 50 });
  const beforeRecipe = baseline.data.find((recipe) => recipe.recipeId === reference.recipeId);
  const afterRecipe = withOptional.data.find((recipe) => recipe.recipeId === reference.recipeId);
  assert.ok(beforeRecipe && afterRecipe);
  assert.equal(afterRecipe.matchPercentage, beforeRecipe.matchPercentage);
  assert.equal(afterRecipe.matchedRequiredCount, beforeRecipe.matchedRequiredCount);
  assert.equal(afterRecipe.missingRequiredCount, beforeRecipe.missingRequiredCount);
  assert.ok(beforeRecipe.optionalIngredients.every((row) => !row.isAvailable));
  assert.ok(afterRecipe.optionalIngredients.every((row) => row.isAvailable));
  assertRecipeMatchesSql(afterRecipe, [firstRequired, ...optionalIds]);
  const optionalOnly = await post({ ingredientIds: optionalIds, limit: 50 });
  assert.equal(optionalOnly.data.some((recipe) => recipe.recipeId === reference.recipeId), false);
});

test('recipes without a matched required ingredient are omitted and no-match requests return an empty page', async () => {
  const body = await post({ ingredientIds: [noMatchId] });
  assert.deepEqual(body.data, []);
  assertPagination(body, { total: 0 });
  const withEgg = await post({ ingredientIds: [eggId], limit: 50 });
  assert.ok(withEgg.data.length > 0 && withEgg.data.length < recipes.length);
  assert.ok(withEgg.data.every((row) => row.matchedRequiredCount > 0 && row.totalRequiredCount > 0));
});

test('rank and tie breakers match an independent oracle over all real SQL Server recipe links', async (context) => {
  const selections = [[eggId], [oilId], [eggId, tomatoId], [eggId, tomatoId, oilId], ingredients.map((row) => row.ingredientId)];
  for (const [index, selected] of selections.entries()) {
    await context.test(`selection ${index + 1}`, async () => {
      const body = await post({ ingredientIds: selected, limit: 50 });
      const expected = expectedScores(selected);
      assertPagination(body, { limit: 50, total: expected.length });
      assert.deepEqual(body.data.map((row) => row.recipeId), expected.map((row) => row.recipeId));
      for (const recipe of body.data) assertRecipeMatchesSql(recipe, selected);
    });
  }
  const allScores = expectedScores(ingredients.map((row) => row.ingredientId));
  assert.equal(allScores.length, recipes.length);
  assert.ok(allScores.every((row) => row.matchPercentage === 100));
  assert.ok(allScores.some((row, index) => index > 0 && allScores[index - 1].totalTime === row.totalTime),
    'Existing seed data must exercise equal percentage, missing count, and total time ties.');
});

test('pagination is stable, keeps full totals beyond the last page, and applies defaults', async () => {
  const selected = ingredients.map((row) => row.ingredientId);
  const expected = expectedScores(selected);
  const defaults = await post({ ingredientIds: selected });
  assertPagination(defaults, { total: expected.length });
  assert.deepEqual(defaults.data.map((row) => row.recipeId), expected.slice(0, 12).map((row) => row.recipeId));
  const collected = [];
  for (let page = 1; page <= Math.ceil(expected.length / 3); page += 1) {
    const body = await post({ ingredientIds: selected, page, limit: 3 });
    assertPagination(body, { page, limit: 3, total: expected.length });
    assert.deepEqual(body.data.map((row) => row.recipeId), expected.slice((page - 1) * 3, page * 3).map((row) => row.recipeId));
    collected.push(...body.data.map((row) => row.recipeId));
  }
  assert.equal(new Set(collected).size, expected.length);
  assert.deepEqual(collected, expected.map((row) => row.recipeId));
  const beyond = await post({ ingredientIds: selected, page: 100_000, limit: 50 });
  assert.deepEqual(beyond.data, []);
  assertPagination(beyond, { page: 100_000, limit: 50, total: expected.length });
});

test('requested servings scale all quantities while retaining original recipe servings and quantities', async (context) => {
  const selected = ingredients.map((row) => row.ingredientId);
  const baseline = await post({ ingredientIds: selected, limit: 50 });
  assert.ok(baseline.data.every((recipe) => recipe.requestedServings === null));
  for (const servings of [1, 5, 20]) {
    await context.test(`${servings} servings`, async () => {
      const body = await post({ ingredientIds: selected, servings, limit: 50 });
      assert.deepEqual(body.pagination, baseline.pagination);
      assert.deepEqual(body.data.map((row) => row.recipeId), baseline.data.map((row) => row.recipeId));
      for (const recipe of body.data) assertRecipeMatchesSql(recipe, selected, servings);
    });
  }
});

test('malformed JSON returns safe HTTP 400', async () => {
  const malformed = await fetch(`${baseUrl}/api/recipes/suggest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"ingredientIds": [',
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(malformed.status, 400);
  const body = await malformed.json();
  assert.deepEqual(Object.keys(body), ['message']);
});

test('a real SQL request timeout in the suggestion service is mapped to safe HTTP 504', { timeout: 15_000 }, async (context) => {
  const testApp = express();
  testApp.use(express.json());
  const log = context.mock.method(console, 'error', () => {});
  let observedError;
  let actualQueries = 0;
  const delayedConnection = {
    request() {
      const request = pool.request({ requestTimeout: 1000 });
      const query = request.query.bind(request);
      request.query = async (statement) => {
        actualQueries += 1;
        try {
          return await query(`WAITFOR DELAY '00:00:03'; ${statement}`);
        } catch (error) { observedError = error; throw error; }
      };
      return request;
    },
  };
  testApp.post('/suggest', async (req, res) => {
    res.json(await suggestRecipes(req.body, { getConnection: async () => delayedConnection }));
  });
  testApp.use(errorHandler);
  const timeoutServer = await listen(testApp);
  try {
    const body = await post({ ingredientIds: [eggId] }, 504, `http://127.0.0.1:${timeoutServer.address().port}/suggest`);
    assert.deepEqual(body, { message: 'Truy vấn cơ sở dữ liệu quá thời gian cho phép. Vui lòng thử lại sau.' });
    assert.equal(actualQueries, 1);
    assert.ok(observedError, 'A real SQL request must fail before HTTP 504 is returned.');
    assert.ok(['EREQUEST', 'ETIMEOUT'].includes(observedError.code));
    assert.doesNotMatch(JSON.stringify(body), /WAITFOR|SELECT |password|stack|HYT00|EREQUEST/i);
    assert.doesNotMatch(JSON.stringify(log.mock.calls.map((call) => call.arguments)), /WAITFOR|SELECT |password|HYT00|EREQUEST/i);
  } finally { await closeServer(timeoutServer); }
});

test('a real unavailable database makes suggestions return HTTP 503 while health remains available', { timeout: 20_000 }, async () => {
  // A separate process targets a nonexistent database; no SQL service is stopped or reconfigured.
  const unavailableName = `SmartCook_SuggestionFailure_${randomUUID().replaceAll('-', '')}`;
  const probe = `
    import { app } from './src/app.js';
    import { closePool } from './src/config/database.js';
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const results = [];
      for (const path of ['/api/health', '/api/recipes/suggest', '/api/health']) {
        const options = path.endsWith('/suggest')
          ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ingredientIds: [1]}) }
          : {};
        const response = await fetch(base + path, {...options, signal: AbortSignal.timeout(10_000)});
        results.push({ status: response.status, body: await response.json() });
      }
      console.log(JSON.stringify(results));
    } finally { await new Promise(resolve => server.close(resolve)); await closePool(); }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', probe], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DB_NAME: unavailableName, DB_CONNECTION_TIMEOUT: '2000' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  child.stderr.resume();
  const timer = setTimeout(() => child.kill(), 15_000);
  try {
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    assert.equal(exitCode, 0, 'Isolated database unavailability probe must exit cleanly.');
    const results = JSON.parse(output.trim());
    assert.deepEqual(results.map((result) => result.status), [200, 503, 200]);
    assert.equal(results[0].body.status, 'ok');
    assert.equal(results[2].body.status, 'ok');
    assert.deepEqual(Object.keys(results[1].body), ['message']);
    assert.equal(typeof results[1].body.message, 'string');
    assert.equal(output.includes(unavailableName), false);
    assert.doesNotMatch(results[1].body.message, /stack|password|driver=|SELECT |login failed/i);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill();
  }
});

test('all existing read APIs still work after suggestion requests', async (context) => {
  const paths = ['/api/health', '/api/health/db', '/api/categories', '/api/ingredients', '/api/recipes', `/api/recipes/${recipes[0].recipeId}`];
  for (const path of paths) {
    await context.test(path, async () => {
      const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(10_000) });
      assert.equal(response.status, 200);
      const body = await response.json();
      if (path.startsWith('/api/health')) assert.equal(body.status, 'ok');
      else assert.ok(body.data);
    });
  }
});

test('all ten database tables retain identical SHA-256 content and row counts after suggestions', async () => {
  assert.deepEqual(await snapshotDatabase(), originalSnapshot);
});
