import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { getPool, closePool, sql } from '../src/config/database.js';

// Read-only SQL QA: table variables in verify.sql are transient, no persistent
// INSERT/UPDATE/DELETE, no constraint/schema changes and no reseeding.
const tables = {
  Users: ['UserID'], Categories: ['CategoryID'], Ingredients: ['IngredientID'], Recipes: ['RecipeID'],
  RecipeIngredients: ['RecipeID', 'IngredientID'], CookingSteps: ['StepID'], Favorites: ['FavoriteID'],
  Reviews: ['ReviewID'], UserIngredients: ['UserIngredientID'], SearchHistory: ['SearchID'],
  MealPlans: ['MealPlanID'], MealPlanItems: ['MealPlanItemID'],
};
const uniqueKeys = {
  UQ_Users_Email: ['Email'], UQ_Categories_CategoryName: ['CategoryName'], UQ_Ingredients_IngredientName: ['IngredientName'],
  UQ_CookingSteps_RecipeID_StepNumber: ['RecipeID', 'StepNumber'], UQ_Favorites_UserID_RecipeID: ['UserID', 'RecipeID'],
  UQ_Reviews_UserID_RecipeID: ['UserID', 'RecipeID'], UQ_UserIngredients_UserID_IngredientID: ['UserID', 'IngredientID'],
  UQ_MealPlans_UserID_WeekStartDate: ['UserID', 'WeekStartDate'],
  UQ_MealPlanItems_Plan_Date_Type_Recipe: ['MealPlanID', 'MealDate', 'MealType', 'RecipeID'],
};
let pool, schema, beforeHash;
async function snapshot() {
  const result = {};
  for (const [table, keys] of Object.entries(tables)) {
    const row = (await pool.request().query(`SELECT (SELECT * FROM dbo.${table} ORDER BY ${keys.join(', ')} FOR JSON PATH, INCLUDE_NULL_VALUES) AS payload;`)).recordset[0];
    result[table] = createHash('sha256').update(row.payload || '[]').digest('hex');
  }
  return result;
}
before(async () => {
  pool = await getPool();
  schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  schema += '\n' + await readFile(new URL('../../database/migrations/001_weekly_meal_planner.sql', import.meta.url), 'utf8');
  beforeHash = await snapshot();
});
after(async () => { try { if (pool) assert.deepEqual(await snapshot(), beforeHash); } finally { await closePool(); } });

test('QA11-DB-01: expected twelve dbo tables each have the correct primary-key columns', async () => {
  const result = await pool.request().query(`SELECT t.name AS tableName, c.name AS columnName, ic.key_ordinal AS ordinal
    FROM sys.tables AS t JOIN sys.key_constraints AS k ON k.parent_object_id = t.object_id AND k.type = 'PK'
    JOIN sys.index_columns AS ic ON ic.object_id = t.object_id AND ic.index_id = k.unique_index_id
    JOIN sys.columns AS c ON c.object_id = t.object_id AND c.column_id = ic.column_id
    WHERE t.schema_id = SCHEMA_ID(N'dbo') ORDER BY t.name, ic.key_ordinal;`);
  for (const [table, columns] of Object.entries(tables)) {
    assert.deepEqual(result.recordset.filter((row) => row.tableName === table).map((row) => row.columnName), columns, table);
  }
});

test('QA11-DB-02: every expected FK is enabled/trusted with NO ACTION and matches declared columns', async () => {
  const expected = [...schema.matchAll(/CONSTRAINT\s+(FK_\w+)\s+FOREIGN KEY\s*\((\w+)\)\s+REFERENCES dbo\.(\w+)\((\w+)\)/gu)];
  assert.equal(expected.length, 15);
  const result = await pool.request().query(`SELECT fk.name, fk.is_disabled AS disabled, fk.is_not_trusted AS untrusted,
    fk.delete_referential_action AS onDelete, fk.update_referential_action AS onUpdate,
    pc.name AS childColumn, rt.name AS parentTable, rc.name AS parentColumn
    FROM sys.foreign_keys AS fk JOIN sys.foreign_key_columns AS fc ON fc.constraint_object_id = fk.object_id
    JOIN sys.columns AS pc ON pc.object_id = fc.parent_object_id AND pc.column_id = fc.parent_column_id
    JOIN sys.tables AS rt ON rt.object_id = fc.referenced_object_id
    JOIN sys.columns AS rc ON rc.object_id = fc.referenced_object_id AND rc.column_id = fc.referenced_column_id
    WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = N'dbo';`);
  for (const [, name, childColumn, parentTable, parentColumn] of expected) {
    const row = result.recordset.find((item) => item.name === name);
    assert.ok(row, name);
    assert.equal(Boolean(row.disabled || row.untrusted), false, name);
    assert.equal(Number(row.onDelete) + Number(row.onUpdate), 0, name);
    assert.deepEqual([row.childColumn, row.parentTable, row.parentColumn], [childColumn, parentTable, parentColumn]);
  }
});

