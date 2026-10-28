import { getPool, sql } from '../config/database.js';
import { HttpError } from '../utilities/http-error.js';
import { addCalendarDays, weekStartForDate } from '../utilities/meal-plan-validation.js';

const itemColumns = `i.MealPlanItemID AS mealPlanItemId, i.MealPlanID AS mealPlanId,
  i.RecipeID AS recipeId, r.RecipeName AS recipeName, r.ImageUrl AS imageUrl,
  CONVERT(CHAR(10), i.MealDate, 23) AS mealDate, i.MealType AS mealType,
  i.Servings AS servings, r.Servings AS originalServings, r.PrepTime AS prepTime,
  r.CookTime AS cookTime, CONVERT(BIGINT, r.PrepTime) + CONVERT(BIGINT, r.CookTime) AS totalTime,
  i.SortOrder AS sortOrder`;
function normalizeItem(row) {
  if (!row) return null;
  return {
    mealPlanItemId: Number(row.mealPlanItemId), mealPlanId: Number(row.mealPlanId),
    recipeId: Number(row.recipeId), recipeName: row.recipeName, imageUrl: row.imageUrl ?? null,
    mealDate: row.mealDate, mealType: row.mealType, servings: Number(row.servings),
    originalServings: Number(row.originalServings), prepTime: Number(row.prepTime),
    cookTime: Number(row.cookTime), totalTime: Number(row.totalTime), sortOrder: Number(row.sortOrder),
  };
}
function sqlNumber(error, expected) {
  return [error, ...(Array.isArray(error.precedingErrors) ? error.precedingErrors : [])].some((entry) =>
    [entry.number, entry.originalError?.number, entry.originalError?.info?.number, entry.originalError?.code]
      .some((number) => Number(number) === expected));
}

// Injectable transaction primitives let unit tests exercise the production
// commit/rollback/retry policy without opening a database connection.
export async function runMealPlanTransaction(work, {
  getConnection = getPool,
  createTransaction = (pool) => new sql.Transaction(pool),
  createRequest = (transaction) => new sql.Request(transaction),
} = {}) {
  // Retry the entire rolled-back transaction only for SQL Server deadlock victims.
  for (let attempt = 0; ; attempt += 1) {
    const transaction = createTransaction(await getConnection());
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const result = await work(async () => createRequest(transaction));
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback().catch(() => {});
      if (attempt < 2 && sqlNumber(error, 1205)) continue;
      throw error;
    }
  }
}

async function lockOwner(request, userId) {
  const query = await request(); query.input('userId', sql.Int, userId);
  // One owner lock serializes week creation and cross-week moves in a consistent order.
  const result = await query.query('SELECT UserID FROM dbo.Users WITH (UPDLOCK, HOLDLOCK) WHERE UserID = @userId;');
  if (!result.recordset.length) throw new HttpError(401, 'Phiên đăng nhập không còn hợp lệ.');
}

async function getOrCreateWeek(request, userId, weekStart) {
  const query = await request();
  query.input('userId', sql.Int, userId).input('weekStart', sql.VarChar(10), weekStart);
  const result = await query.query(`
    DECLARE @planId INT;
    SELECT @planId = MealPlanID FROM dbo.MealPlans WITH (UPDLOCK, HOLDLOCK)
      WHERE UserID = @userId AND WeekStartDate = CONVERT(DATE, @weekStart, 23);
    IF @planId IS NULL
    BEGIN
      INSERT INTO dbo.MealPlans (UserID, WeekStartDate) VALUES (@userId, CONVERT(DATE, @weekStart, 23));
      SET @planId = CONVERT(INT, SCOPE_IDENTITY());
    END;
    SELECT @planId AS mealPlanId;
  `);
  return Number(result.recordset[0].mealPlanId);
}

async function readOwnedItem(request, userId, id, { lock = false } = {}) {
  const query = await request(); query.input('userId', sql.Int, userId).input('id', sql.Int, id);
  const result = await query.query(`SELECT ${itemColumns} FROM dbo.MealPlanItems AS i ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
    INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID
    INNER JOIN dbo.Recipes AS r ON r.RecipeID = i.RecipeID
    WHERE p.UserID = @userId AND i.MealPlanItemID = @id;`);
  return normalizeItem(result.recordset[0]);
}

