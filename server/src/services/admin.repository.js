import { getPool, sql } from '../config/database.js';
import { HttpError } from '../utilities/http-error.js';
import { escapeLike } from '../utilities/query.js';
import { adminRecipeSorts, validateRecipeState } from '../utilities/admin-validation.js';

const recipeColumns = `r.RecipeID AS recipeId, r.RecipeName AS recipeName, r.CategoryID AS categoryId,
  c.CategoryName AS categoryName, r.Description AS description, r.ImageUrl AS imageUrl,
  r.PrepTime AS prepTime, r.CookTime AS cookTime,
  CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) AS totalTime,
  r.Servings AS servings, r.Difficulty AS difficulty, r.CreatedAt AS createdAt, r.UpdatedAt AS updatedAt`;
const categoryColumns = 'CategoryID AS categoryId, CategoryName AS categoryName, Description AS description, ImageUrl AS imageUrl';
const ingredientColumns = 'IngredientID AS ingredientId, IngredientName AS ingredientName, IngredientCategory AS ingredientCategory, DefaultUnit AS defaultUnit, ImageUrl AS imageUrl';
const userColumns = 'UserID AS userId, FullName AS fullName, Email AS email, Phone AS phone, Avatar AS avatar, Role AS role, CreatedAt AS createdAt';

function numbers(row, fields) {
  if (!row) return null;
  const output = { ...row };
  for (const field of fields) if (Object.hasOwn(output, field)) output[field] = Number(output[field]);
  return output;
}
const normalizeRecipe = (row) => numbers(row, ['recipeId', 'categoryId', 'prepTime', 'cookTime', 'totalTime', 'servings']);
const normalizeCategory = (row) => numbers(row, ['categoryId', 'recipeCount']);
const normalizeIngredient = (row) => numbers(row, ['ingredientId', 'recipeCount', 'pantryCount']);
function normalizeUser(row) {
  if (!row) return null;
  // Explicit DTO remains safe even if a future SELECT accidentally contains a hash.
  return { userId: Number(row.userId), fullName: row.fullName, email: row.email, phone: row.phone ?? null,
    avatar: row.avatar ?? null, role: row.role, createdAt: row.createdAt };
}

function bindPage(query, input) {
  query.input('offset', sql.Int, input.offset);
  query.input('limit', sql.Int, input.limit);
  if (input.search) query.input('search', sql.NVarChar(302), `%${escapeLike(input.search)}%`);
}
function paginated(result, normalize) {
  return { data: result.recordsets[1].map(normalize), total: Number(result.recordsets[0][0].total) };
}
const recipeFields = {
  recipeName: ['RecipeName', sql.NVarChar(200)], categoryId: ['CategoryID', sql.Int],
  description: ['Description', sql.NVarChar(sql.MAX)], imageUrl: ['ImageUrl', sql.NVarChar(500)],
  prepTime: ['PrepTime', sql.Int], cookTime: ['CookTime', sql.Int], servings: ['Servings', sql.Int], difficulty: ['Difficulty', sql.NVarChar(30)],
};
const categoryFields = { categoryName: ['CategoryName', sql.NVarChar(150)], description: ['Description', sql.NVarChar(500)], imageUrl: ['ImageUrl', sql.NVarChar(500)] };
const ingredientFields = { ingredientName: ['IngredientName', sql.NVarChar(150)], ingredientCategory: ['IngredientCategory', sql.NVarChar(100)], defaultUnit: ['DefaultUnit', sql.NVarChar(30)], imageUrl: ['ImageUrl', sql.NVarChar(500)] };
function bindFields(query, data, fields) {
  const assignments = [];
  for (const [key, [column, type]] of Object.entries(fields)) {
    if (!Object.hasOwn(data, key)) continue;
    query.input(key, type, data[key]);
    assignments.push(`${column} = @${key}`);
  }
  return assignments;
}