test('QA11-DB-03: expected UNIQUE indexes are enabled, unfiltered and use correct ordered columns', async () => {
  const result = await pool.request().query(`SELECT k.name, c.name AS columnName, ic.key_ordinal AS ordinal,
    i.is_unique AS isUnique, i.is_disabled AS disabled, i.has_filter AS filtered
    FROM sys.key_constraints AS k JOIN sys.indexes AS i ON i.object_id = k.parent_object_id AND i.index_id = k.unique_index_id
    JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE k.type = 'UQ' AND OBJECT_SCHEMA_NAME(k.parent_object_id) = N'dbo' ORDER BY k.name, ic.key_ordinal;`);
  for (const [name, columns] of Object.entries(uniqueKeys)) {
    const rows = result.recordset.filter((row) => row.name === name);
    assert.deepEqual(rows.map((row) => row.columnName), columns, name);
    assert.equal(rows.every((row) => row.isUnique && !row.disabled && !row.filtered), true, name);
  }
});

test('QA11-DB-04: all named CHECK constraints from schema exist and remain trusted/enabled', async () => {
  const expected = new Set([...schema.matchAll(/CONSTRAINT\s+(CK_\w+)\s+CHECK/gu)].map((match) => match[1]));
  assert.ok(expected.size > 0);
  const result = await pool.request().query(`SELECT name, is_disabled AS disabled, is_not_trusted AS untrusted
    FROM sys.check_constraints WHERE OBJECT_SCHEMA_NAME(parent_object_id) = N'dbo';`);
  for (const name of expected) {
    const row = result.recordset.find((item) => item.name === name);
    assert.ok(row, name); assert.equal(Boolean(row.disabled || row.untrusted), false, name);
  }
});

test('QA11-DB-05: individual DBCC checks report no current CHECK/FK violations without changing constraints', async () => {
  // The database-wide DBCC query hits a CASE/DISTINCT collation conflict on
  // this instance's mixed Vietnamese/Latin columns. Check EVERY constraint
  // separately (supported DBCC syntax), retaining all checks and SQL collations.
  // The failed global diagnostic remains recorded in the Step11 report.
  const constraints = (await pool.request().query(`SELECT object_id AS id FROM sys.check_constraints WHERE OBJECT_SCHEMA_NAME(parent_object_id) = N'dbo'
    UNION ALL SELECT object_id FROM sys.foreign_keys WHERE OBJECT_SCHEMA_NAME(parent_object_id) = N'dbo';`)).recordset;
  assert.ok(constraints.length >= 12);
  for (const constraint of constraints) {
    const id = Number(constraint.id);
    assert.ok(Number.isSafeInteger(id) && id > 0);
    const result = await pool.request().query(`DBCC CHECKCONSTRAINTS (${id}) WITH ALL_ERRORMSGS, NO_INFOMSGS;`);
    assert.deepEqual(result.recordset || [], [], `Constraint ${id}`);
  }
});

