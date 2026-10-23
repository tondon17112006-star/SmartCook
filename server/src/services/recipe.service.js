import { getPool, sql } from '../config/database.js';
import { HttpError } from '../utilities/http-error.js';
import {
  createPagination,
  escapeLike,
  parsePagination,
  readPositiveInt,
  readSearch,
  readString,
} from '../utilities/query.js';

// Only these constant SQL fragments may be used in ORDER BY.
const sortOrders = new Map([
  ['newest', 'r.CreatedAt DESC, r.RecipeID DESC'],
  ['name_asc', 'r.RecipeName ASC, r.RecipeID ASC'],
  ['name_desc', 'r.RecipeName DESC, r.RecipeID DESC'],
  ['time_asc', 'CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) ASC, r.RecipeID ASC'],
  ['time_desc', 'CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) DESC, r.RecipeID DESC'],
]);
const difficulties = new Set(['Dễ', 'Trung bình', 'Khó']);

const recipeColumns = `
  r.RecipeID AS recipeId,
  r.RecipeName AS recipeName,
  r.Description AS description,
  r.ImageUrl AS imageUrl,
  r.PrepTime AS prepTime,
  r.CookTime AS cookTime,
  CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) AS totalTime,
  r.Servings AS servings,
  r.Difficulty AS difficulty,
  c.CategoryName AS categoryName`;

function normalizeRecipe(row) {
  // Two nonnegative SQL INT times have a sum that is safe as a JS number.
  // The native driver can expose IDENTITY columns as strings.
  return {
    ...row,
    recipeId: Number(row.recipeId),
    prepTime: Number(row.prepTime),
    cookTime: Number(row.cookTime),
    totalTime: Number(row.totalTime),
    servings: Number(row.servings),
  };
}

export async function listRecipes(query, { getConnection = getPool } = {}) {
  const pagination = parsePagination(query);
  const search = readSearch(query);
  const categoryId = query.categoryId === undefined
    ? undefined
    : readPositiveInt(query.categoryId, 'categoryId');
  const maxTime = query.maxTime === undefined
    ? undefined
    : readPositiveInt(query.maxTime, 'maxTime');
  const difficulty = readString(query.difficulty, 'difficulty', { maxLength: 30 });
  if (query.difficulty !== undefined && !difficulties.has(difficulty)) {
    throw new HttpError(400, 'difficulty phải là Dễ, Trung bình hoặc Khó.');
  }
  const sort = readString(query.sort, 'sort', { maxLength: 20, defaultValue: 'newest' });
  if (!sortOrders.has(sort)) {
    throw new HttpError(400, 'sort phải là newest, name_asc, name_desc, time_asc hoặc time_desc.');
  }

  const pool = await getConnection();
  const request = pool.request();
  const conditions = [];
  if (search) {
    conditions.push("r.RecipeName LIKE @search ESCAPE N'~'");
    request.input('search', sql.NVarChar(302), `%${escapeLike(search)}%`);
  }
  if (categoryId !== undefined) {
    conditions.push('r.CategoryID = @categoryId');
    request.input('categoryId', sql.Int, categoryId);
  }
  if (maxTime !== undefined) {
    conditions.push('CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) <= @maxTime');
    request.input('maxTime', sql.Int, maxTime);
  }
  if (difficulty) {
    conditions.push('r.Difficulty = @difficulty');
    request.input('difficulty', sql.NVarChar(30), difficulty);
  }
  request.input('offset', sql.Int, pagination.offset);
  request.input('limit', sql.Int, pagination.limit);

  // The fragments below are internal constants; user values are bound parameters.
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await request.query(`
    SELECT COUNT_BIG(*) AS total
    FROM dbo.Recipes AS r
    ${where};

    SELECT ${recipeColumns}
    FROM dbo.Recipes AS r
    INNER JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
    ${where}
    ORDER BY ${sortOrders.get(sort)}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);

  return {
    data: result.recordsets[1].map(normalizeRecipe),
    pagination: createPagination(pagination, Number(result.recordsets[0][0].total)),
  };
}

export async function getRecipeById(id, { getConnection = getPool } = {}) {
  const recipeId = readPositiveInt(id, 'id');
  const pool = await getConnection();
  const result = await pool.request()
    .input('recipeId', sql.Int, recipeId)
    .query(`
      SELECT ${recipeColumns},
        c.CategoryID AS categoryId,
        c.Description AS categoryDescription,
        c.ImageUrl AS categoryImageUrl
      FROM dbo.Recipes AS r
      INNER JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
      WHERE r.RecipeID = @recipeId;

      SELECT
        i.IngredientID AS ingredientId,
        i.IngredientName AS ingredientName,
        i.IngredientCategory AS ingredientCategory,
        i.DefaultUnit AS defaultUnit,
        i.ImageUrl AS imageUrl,
        ri.Quantity AS quantity,
        ri.Unit AS unit,
        ri.IsRequired AS isRequired,
        ri.Notes AS notes
      FROM dbo.RecipeIngredients AS ri
      INNER JOIN dbo.Ingredients AS i ON i.IngredientID = ri.IngredientID
      WHERE ri.RecipeID = @recipeId
      ORDER BY i.IngredientName ASC, i.IngredientID ASC;

      SELECT
        StepID AS stepId,
        StepNumber AS stepNumber,
        Instruction AS instruction,
        ImageUrl AS imageUrl
      FROM dbo.CookingSteps
      WHERE RecipeID = @recipeId
      ORDER BY StepNumber ASC;
    `);

  const row = result.recordsets[0][0];
  if (!row) {
    throw new HttpError(404, 'Không tìm thấy món ăn.');
  }
  const { categoryId, categoryDescription, categoryImageUrl, ...recipe } = row;

  return {
    data: {
      ...normalizeRecipe(recipe),
      category: {
        categoryId: Number(categoryId),
        categoryName: recipe.categoryName,
        description: categoryDescription,
        imageUrl: categoryImageUrl,
      },
      ingredients: result.recordsets[1].map((ingredient) => ({
        ...ingredient,
        ingredientId: Number(ingredient.ingredientId),
        quantity: Number(ingredient.quantity),
        isRequired: Boolean(ingredient.isRequired),
      })),
      steps: result.recordsets[2].map((step) => ({
        ...step,
        stepId: Number(step.stepId),
        stepNumber: Number(step.stepNumber),
      })),
    },
  };
}