async function readRecipe(request, id, { lock = false } = {}) {
  const query = await request();
  query.input('id', sql.Int, id);
  const result = await query.query(`
    SELECT ${recipeColumns} FROM dbo.Recipes AS r ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
      INNER JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID WHERE r.RecipeID = @id;
    SELECT IngredientID AS ingredientId, Quantity AS quantity, Unit AS unit, IsRequired AS isRequired, Notes AS notes
      FROM dbo.RecipeIngredients WHERE RecipeID = @id ORDER BY IngredientID ASC;
    SELECT StepID AS stepId, StepNumber AS stepNumber, Instruction AS instruction, ImageUrl AS imageUrl
      FROM dbo.CookingSteps WHERE RecipeID = @id ORDER BY StepNumber ASC;
  `);
  if (!result.recordsets[0][0]) return null;
  return { ...normalizeRecipe(result.recordsets[0][0]),
    ingredients: result.recordsets[1].map((row) => ({ ...row, ingredientId: Number(row.ingredientId), quantity: Number(row.quantity), isRequired: Boolean(row.isRequired) })),
    steps: result.recordsets[2].map((row) => numbers(row, ['stepId', 'stepNumber'])) };
}

async function checkReferences(request, recipe) {
  const query = await request();
  query.input('categoryId', sql.Int, recipe.categoryId);
  const ids = recipe.ingredients.map((row, index) => {
    query.input(`ingredient${index}`, sql.Int, row.ingredientId);
    return `@ingredient${index}`;
  });
  const result = await query.query(`
    SELECT CategoryID FROM dbo.Categories WITH (HOLDLOCK) WHERE CategoryID = @categoryId;
    SELECT IngredientID FROM dbo.Ingredients WITH (HOLDLOCK) WHERE IngredientID IN (${ids.join(', ')});
  `);
  if (!result.recordsets[0].length) throw new HttpError(400, 'Danh mục không tồn tại. Vui lòng chọn lại.');
  if (result.recordsets[1].length !== recipe.ingredients.length) throw new HttpError(400, 'Có nguyên liệu không còn tồn tại. Vui lòng chọn lại.');
}

async function insertRecipeChildren(request, id, data) {
  if (data.ingredients) {
    for (const row of data.ingredients) {
      const query = await request();
      query.input('id', sql.Int, id).input('ingredientId', sql.Int, row.ingredientId)
        .input('quantity', sql.Decimal(12, 2), row.quantity).input('unit', sql.NVarChar(30), row.unit)
        .input('isRequired', sql.Bit, row.isRequired).input('notes', sql.NVarChar(255), row.notes);
      await query.query(`INSERT INTO dbo.RecipeIngredients (RecipeID, IngredientID, Quantity, Unit, IsRequired, Notes)
        VALUES (@id, @ingredientId, @quantity, @unit, @isRequired, @notes);`);
    }
  }
  if (data.steps) {
    for (const row of data.steps) {
      const query = await request();
      query.input('id', sql.Int, id).input('stepNumber', sql.Int, row.stepNumber)
        .input('instruction', sql.NVarChar(sql.MAX), row.instruction).input('imageUrl', sql.NVarChar(500), row.imageUrl);
      await query.query(`INSERT INTO dbo.CookingSteps (RecipeID, StepNumber, Instruction, ImageUrl)
        VALUES (@id, @stepNumber, @instruction, @imageUrl);`);
    }
  }
}

const entities = {
  category: { table: 'Categories', id: 'CategoryID', alias: 'categoryId', columns: categoryColumns, fields: categoryFields,
    references: ['SELECT COUNT_BIG(*) AS linked FROM dbo.Recipes WITH (HOLDLOCK) WHERE CategoryID = @id;'], normalize: normalizeCategory,
    blocked: 'Danh mục đang có món ăn nên không thể xóa.' },
  ingredient: { table: 'Ingredients', id: 'IngredientID', alias: 'ingredientId', columns: ingredientColumns, fields: ingredientFields,
    references: [`SELECT (SELECT COUNT_BIG(*) FROM dbo.RecipeIngredients WITH (HOLDLOCK) WHERE IngredientID = @id)
      + (SELECT COUNT_BIG(*) FROM dbo.UserIngredients WITH (HOLDLOCK) WHERE IngredientID = @id) AS linked;`], normalize: normalizeIngredient,
    blocked: 'Nguyên liệu đang có trong công thức hoặc tủ nguyên liệu nên không thể xóa.' },
};

async function createEntity(request, entity, data) {
  const query = await request(); bindFields(query, data, entity.fields);
  const entries = Object.entries(entity.fields).filter(([key]) => Object.hasOwn(data, key));
  const result = await query.query(`INSERT INTO dbo.${entity.table} (${entries.map(([, [column]]) => column).join(', ')})
    OUTPUT INSERTED.${entity.id} AS id VALUES (${entries.map(([key]) => `@${key}`).join(', ')});`);
  return { ...data, [entity.alias]: Number(result.recordset[0].id), recipeCount: 0, ...(entity === entities.ingredient ? { pantryCount: 0 } : {}) };
}

