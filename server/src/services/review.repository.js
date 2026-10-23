import { getPool, sql } from '../config/database.js';

const reviewColumns = `r.ReviewID AS reviewId, r.RecipeID AS recipeId, r.UserID AS userId,
  u.FullName AS fullName, r.Rating AS rating, r.Comment AS comment, r.CreatedAt AS createdAt`;

function normalizeReview(row) {
  if (!row) return null;
  return {
    reviewId: Number(row.reviewId), recipeId: Number(row.recipeId), userId: Number(row.userId),
    fullName: row.fullName, rating: Number(row.rating), comment: row.comment ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export function createReviewRepository({ request = async () => (await getPool()).request() } = {}) {
  return {
    async recipeExists(recipeId) {
      const query = await request();
      query.input('recipeId', sql.Int, recipeId);
      const result = await query.query('SELECT RecipeID FROM dbo.Recipes WHERE RecipeID = @recipeId;');
      return result.recordset.length > 0;
    },
    async list(recipeId, { offset, limit }) {
      const query = await request();
      query.input('recipeId', sql.Int, recipeId);
      query.input('offset', sql.Int, offset);
      query.input('limit', sql.Int, limit);
      const result = await query.query(`
        SELECT COUNT_BIG(*) AS total, AVG(CONVERT(DECIMAL(10,4), Rating)) AS averageRating
        FROM dbo.Reviews WHERE RecipeID = @recipeId;
        SELECT ${reviewColumns} FROM dbo.Reviews AS r
        INNER JOIN dbo.Users AS u ON u.UserID = r.UserID
        WHERE r.RecipeID = @recipeId
        ORDER BY r.CreatedAt DESC, r.ReviewID DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `);
      return {
        data: result.recordsets[1].map(normalizeReview), total: Number(result.recordsets[0][0].total),
        averageRating: Number(result.recordsets[0][0].averageRating ?? 0),
      };
    },
    async findMine(userId, recipeId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('recipeId', sql.Int, recipeId);
      const result = await query.query(`SELECT ${reviewColumns} FROM dbo.Reviews AS r
        INNER JOIN dbo.Users AS u ON u.UserID = r.UserID
        WHERE r.UserID = @userId AND r.RecipeID = @recipeId;`);
      return normalizeReview(result.recordset[0]);
    },
    async create(userId, recipeId, { rating, comment }) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('recipeId', sql.Int, recipeId);
      query.input('rating', sql.Int, rating);
      query.input('comment', sql.NVarChar(2000), comment);
      const result = await query.query(`
        DECLARE @created TABLE (ReviewID INT NOT NULL);
        INSERT INTO dbo.Reviews (UserID, RecipeID, Rating, Comment)
        OUTPUT INSERTED.ReviewID INTO @created (ReviewID)
        VALUES (@userId, @recipeId, @rating, @comment);
        SELECT ${reviewColumns} FROM dbo.Reviews AS r
        INNER JOIN @created AS created ON created.ReviewID = r.ReviewID
        INNER JOIN dbo.Users AS u ON u.UserID = r.UserID;
      `);
      return normalizeReview(result.recordset[0]);
    },
    async update(userId, reviewId, changes) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('reviewId', sql.Int, reviewId);
      const assignments = [];
      if (Object.hasOwn(changes, 'rating')) {
        query.input('rating', sql.Int, changes.rating);
        assignments.push('Rating = @rating');
      }
      if (Object.hasOwn(changes, 'comment')) {
        query.input('comment', sql.NVarChar(2000), changes.comment);
        assignments.push('Comment = @comment');
      }
      const result = await query.query(`
        DECLARE @changed TABLE (ReviewID INT NOT NULL);
        UPDATE dbo.Reviews SET ${assignments.join(', ')}
        OUTPUT INSERTED.ReviewID INTO @changed (ReviewID)
        WHERE UserID = @userId AND ReviewID = @reviewId;
        SELECT ${reviewColumns} FROM dbo.Reviews AS r
        INNER JOIN @changed AS changed ON changed.ReviewID = r.ReviewID
        INNER JOIN dbo.Users AS u ON u.UserID = r.UserID;
      `);
      return normalizeReview(result.recordset[0]);
    },
    async remove(userId, reviewId) {
      const query = await request();
      query.input('userId', sql.Int, userId);
      query.input('reviewId', sql.Int, reviewId);
      const result = await query.query(`DELETE FROM dbo.Reviews OUTPUT DELETED.ReviewID
        WHERE UserID = @userId AND ReviewID = @reviewId;`);
      return result.recordset.length > 0;
    },
  };
}