function validateMembership(date, weekStart) {
  if (date < weekStart || date > addCalendarDays(weekStart, 6)) throw new HttpError(400, 'Ngày nấu phải thuộc tuần của lịch nấu ăn.');
}

async function touchPlans(request, userId, first, second = first) {
  const query = await request();
  query.input('userId', sql.Int, userId).input('first', sql.Int, first).input('second', sql.Int, second);
  await query.query(`UPDATE dbo.MealPlans SET UpdatedAt = SYSUTCDATETIME()
    WHERE UserID = @userId AND MealPlanID IN (@first, @second);`);
}

async function preventDuplicate(request, userId, planId, input, excludeId = null) {
  const query = await request();
  query.input('userId', sql.Int, userId).input('planId', sql.Int, planId).input('recipeId', sql.Int, input.recipeId)
    .input('mealDate', sql.VarChar(10), input.mealDate).input('mealType', sql.NVarChar(20), input.mealType).input('excludeId', sql.Int, excludeId);
  const result = await query.query(`SELECT i.MealPlanItemID FROM dbo.MealPlanItems AS i WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID
    WHERE p.UserID = @userId AND i.MealPlanID = @planId AND i.RecipeID = @recipeId
      AND i.MealDate = CONVERT(DATE, @mealDate, 23) AND i.MealType = @mealType
      AND (@excludeId IS NULL OR i.MealPlanItemID <> @excludeId);`);
  if (result.recordset.length) throw new HttpError(409, 'Món ăn đã có trong bữa này. Hãy chỉnh sửa món hiện có.');
}

