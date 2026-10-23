import { getPool } from '../config/database.js';

export async function getCategories() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT CategoryID AS categoryId,
           CategoryName AS categoryName,
           Description AS description,
           ImageUrl AS imageUrl
    FROM dbo.Categories
    ORDER BY CategoryName ASC, CategoryID ASC;
  `);

  return {
    data: result.recordset.map((category) => ({
      ...category,
      categoryId: Number(category.categoryId),
    })),
  };
}