async function updateEntity(request, entity, id, changes) {
  const query = await request(); query.input('id', sql.Int, id);
  const assignments = bindFields(query, changes, entity.fields);
  const result = await query.query(`UPDATE dbo.${entity.table} SET ${assignments.join(', ')} WHERE ${entity.id} = @id;
    SELECT ${entity.columns} FROM dbo.${entity.table} WHERE ${entity.id} = @id;`);
  return entity.normalize(result.recordset[0]);
}

async function deleteEntity(withTransaction, entity, id) {
  return withTransaction(async (scopedRequest) => {
    const query = await scopedRequest(); query.input('id', sql.Int, id);
    const result = await query.query(`SELECT ${entity.id} FROM dbo.${entity.table} WITH (UPDLOCK, HOLDLOCK) WHERE ${entity.id} = @id;
      ${entity.references.join('\n')}`);
    if (!result.recordsets[0].length) return false;
    if (Number(result.recordsets[1][0].linked)) throw new HttpError(409, entity.blocked);
    const remove = await scopedRequest(); remove.input('id', sql.Int, id);
    await remove.query(`DELETE FROM dbo.${entity.table} WHERE ${entity.id} = @id;`);
    return true;
  });
}

async function sqlTransaction(work) {
  const transaction = new sql.Transaction(await getPool());
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await work(async () => new sql.Request(transaction));
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

export function createAdminRepository({ request = async () => (await getPool()).request(), withTransaction = sqlTransaction } = {}) {
  return {
    async dashboard() {
      const query = await request();
      const result = await query.query(`
        SELECT (SELECT COUNT_BIG(*) FROM dbo.Recipes) AS recipeCount,
          (SELECT COUNT_BIG(*) FROM dbo.Ingredients) AS ingredientCount,
          (SELECT COUNT_BIG(*) FROM dbo.Categories) AS categoryCount,
          (SELECT COUNT_BIG(*) FROM dbo.Users) AS userCount,
          (SELECT COUNT_BIG(*) FROM dbo.Reviews) AS reviewCount,
          (SELECT COUNT_BIG(*) FROM dbo.Favorites) AS favoriteCount;
        SELECT TOP (5) r.RecipeID AS recipeId, r.RecipeName AS recipeName, COUNT_BIG(*) AS count
          FROM dbo.Recipes AS r INNER JOIN dbo.Favorites AS f ON f.RecipeID = r.RecipeID
          GROUP BY r.RecipeID, r.RecipeName ORDER BY count DESC, r.RecipeID ASC;
        SELECT TOP (5) r.RecipeID AS recipeId, r.RecipeName AS recipeName, COUNT_BIG(*) AS count
          FROM dbo.Recipes AS r INNER JOIN dbo.Reviews AS v ON v.RecipeID = r.RecipeID
          GROUP BY r.RecipeID, r.RecipeName ORDER BY count DESC, r.RecipeID ASC;
        SELECT TOP (5) RecipeID AS recipeId, RecipeName AS recipeName, CreatedAt AS createdAt
          FROM dbo.Recipes ORDER BY CreatedAt DESC, RecipeID DESC;
      `);
      const normalizeTop = (rows) => rows.map((row) => ({ ...row, recipeId: Number(row.recipeId), count: Number(row.count) }));
      return {
        totals: Object.fromEntries(Object.entries(result.recordsets[0][0]).map(([key, value]) => [key, Number(value)])),
        mostFavorited: normalizeTop(result.recordsets[1]), mostReviewed: normalizeTop(result.recordsets[2]),
        newestRecipes: result.recordsets[3].map((row) => ({ ...row, recipeId: Number(row.recipeId) })),
      };
    },
    async listRecipes(input) {
      const query = await request(); bindPage(query, input);
      const where = [];
      if (input.search) where.push("r.RecipeName LIKE @search ESCAPE N'~'");
      if (input.categoryId !== undefined) { query.input('categoryId', sql.Int, input.categoryId); where.push('r.CategoryID = @categoryId'); }
      const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await query.query(`SELECT COUNT_BIG(*) AS total FROM dbo.Recipes AS r ${filter};
        SELECT ${recipeColumns} FROM dbo.Recipes AS r INNER JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
        ${filter} ORDER BY ${adminRecipeSorts.get(input.sort)} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
      return paginated(result, normalizeRecipe);
    },
    async findRecipeById(id) { return readRecipe(request, id); },
    async createRecipe(userId, data) {
      return withTransaction(async (scopedRequest) => {
        await checkReferences(scopedRequest, data);
        const query = await scopedRequest();
        bindFields(query, data, recipeFields);
        query.input('userId', sql.Int, userId);
        const result = await query.query(`INSERT INTO dbo.Recipes
          (RecipeName, CategoryID, Description, ImageUrl, PrepTime, CookTime, Servings, Difficulty, CreatedBy)
          OUTPUT INSERTED.RecipeID AS recipeId
          VALUES (@recipeName, @categoryId, @description, @imageUrl, @prepTime, @cookTime, @servings, @difficulty, @userId);`);
        const id = Number(result.recordset[0].recipeId);
        await insertRecipeChildren(scopedRequest, id, data);
        return readRecipe(scopedRequest, id);
      });
    },
    async updateRecipe(id, changes) {
      return withTransaction(async (scopedRequest) => {
        const current = await readRecipe(scopedRequest, id, { lock: true });
        if (!current) return null;
        const merged = validateRecipeState({ ...current, ...changes });
        await checkReferences(scopedRequest, merged);
        const query = await scopedRequest();
        query.input('id', sql.Int, id);
        const assignments = bindFields(query, changes, recipeFields);
        assignments.push('UpdatedAt = SYSUTCDATETIME()');
        await query.query(`UPDATE dbo.Recipes SET ${assignments.join(', ')} WHERE RecipeID = @id;`);
        if (changes.ingredients) {
          const remove = await scopedRequest(); remove.input('id', sql.Int, id);
          await remove.query('DELETE FROM dbo.RecipeIngredients WHERE RecipeID = @id;');
        }
        if (changes.steps) {
          const remove = await scopedRequest(); remove.input('id', sql.Int, id);
          await remove.query('DELETE FROM dbo.CookingSteps WHERE RecipeID = @id;');
        }
        await insertRecipeChildren(scopedRequest, id, changes);
        return readRecipe(scopedRequest, id);
      });
    },
    async deleteRecipe(id) {
      return withTransaction(async (scopedRequest) => {
        const query = await scopedRequest(); query.input('id', sql.Int, id);
        const result = await query.query(`SELECT RecipeID FROM dbo.Recipes WITH (UPDLOCK, HOLDLOCK) WHERE RecipeID = @id;
          SELECT (SELECT COUNT_BIG(*) FROM dbo.Favorites WITH (HOLDLOCK) WHERE RecipeID = @id)
            + (SELECT COUNT_BIG(*) FROM dbo.Reviews WITH (HOLDLOCK) WHERE RecipeID = @id) AS linked,
            (SELECT COUNT_BIG(*) FROM dbo.MealPlanItems WITH (HOLDLOCK) WHERE RecipeID = @id) AS planned;`);
        if (!result.recordsets[0].length) return false;
        if (Number(result.recordsets[1][0].linked)) throw new HttpError(409, 'Món ăn đã có lượt yêu thích hoặc đánh giá nên không thể xóa.');
        if (Number(result.recordsets[1][0].planned)) throw new HttpError(409, 'Không thể xóa món ăn vì đang được sử dụng trong lịch nấu ăn.');
        const remove = await scopedRequest(); remove.input('id', sql.Int, id);
        await remove.query(`DELETE FROM dbo.CookingSteps WHERE RecipeID = @id;
          DELETE FROM dbo.RecipeIngredients WHERE RecipeID = @id;
          DELETE FROM dbo.Recipes WHERE RecipeID = @id;`);
        return true;
      });
    },
    async listCategories(input) {
      const query = await request(); bindPage(query, input);
      const filter = input.search ? "WHERE c.CategoryName LIKE @search ESCAPE N'~'" : '';
      const result = await query.query(`SELECT COUNT_BIG(*) AS total FROM dbo.Categories AS c ${filter};
        SELECT c.CategoryID AS categoryId, c.CategoryName AS categoryName, c.Description AS description, c.ImageUrl AS imageUrl,
          (SELECT COUNT_BIG(*) FROM dbo.Recipes AS r WHERE r.CategoryID = c.CategoryID) AS recipeCount
          FROM dbo.Categories AS c ${filter} ORDER BY c.CategoryName ASC, c.CategoryID ASC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
      return paginated(result, normalizeCategory);
    },
    async createCategory(data) { return createEntity(request, entities.category, data); },
    async updateCategory(id, data) { return updateEntity(request, entities.category, id, data); },
    async deleteCategory(id) { return deleteEntity(withTransaction, entities.category, id); },
    async listIngredients(input) {
      const query = await request(); bindPage(query, input);
      const where = [];
      if (input.search) where.push("i.IngredientName LIKE @search ESCAPE N'~'");
      if (input.ingredientCategory !== undefined) { query.input('ingredientCategory', sql.NVarChar(100), input.ingredientCategory); where.push('i.IngredientCategory = @ingredientCategory'); }
      const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await query.query(`SELECT COUNT_BIG(*) AS total FROM dbo.Ingredients AS i ${filter};
        SELECT i.IngredientID AS ingredientId, i.IngredientName AS ingredientName, i.IngredientCategory AS ingredientCategory,
          i.DefaultUnit AS defaultUnit, i.ImageUrl AS imageUrl,
          (SELECT COUNT_BIG(*) FROM dbo.RecipeIngredients AS ri WHERE ri.IngredientID = i.IngredientID) AS recipeCount,
          (SELECT COUNT_BIG(*) FROM dbo.UserIngredients AS p WHERE p.IngredientID = i.IngredientID) AS pantryCount
          FROM dbo.Ingredients AS i ${filter} ORDER BY i.IngredientName ASC, i.IngredientID ASC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
      return paginated(result, normalizeIngredient);
    },
    async createIngredient(data) { return createEntity(request, entities.ingredient, data); },
    async updateIngredient(id, data) { return updateEntity(request, entities.ingredient, id, data); },
    async deleteIngredient(id) { return deleteEntity(withTransaction, entities.ingredient, id); },
    async listUsers(input) {
      const query = await request(); bindPage(query, input);
      const where = [];
      if (input.search) where.push("(FullName LIKE @search ESCAPE N'~' OR Email LIKE @search ESCAPE N'~')");
      if (input.role !== undefined) { query.input('role', sql.NVarChar(20), input.role); where.push('Role = @role'); }
      const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await query.query(`SELECT COUNT_BIG(*) AS total FROM dbo.Users ${filter};
        SELECT ${userColumns} FROM dbo.Users ${filter} ORDER BY CreatedAt DESC, UserID DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
      return paginated(result, normalizeUser);
    },
    async findUserById(id) {
      const query = await request(); query.input('id', sql.Int, id);
      const result = await query.query(`SELECT ${userColumns} FROM dbo.Users WHERE UserID = @id;`);
      return normalizeUser(result.recordset[0]);
    },
    async listReviews(input) {
      const query = await request(); bindPage(query, input);
      const where = [];
      if (input.search) where.push("(r.RecipeName LIKE @search ESCAPE N'~' OR u.FullName LIKE @search ESCAPE N'~' OR v.Comment LIKE @search ESCAPE N'~')");
      if (input.recipeId !== undefined) { query.input('recipeId', sql.Int, input.recipeId); where.push('v.RecipeID = @recipeId'); }
      if (input.rating !== undefined) { query.input('rating', sql.Int, input.rating); where.push('v.Rating = @rating'); }
      const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const joins = `FROM dbo.Reviews AS v INNER JOIN dbo.Recipes AS r ON r.RecipeID = v.RecipeID
        INNER JOIN dbo.Users AS u ON u.UserID = v.UserID`;
      const result = await query.query(`SELECT COUNT_BIG(*) AS total ${joins} ${filter};
        SELECT v.ReviewID AS reviewId, v.RecipeID AS recipeId, r.RecipeName AS recipeName, v.UserID AS userId,
          u.FullName AS fullName, v.Rating AS rating, v.Comment AS comment, v.CreatedAt AS createdAt
          ${joins} ${filter} ORDER BY v.CreatedAt DESC, v.ReviewID DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`);
      return paginated(result, (row) => numbers(row, ['reviewId', 'recipeId', 'userId', 'rating']));
    },
    async deleteReview(id) {
      const query = await request(); query.input('id', sql.Int, id);
      const result = await query.query('DELETE FROM dbo.Reviews OUTPUT DELETED.ReviewID WHERE ReviewID = @id;');
      return result.recordset.length > 0;
    },
  };
}
