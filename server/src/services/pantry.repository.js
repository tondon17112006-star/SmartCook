import { getPool, sql } from '../config/database.js';

const pantryColumns = `p.UserIngredientID AS userIngredientId, p.IngredientID AS ingredientId,
  i.IngredientName AS ingredientName, i.IngredientCategory AS ingredientCategory,
  i.DefaultUnit AS defaultUnit, i.ImageUrl AS imageUrl, p.Quantity AS quantity, p.Unit AS unit,
  CONVERT(CHAR(10), p.ExpiryDate, 23) AS expiryDate`;

function normalizePantryItem(row) {
  if (!row) return null;
  return {
    userIngredientId: Number(row.userIngredientId), ingredientId: Number(row.ingredientId),
    ingredientName: row.ingredientName, ingredientCategory: row.ingredientCategory,
    defaultUnit: row.defaultUnit, imageUrl: row.imageUrl ?? null,
    quantity: row.quantity == null ? null : Number(row.quantity), unit: row.unit ?? null,
    expiryDate: row.expiryDate ?? null,
  };
}

function bindChanges(query, changes) {
  const assignments = [];
  if (Object.hasOwn(changes, 'quantity')) {
    query.input('quantity', sql.Decimal(12, 2), changes.quantity);
    assignments.push('Quantity = @quantity');
  }
  if (Object.hasOwn(changes, 'unit')) {
    query.input('unit', sql.NVarChar(30), changes.unit);
    assignments.push('Unit = @unit');
  }
  if (Object.hasOwn(changes, 'expiryDate')) {
    // Bind the canonical date as text then convert explicitly, avoiding JS Date/timezone drift.
    query.input('expiryDate', sql.VarChar(10), changes.expiryDate);
    assignments.push('ExpiryDate = CONVERT(DATE, @expiryDate, 23)');
  }
  return assignments;
}

export function createPantryRepository({ request = async () => (await getPool()).request() } = {}) {
  return {
    async ingredientExists(ingredientId) {
      const query = await request();
      query.input('ingredientId', sql.Int, ingredientId);
      const result = await query.query('SELECT IngredientID FROM dbo.Ingredients WHERE IngredientID = @ingredientId;');
      return result.recordset.length > 0;
    },
    async list(userId, { offset, limit }) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('offset', sql.Int, offset);
      query.input('limit', sql.Int, limit);
      const result = await query.query(`
        SELECT COUNT_BIG(*) AS total FROM dbo.UserIngredients WHERE UserID = @userId;
        SELECT ${pantryColumns} FROM dbo.UserIngredients AS p
        INNER JOIN dbo.Ingredients AS i ON i.IngredientID = p.IngredientID
        WHERE p.UserID = @userId
        ORDER BY i.IngredientName ASC, p.UserIngredientID ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `);
      return { data: result.recordsets[1].map(normalizePantryItem), total: Number(result.recordsets[0][0].total) };
    },
    async findById(userId, id) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('id', sql.Int, id);
      const result = await query.query(`SELECT ${pantryColumns} FROM dbo.UserIngredients AS p
        INNER JOIN dbo.Ingredients AS i ON i.IngredientID = p.IngredientID
        WHERE p.UserID = @userId AND p.UserIngredientID = @id;`);
      return normalizePantryItem(result.recordset[0]);
    },
    async findByIngredient(userId, ingredientId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('ingredientId', sql.Int, ingredientId);
      const result = await query.query(`SELECT ${pantryColumns} FROM dbo.UserIngredients AS p
        INNER JOIN dbo.Ingredients AS i ON i.IngredientID = p.IngredientID
        WHERE p.UserID = @userId AND p.IngredientID = @ingredientId;`);
      return normalizePantryItem(result.recordset[0]);
    },
    async create(userId, input) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('ingredientId', sql.Int, input.ingredientId);
      bindChanges(query, input);
      const result = await query.query(`
        DECLARE @created TABLE (UserIngredientID INT NOT NULL);
        INSERT INTO dbo.UserIngredients (UserID, IngredientID, Quantity, Unit, ExpiryDate)
        OUTPUT INSERTED.UserIngredientID INTO @created (UserIngredientID)
        VALUES (@userId, @ingredientId, @quantity, @unit, CONVERT(DATE, @expiryDate, 23));
        SELECT ${pantryColumns} FROM dbo.UserIngredients AS p
        INNER JOIN @created AS created ON created.UserIngredientID = p.UserIngredientID
        INNER JOIN dbo.Ingredients AS i ON i.IngredientID = p.IngredientID;
      `);
      return normalizePantryItem(result.recordset[0]);
    },
    async update(userId, id, changes) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('id', sql.Int, id);
      const assignments = bindChanges(query, changes);
      const result = await query.query(`
        DECLARE @changed TABLE (UserIngredientID INT NOT NULL);
        UPDATE dbo.UserIngredients SET ${assignments.join(', ')}
        OUTPUT INSERTED.UserIngredientID INTO @changed (UserIngredientID)
        WHERE UserID = @userId AND UserIngredientID = @id;
        SELECT ${pantryColumns} FROM dbo.UserIngredients AS p
        INNER JOIN @changed AS changed ON changed.UserIngredientID = p.UserIngredientID
        INNER JOIN dbo.Ingredients AS i ON i.IngredientID = p.IngredientID;
      `);
      return normalizePantryItem(result.recordset[0]);
    },
    async remove(userId, id) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('id', sql.Int, id);
      const result = await query.query(`DELETE FROM dbo.UserIngredients OUTPUT DELETED.UserIngredientID
        WHERE UserID = @userId AND UserIngredientID = @id;`);
      return result.recordset.length > 0;
    },
  };
}