test('QA11-DB-06: all current recipes have required ingredients and contiguous cooking steps', async () => {
  const result = await pool.request().query(`SELECT r.RecipeID FROM dbo.Recipes AS r
    WHERE NOT EXISTS (SELECT 1 FROM dbo.RecipeIngredients AS ri WHERE ri.RecipeID = r.RecipeID AND ri.IsRequired = 1)
      OR NOT EXISTS (SELECT 1 FROM dbo.CookingSteps AS s WHERE s.RecipeID = r.RecipeID);
    WITH Steps AS (SELECT StepNumber, ROW_NUMBER() OVER (PARTITION BY RecipeID ORDER BY StepNumber) AS expected FROM dbo.CookingSteps)
      SELECT StepNumber FROM Steps WHERE StepNumber <> expected;`);
  assert.deepEqual(result.recordsets, [[], []]);
});

test('QA11-DB-07: existing read-only verify.sql executes against SmartCookDB successfully', async () => {
  const script = await readFile(new URL('../../database/verify.sql', import.meta.url), 'utf8');
  const result = await pool.request().query(script.replace(/^\uFEFF/u, '').replace(/^\s*GO\s*$/gmu, ''));
  const counts = result.recordsets[0];
  assert.equal(counts.length, 12);
  assert.equal(counts.every((row) => Object.hasOwn(tables, row.TableName)), true);
});

test('QA11-DB-08: an aggregate write across user-owned tables is rolled back without changing seed data', async () => {
  const transaction = new sql.Transaction(pool);
  let started = false;
  const email = `qa11-rollback-${randomUUID()}@invalid.test`;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    started = true;

    const user = (await transaction.request()
      .input('fullName', sql.NVarChar(150), 'QA11 Transaction Rollback')
      .input('email', sql.NVarChar(255), email)
      .input('passwordHash', sql.NVarChar(255), 'qa11-transaction-only-not-a-login-secret')
      .query(`INSERT INTO dbo.Users (FullName, Email, PasswordHash, Role)
        OUTPUT INSERTED.UserID
        VALUES (@fullName, @email, @passwordHash, N'User');`)).recordset[0];
    const userId = Number(user.UserID);
    assert.ok(Number.isSafeInteger(userId) && userId > 0);

    const recipe = (await transaction.request().query(`SELECT TOP (1) RecipeID FROM dbo.Recipes ORDER BY RecipeID;`)).recordset[0];
    const ingredient = (await transaction.request().query(`SELECT TOP (1) IngredientID FROM dbo.Ingredients ORDER BY IngredientID;`)).recordset[0];
    const recipeId = Number(recipe.RecipeID);
    const ingredientId = Number(ingredient.IngredientID);
    assert.ok(Number.isSafeInteger(recipeId) && recipeId > 0);
    assert.ok(Number.isSafeInteger(ingredientId) && ingredientId > 0);

    await transaction.request()
      .input('userId', sql.Int, userId)
      .input('recipeId', sql.Int, recipeId)
      .input('ingredientId', sql.Int, ingredientId)
      .query(`INSERT INTO dbo.Favorites (UserID, RecipeID) VALUES (@userId, @recipeId);
        INSERT INTO dbo.Reviews (UserID, RecipeID, Rating, Comment) VALUES (@userId, @recipeId, 5, N'QA11 transaction-only review');
        INSERT INTO dbo.UserIngredients (UserID, IngredientID, Quantity, Unit) VALUES (@userId, @ingredientId, 1.00, N'phần');
        INSERT INTO dbo.SearchHistory (UserID, SearchKeyword) VALUES (@userId, N'QA11 transaction rollback');`);

    const created = await transaction.request()
      .input('userId', sql.Int, userId)
      .query(`SELECT
        (SELECT COUNT_BIG(*) FROM dbo.Favorites WHERE UserID = @userId) AS Favorites,
        (SELECT COUNT_BIG(*) FROM dbo.Reviews WHERE UserID = @userId) AS Reviews,
        (SELECT COUNT_BIG(*) FROM dbo.UserIngredients WHERE UserID = @userId) AS UserIngredients,
        (SELECT COUNT_BIG(*) FROM dbo.SearchHistory WHERE UserID = @userId) AS SearchHistory;`);
    assert.deepEqual(Object.fromEntries(Object.entries(created.recordset[0]).map(([key, value]) => [key, Number(value)])), {
      Favorites: 1, Reviews: 1, UserIngredients: 1, SearchHistory: 1,
    });
  } finally {
    if (started) await transaction.rollback();
  }

  assert.deepEqual(await snapshot(), beforeHash);
});