export function createMealPlanRepository({ request = async () => (await getPool()).request(), withTransaction = runMealPlanTransaction } = {}) {
  return {
    async getWeek(userId, weekStart) {
      const query = await request();
      query.input('userId', sql.Int, userId).input('weekStart', sql.VarChar(10), weekStart);
      const result = await query.query(`
        SELECT MealPlanID AS mealPlanId FROM dbo.MealPlans
          WHERE UserID = @userId AND WeekStartDate = CONVERT(DATE, @weekStart, 23);
        SELECT ${itemColumns} FROM dbo.MealPlanItems AS i
          INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID
          INNER JOIN dbo.Recipes AS r ON r.RecipeID = i.RecipeID
          WHERE p.UserID = @userId AND p.WeekStartDate = CONVERT(DATE, @weekStart, 23)
          ORDER BY i.MealDate, CASE i.MealType WHEN N'Breakfast' THEN 0 WHEN N'Lunch' THEN 1 ELSE 2 END, i.SortOrder, i.MealPlanItemID;
        SELECT COUNT(DISTINCT ri.IngredientID) AS ingredientCount FROM dbo.MealPlanItems AS i
          INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID
          INNER JOIN dbo.RecipeIngredients AS ri ON ri.RecipeID = i.RecipeID AND ri.IsRequired = 1
          WHERE p.UserID = @userId AND p.WeekStartDate = CONVERT(DATE, @weekStart, 23);
      `);
      return { mealPlanId: result.recordsets[0][0] ? Number(result.recordsets[0][0].mealPlanId) : null,
        items: result.recordsets[1].map(normalizeItem), ingredientCount: Number(result.recordsets[2][0].ingredientCount) };
    },
    async getShoppingRows(userId, weekStart) {
      const query = await request();
      query.input('userId', sql.Int, userId).input('weekStart', sql.VarChar(10), weekStart);
      const result = await query.query(`SELECT i.MealPlanItemID AS mealPlanItemId, i.RecipeID AS recipeId,
        r.RecipeName AS recipeName, i.Servings AS servings, r.Servings AS originalServings,
        ri.IngredientID AS ingredientId, n.IngredientName AS ingredientName, n.IngredientCategory AS ingredientCategory,
        ri.Unit AS unit, CONVERT(VARCHAR(30), ri.Quantity) AS quantity, ri.IsRequired AS isRequired
        FROM dbo.MealPlanItems AS i INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID
        INNER JOIN dbo.Recipes AS r ON r.RecipeID = i.RecipeID
        INNER JOIN dbo.RecipeIngredients AS ri ON ri.RecipeID = r.RecipeID AND ri.IsRequired = 1
        INNER JOIN dbo.Ingredients AS n ON n.IngredientID = ri.IngredientID
        WHERE p.UserID = @userId AND p.WeekStartDate = CONVERT(DATE, @weekStart, 23)
        ORDER BY i.MealPlanItemID, ri.IngredientID;`);
      return result.recordset.map((row) => ({
        mealPlanItemId: Number(row.mealPlanItemId), recipeId: Number(row.recipeId), recipeName: row.recipeName,
        servings: Number(row.servings), originalServings: Number(row.originalServings), ingredientId: Number(row.ingredientId),
        ingredientName: row.ingredientName, ingredientCategory: row.ingredientCategory, unit: row.unit,
        quantity: row.quantity, isRequired: Boolean(row.isRequired),
      }));
    },
    async create(userId, input) {
      return withTransaction(async (scopedRequest) => {
        await lockOwner(scopedRequest, userId);
        const recipe = await scopedRequest(); recipe.input('recipeId', sql.Int, input.recipeId);
        if (!(await recipe.query('SELECT RecipeID FROM dbo.Recipes WITH (HOLDLOCK) WHERE RecipeID = @recipeId;')).recordset.length) {
          throw new HttpError(404, 'Không tìm thấy món ăn.');
        }
        const weekStart = weekStartForDate(input.mealDate); validateMembership(input.mealDate, weekStart);
        const mealPlanId = await getOrCreateWeek(scopedRequest, userId, weekStart);
        await preventDuplicate(scopedRequest, userId, mealPlanId, input);
        const query = await scopedRequest();
        query.input('planId', sql.Int, mealPlanId).input('recipeId', sql.Int, input.recipeId)
          .input('mealDate', sql.VarChar(10), input.mealDate).input('mealType', sql.NVarChar(20), input.mealType)
          .input('servings', sql.Int, input.servings).input('sortOrder', sql.Int, input.sortOrder);
        const result = await query.query(`INSERT INTO dbo.MealPlanItems (MealPlanID, RecipeID, MealDate, MealType, Servings, SortOrder)
          OUTPUT INSERTED.MealPlanItemID AS id
          VALUES (@planId, @recipeId, CONVERT(DATE, @mealDate, 23), @mealType, @servings, @sortOrder);`);
        await touchPlans(scopedRequest, userId, mealPlanId);
        return readOwnedItem(scopedRequest, userId, Number(result.recordset[0].id));
      });
    },
    async update(userId, id, changes) {
      return withTransaction(async (scopedRequest) => {
        await lockOwner(scopedRequest, userId);
        const current = await readOwnedItem(scopedRequest, userId, id, { lock: true });
        if (!current) return null;
        const merged = { ...current, ...changes };
        const weekStart = weekStartForDate(merged.mealDate); validateMembership(merged.mealDate, weekStart);
        const planId = await getOrCreateWeek(scopedRequest, userId, weekStart);
        await preventDuplicate(scopedRequest, userId, planId, merged, id);
        const query = await scopedRequest();
        query.input('userId', sql.Int, userId).input('id', sql.Int, id).input('planId', sql.Int, planId)
          .input('mealDate', sql.VarChar(10), merged.mealDate).input('mealType', sql.NVarChar(20), merged.mealType)
          .input('servings', sql.Int, merged.servings).input('sortOrder', sql.Int, merged.sortOrder);
        await query.query(`UPDATE i SET MealPlanID = @planId, MealDate = CONVERT(DATE, @mealDate, 23),
          MealType = @mealType, Servings = @servings, SortOrder = @sortOrder, UpdatedAt = SYSUTCDATETIME()
          FROM dbo.MealPlanItems AS i INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID
          WHERE p.UserID = @userId AND i.MealPlanItemID = @id;`);
        await touchPlans(scopedRequest, userId, current.mealPlanId, planId);
        return readOwnedItem(scopedRequest, userId, id);
      });
    },
    async remove(userId, id) {
      return withTransaction(async (scopedRequest) => {
        await lockOwner(scopedRequest, userId);
        const current = await readOwnedItem(scopedRequest, userId, id, { lock: true });
        if (!current) return false;
        const query = await scopedRequest(); query.input('userId', sql.Int, userId).input('id', sql.Int, id);
        await query.query(`DELETE i FROM dbo.MealPlanItems AS i INNER JOIN dbo.MealPlans AS p ON p.MealPlanID = i.MealPlanID
          WHERE p.UserID = @userId AND i.MealPlanItemID = @id;`);
        await touchPlans(scopedRequest, userId, current.mealPlanId);
        return true;
      });
    },
  };
}
