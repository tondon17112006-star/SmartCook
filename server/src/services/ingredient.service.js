import { getPool, sql } from '../config/database.js';
import {
  createPagination,
  escapeLike,
  parsePagination,
  readSearch,
  readString,
} from '../utilities/query.js';

export async function getIngredients(query = {}) {
  const search = readSearch(query);
  const ingredientCategory = readString(query.ingredientCategory, 'ingredientCategory', {
    maxLength: 100,
  });
  const pagination = parsePagination(query);

  const pool = await getPool();
  const request = pool.request()
    .input('search', sql.NVarChar(302), search ? `%${escapeLike(search)}%` : null)
    .input('ingredientCategory', sql.NVarChar(100), ingredientCategory || null)
    .input('offset', sql.Int, pagination.offset)
    .input('limit', sql.Int, pagination.limit);

  // Both statements use the same parameters and filters, including empty result pages.
  const where = `
    WHERE (@search IS NULL OR IngredientName LIKE @search ESCAPE N'~')
      AND (@ingredientCategory IS NULL OR IngredientCategory = @ingredientCategory)
  `;
  const result = await request.query(`
    SELECT COUNT(*) AS total
    FROM dbo.Ingredients
    ${where};

    SELECT IngredientID AS ingredientId,
           IngredientName AS ingredientName,
           IngredientCategory AS ingredientCategory,
           DefaultUnit AS defaultUnit,
           ImageUrl AS imageUrl
    FROM dbo.Ingredients
    ${where}
    ORDER BY IngredientName ASC, IngredientID ASC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);

  return {
    data: result.recordsets[1].map((ingredient) => ({
      ...ingredient,
      ingredientId: Number(ingredient.ingredientId),
    })),
    pagination: createPagination(pagination, Number(result.recordsets[0][0].total)),
  };
}
