import { getPool, sql } from '../config/database.js';

function normalizeFavorite(row) {
  if (!row) return null;
  return {
    favoriteId: Number(row.favoriteId), recipeId: Number(row.recipeId),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

function normalizeCard(row) {
  return {
    ...normalizeFavorite(row), recipeName: row.recipeName,
    description: row.description ?? null, imageUrl: row.imageUrl ?? null,
    prepTime: Number(row.prepTime), cookTime: Number(row.cookTime), totalTime: Number(row.totalTime),
    servings: Number(row.servings), difficulty: row.difficulty, categoryName: row.categoryName,
  };
}

// Every statement is scoped by the authenticated SQL user; values are bound parameters.
// An injectable request factory also supports real SQL tests inside rollback transactions.
export function createFavoriteRepository({ request = async () => (await getPool()).request() } = {}) {
  return {
    async list(userId, { offset, limit }) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('offset', sql.Int, offset);
      query.input('limit', sql.Int, limit);
      const result = await query.query(`
        SELECT COUNT_BIG(*) AS total FROM dbo.Favorites WHERE UserID = @userId;
        SELECT f.FavoriteID AS favoriteId, f.CreatedAt AS createdAt,
          r.RecipeID AS recipeId, r.RecipeName AS recipeName, r.Description AS description,
          r.ImageUrl AS imageUrl, r.PrepTime AS prepTime, r.CookTime AS cookTime,
          CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) AS totalTime,
          r.Servings AS servings, r.Difficulty AS difficulty, c.CategoryName AS categoryName
        FROM dbo.Favorites AS f
        INNER JOIN dbo.Recipes AS r ON r.RecipeID = f.RecipeID
        INNER JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
        WHERE f.UserID = @userId
        ORDER BY f.CreatedAt DESC, f.FavoriteID DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `);
      return { data: result.recordsets[1].map(normalizeCard), total: Number(result.recordsets[0][0].total) };
    },
    async listIds(userId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      const result = await query.query(`SELECT RecipeID AS recipeId FROM dbo.Favorites
        WHERE UserID = @userId ORDER BY CreatedAt DESC, FavoriteID DESC;`);
      return result.recordset.map((row) => Number(row.recipeId));
    },
    async recipeExists(recipeId) {
      const query = await request();
      query.input('recipeId', sql.Int, recipeId);
      const result = await query.query('SELECT RecipeID FROM dbo.Recipes WHERE RecipeID = @recipeId;');
      return result.recordset.length > 0;
    },
    async find(userId, recipeId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('recipeId', sql.Int, recipeId);
      const result = await query.query(`SELECT FavoriteID AS favoriteId, RecipeID AS recipeId, CreatedAt AS createdAt
        FROM dbo.Favorites WHERE UserID = @userId AND RecipeID = @recipeId;`);
      return normalizeFavorite(result.recordset[0]);
    },
    async create(userId, recipeId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('recipeId', sql.Int, recipeId);
      const result = await query.query(`INSERT INTO dbo.Favorites (UserID, RecipeID)
        OUTPUT INSERTED.FavoriteID AS favoriteId, INSERTED.RecipeID AS recipeId, INSERTED.CreatedAt AS createdAt
        VALUES (@userId, @recipeId);`);
      return normalizeFavorite(result.recordset[0]);
    },
    async remove(userId, recipeId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('recipeId', sql.Int, recipeId);
      const result = await query.query(`DELETE FROM dbo.Favorites
        OUTPUT DELETED.FavoriteID AS favoriteId WHERE UserID = @userId AND RecipeID = @recipeId;`);
      return result.recordset.length > 0;
    },
  };
}
