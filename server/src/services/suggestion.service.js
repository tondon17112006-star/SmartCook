import { getPool, sql } from '../config/database.js';
import { HttpError } from '../utilities/http-error.js';
import { createPagination } from '../utilities/query.js';
import { validateSuggestionBody } from '../utilities/suggestion-validator.js';
import { buildSuggestion } from './suggestion-matcher.js';

// SQL fragments are constants. IDs travel only in bound NVARCHAR JSON parameters.
const candidateCte = `
  WITH SelectedIngredients AS (
    SELECT CONVERT(INT, [value]) AS IngredientID
    FROM OPENJSON(@ingredientIds)
  ), RequiredCounts AS (
    SELECT ri.RecipeID,
           COUNT_BIG(*) AS totalRequiredCount,
           SUM(CONVERT(BIGINT, CASE WHEN selected.IngredientID IS NOT NULL THEN 1 ELSE 0 END)) AS matchedRequiredCount
    FROM dbo.RecipeIngredients AS ri
    LEFT JOIN SelectedIngredients AS selected ON selected.IngredientID = ri.IngredientID
    WHERE ri.IsRequired = 1
    GROUP BY ri.RecipeID
  ), Candidates AS (
    SELECT r.RecipeID AS recipeId,
           r.RecipeName AS recipeName,
           r.Description AS description,
           r.ImageUrl AS imageUrl,
           r.PrepTime AS prepTime,
           r.CookTime AS cookTime,
           CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) AS totalTime,
           r.Servings AS servings,
           r.Difficulty AS difficulty,
           c.CategoryName AS categoryName,
           counts.totalRequiredCount,
           counts.matchedRequiredCount,
           counts.totalRequiredCount - counts.matchedRequiredCount AS missingRequiredCount,
           -- Exact positive integer rounding: floor((200*m + n)/(2*n)).
           CONVERT(INT, (CONVERT(BIGINT, 200) * counts.matchedRequiredCount + counts.totalRequiredCount)
             / (CONVERT(BIGINT, 2) * NULLIF(counts.totalRequiredCount, 0))) AS matchPercentage
    FROM dbo.Recipes AS r
    INNER JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
    INNER JOIN RequiredCounts AS counts ON counts.RecipeID = r.RecipeID
    WHERE counts.totalRequiredCount > 0 AND counts.matchedRequiredCount > 0
  )
`;

export async function suggestRecipes(body, { getConnection = getPool } = {}) {
  const input = validateSuggestionBody(body);
  const pool = await getConnection();
  const ingredientJson = JSON.stringify(input.ingredientIds);

  const existing = await pool.request()
    .input('ingredientIds', sql.NVarChar(sql.MAX), ingredientJson)
    .query(`
      SELECT i.IngredientID AS ingredientId
      FROM dbo.Ingredients AS i
      INNER JOIN OPENJSON(@ingredientIds) AS selected
        ON i.IngredientID = CONVERT(INT, selected.[value]);
    `);
  const existingIds = new Set(existing.recordset.map((row) => Number(row.ingredientId)));
  if (input.ingredientIds.some((id) => !existingIds.has(id))) {
    throw new HttpError(400, 'Danh sách chứa nguyên liệu không tồn tại. Vui lòng chọn lại.');
  }

  const result = await pool.request()
    .input('ingredientIds', sql.NVarChar(sql.MAX), ingredientJson)
    .input('offset', sql.Int, input.offset)
    .input('limit', sql.Int, input.limit)
    .query(`
      ${candidateCte}
      SELECT COUNT_BIG(*) AS total FROM Candidates;

      ${candidateCte}
      SELECT * FROM Candidates
      ORDER BY matchPercentage DESC, missingRequiredCount ASC,
               totalTime ASC, recipeId ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `);

  const pagination = createPagination(input, Number(result.recordsets[0][0].total));
  const recipes = result.recordsets[1];
  if (recipes.length === 0) return { data: [], pagination };

  // One bulk read for the page, never one ingredient query per recipe.
  const pageIds = recipes.map((recipe) => Number(recipe.recipeId));
  const ingredients = await pool.request()
    .input('recipeIds', sql.NVarChar(sql.MAX), JSON.stringify(pageIds))
    .query(`
      SELECT ri.RecipeID AS recipeId,
             i.IngredientID AS ingredientId,
             i.IngredientName AS ingredientName,
             ri.Quantity AS quantity,
             ri.Unit AS unit,
             ri.IsRequired AS isRequired,
             ri.Notes AS notes
      FROM dbo.RecipeIngredients AS ri
      INNER JOIN dbo.Ingredients AS i ON i.IngredientID = ri.IngredientID
      INNER JOIN OPENJSON(@recipeIds) AS selected
        ON ri.RecipeID = CONVERT(INT, selected.[value])
      ORDER BY ri.RecipeID ASC, i.IngredientName ASC, i.IngredientID ASC;
    `);

  const byRecipe = new Map();
  for (const ingredient of ingredients.recordset) {
    const recipeId = Number(ingredient.recipeId);
    if (!byRecipe.has(recipeId)) byRecipe.set(recipeId, []);
    byRecipe.get(recipeId).push(ingredient);
  }
  const selectedIds = new Set(input.ingredientIds);
  const data = recipes.map((recipe) => buildSuggestion(
    recipe, byRecipe.get(Number(recipe.recipeId)) || [], selectedIds, input.servings,
  )).filter((recipe) => recipe !== null);

  return { data, pagination };
}
