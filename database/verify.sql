-- Chỉ đọc: kiểm tra schema, khóa và chất lượng dữ liệu; không sửa dữ liệu.
USE [SmartCookDB];
GO
SET NOCOUNT ON;

IF DB_NAME() <> N'SmartCookDB'
    THROW 51013, N'Sai database hiện tại. Chỉ kiểm tra SmartCookDB.', 1;

DECLARE @ExpectedTables TABLE (TableName sysname PRIMARY KEY);
INSERT INTO @ExpectedTables (TableName)
VALUES (N'Users'), (N'Categories'), (N'Recipes'), (N'Ingredients'),
       (N'RecipeIngredients'), (N'CookingSteps'), (N'Favorites'),
       (N'Reviews'), (N'UserIngredients'), (N'SearchHistory'),
       (N'MealPlans'), (N'MealPlanItems');

IF EXISTS (
    SELECT 1 FROM @ExpectedTables
    WHERE OBJECT_ID(N'dbo.' + QUOTENAME(TableName), N'U') IS NULL
)
    THROW 51010, N'Thiếu bảng SmartCook. Máy mới: schema.sql, migrations/001_weekly_meal_planner.sql, rồi seed.sql. Database cũ: chạy migration bổ sung.', 1;

IF EXISTS (
    SELECT 1 FROM sys.foreign_keys AS fk
    JOIN sys.tables AS t ON t.object_id = fk.parent_object_id
    JOIN @ExpectedTables AS e ON e.TableName = t.name COLLATE DATABASE_DEFAULT
    WHERE t.schema_id = SCHEMA_ID(N'dbo')
      AND (fk.is_disabled = 1 OR fk.is_not_trusted = 1)
)
    THROW 51011, N'Có khóa ngoại bị vô hiệu hóa hoặc chưa được xác thực.', 1;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints AS cc
    JOIN sys.tables AS t ON t.object_id = cc.parent_object_id
    JOIN @ExpectedTables AS e ON e.TableName = t.name COLLATE DATABASE_DEFAULT
    WHERE t.schema_id = SCHEMA_ID(N'dbo')
      AND (cc.is_disabled = 1 OR cc.is_not_trusted = 1)
)
    THROW 51012, N'Có CHECK constraint bị vô hiệu hóa hoặc chưa được xác thực.', 1;

SELECT N'Users' AS TableName, COUNT_BIG(*) AS [RowCount] FROM dbo.Users
UNION ALL SELECT N'Categories', COUNT_BIG(*) FROM dbo.Categories
UNION ALL SELECT N'Recipes', COUNT_BIG(*) FROM dbo.Recipes
UNION ALL SELECT N'Ingredients', COUNT_BIG(*) FROM dbo.Ingredients
UNION ALL SELECT N'RecipeIngredients', COUNT_BIG(*) FROM dbo.RecipeIngredients
UNION ALL SELECT N'CookingSteps', COUNT_BIG(*) FROM dbo.CookingSteps
UNION ALL SELECT N'Favorites', COUNT_BIG(*) FROM dbo.Favorites
UNION ALL SELECT N'Reviews', COUNT_BIG(*) FROM dbo.Reviews
UNION ALL SELECT N'UserIngredients', COUNT_BIG(*) FROM dbo.UserIngredients
UNION ALL SELECT N'SearchHistory', COUNT_BIG(*) FROM dbo.SearchHistory
UNION ALL SELECT N'MealPlans', COUNT_BIG(*) FROM dbo.MealPlans
UNION ALL SELECT N'MealPlanItems', COUNT_BIG(*) FROM dbo.MealPlanItems;

SELECT DB_NAME() AS DatabaseName,
       (SELECT COUNT(*) FROM @ExpectedTables) AS RequiredSmartCookTableCount,
       (SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo')) AS ActualDboTableCount;

-- Meal Planner: no seed plans, no Pantry conversion. The migration is also the
-- complete metadata-contract check and may be rerun safely without changing data.
IF EXISTS (
    SELECT 1 FROM (VALUES
        (N'MealPlans', N'PK_MealPlans', 'PK'),
        (N'MealPlans', N'UQ_MealPlans_UserID_WeekStartDate', 'UQ'),
        (N'MealPlanItems', N'PK_MealPlanItems', 'PK'),
        (N'MealPlanItems', N'UQ_MealPlanItems_Plan_Date_Type_Recipe', 'UQ')
    ) AS e(TableName, KeyName, KeyType)
    LEFT JOIN sys.key_constraints AS kc ON kc.parent_object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
        AND kc.name COLLATE DATABASE_DEFAULT = e.KeyName
        AND kc.type COLLATE DATABASE_DEFAULT = e.KeyType COLLATE DATABASE_DEFAULT
    WHERE kc.object_id IS NULL
)
    THROW 51014, N'Meal Planner thiếu PK/UNIQUE theo migration 001.', 1;

IF EXISTS (
    SELECT 1 FROM (VALUES
        (N'MealPlans', N'FK_MealPlans_Users'),
        (N'MealPlanItems', N'FK_MealPlanItems_MealPlans'),
        (N'MealPlanItems', N'FK_MealPlanItems_Recipes')
    ) AS e(TableName, KeyName)
    LEFT JOIN sys.foreign_keys AS fk ON fk.parent_object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
        AND fk.name COLLATE DATABASE_DEFAULT = e.KeyName
    WHERE fk.object_id IS NULL OR fk.delete_referential_action <> 0 OR fk.update_referential_action <> 0
)
    THROW 51015, N'Meal Planner thiếu FK hoặc có CASCADE không được phép.', 1;

IF EXISTS (
    SELECT 1 FROM (VALUES
        (N'MealPlans', N'CK_MealPlans_WeekStartDate'), (N'MealPlans', N'CK_MealPlans_Timestamps'),
        (N'MealPlanItems', N'CK_MealPlanItems_MealDate'), (N'MealPlanItems', N'CK_MealPlanItems_MealType'),
        (N'MealPlanItems', N'CK_MealPlanItems_Servings'), (N'MealPlanItems', N'CK_MealPlanItems_SortOrder'),
        (N'MealPlanItems', N'CK_MealPlanItems_Timestamps')
    ) AS e(TableName, CheckName)
    LEFT JOIN sys.check_constraints AS cc ON cc.parent_object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
        AND cc.name COLLATE DATABASE_DEFAULT = e.CheckName
    WHERE cc.object_id IS NULL
)
    THROW 51016, N'Meal Planner thiếu CHECK constraint theo migration 001.', 1;

IF EXISTS (
    SELECT 1 FROM (VALUES (N'IX_MealPlanItems_Plan_Date_Type'), (N'IX_MealPlanItems_RecipeID')) AS e(IndexName)
    LEFT JOIN sys.indexes AS ix ON ix.object_id = OBJECT_ID(N'dbo.MealPlanItems', N'U')
        AND ix.name COLLATE DATABASE_DEFAULT = e.IndexName
    WHERE ix.index_id IS NULL OR ix.is_disabled = 1 OR ix.is_hypothetical = 1
)
    THROW 51017, N'Meal Planner thiếu index truy vấn hoặc index bị tắt.', 1;

IF EXISTS (
    SELECT 1 FROM dbo.MealPlans
    WHERE DATEDIFF(DAY, DATEFROMPARTS(1,1,1), WeekStartDate) % 7 <> 0
       OR WeekStartDate > DATEFROMPARTS(9999,12,20) OR UpdatedAt < CreatedAt
)
    THROW 51018, N'MealPlans có tuần không hợp lệ hoặc timestamp sai.', 1;

IF EXISTS (
    SELECT 1 FROM dbo.MealPlanItems AS mpi
    JOIN dbo.MealPlans AS mp ON mp.MealPlanID = mpi.MealPlanID
    WHERE DATEDIFF(DAY, mp.WeekStartDate, mpi.MealDate) NOT BETWEEN 0 AND 6
       OR mpi.MealDate > DATEFROMPARTS(9999,12,26)
       OR mpi.Servings NOT BETWEEN 1 AND 20 OR mpi.SortOrder < 0 OR mpi.UpdatedAt < mpi.CreatedAt
       OR NOT (
           (mpi.MealType COLLATE Latin1_General_100_BIN2 = N'Breakfast' AND DATALENGTH(mpi.MealType) = 18)
           OR (mpi.MealType COLLATE Latin1_General_100_BIN2 = N'Lunch' AND DATALENGTH(mpi.MealType) = 10)
           OR (mpi.MealType COLLATE Latin1_General_100_BIN2 = N'Dinner' AND DATALENGTH(mpi.MealType) = 12)
       )
)
    THROW 51019, N'MealPlanItems có ngày ngoài tuần, loại bữa hoặc khẩu phần không hợp lệ.', 1;

SELECT t.name AS TableName, i.name AS IndexName, i.type_desc AS IndexType,
       i.is_unique AS IsUnique, i.is_disabled AS IsDisabled
FROM sys.indexes AS i JOIN sys.tables AS t ON t.object_id = i.object_id
WHERE t.schema_id = SCHEMA_ID(N'dbo') AND t.name IN (N'MealPlans', N'MealPlanItems')
ORDER BY t.name, i.index_id;

SELECT t.name AS TableName, kc.name AS ConstraintName, kc.type_desc AS ConstraintType
FROM sys.key_constraints AS kc
JOIN sys.tables AS t ON t.object_id = kc.parent_object_id
JOIN @ExpectedTables AS e ON e.TableName = t.name COLLATE DATABASE_DEFAULT
WHERE t.schema_id = SCHEMA_ID(N'dbo')
ORDER BY t.name, kc.type_desc, kc.name;

SELECT OBJECT_NAME(fk.parent_object_id) AS ChildTable,
       fk.name AS ForeignKeyName,
       OBJECT_NAME(fk.referenced_object_id) AS ParentTable,
       fk.delete_referential_action_desc AS OnDelete,
       fk.update_referential_action_desc AS OnUpdate,
       fk.is_disabled AS IsDisabled, fk.is_not_trusted AS IsNotTrusted
FROM sys.foreign_keys AS fk
JOIN sys.tables AS t ON t.object_id = fk.parent_object_id
JOIN @ExpectedTables AS e ON e.TableName = t.name COLLATE DATABASE_DEFAULT
WHERE t.schema_id = SCHEMA_ID(N'dbo')
ORDER BY ChildTable, ForeignKeyName;

SELECT r.RecipeID, r.RecipeName, c.CategoryName,
       r.PrepTime, r.CookTime, r.Servings, r.Difficulty,
       (SELECT COUNT(*) FROM dbo.RecipeIngredients AS ri WHERE ri.RecipeID = r.RecipeID) AS IngredientCount,
       (SELECT COUNT(*) FROM dbo.RecipeIngredients AS ri WHERE ri.RecipeID = r.RecipeID AND ri.IsRequired = 1) AS RequiredIngredientCount,
       (SELECT COUNT(*) FROM dbo.CookingSteps AS cs WHERE cs.RecipeID = r.RecipeID) AS StepCount
FROM dbo.Recipes AS r
JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
ORDER BY r.RecipeID;

-- Tập này cần rỗng với dữ liệu mẫu; công thức của người dùng có thể chưa hoàn thiện.
SELECT r.RecipeID, r.RecipeName, N'Thiếu nguyên liệu chính hoặc bước nấu' AS DataIssue
FROM dbo.Recipes AS r
WHERE NOT EXISTS (SELECT 1 FROM dbo.RecipeIngredients AS ri WHERE ri.RecipeID = r.RecipeID AND ri.IsRequired = 1)
   OR NOT EXISTS (SELECT 1 FROM dbo.CookingSteps AS cs WHERE cs.RecipeID = r.RecipeID);

-- Truy vấn đầy đủ một công thức, không tính thuật toán gợi ý trong bước này.
DECLARE @RecipeID int = (SELECT MIN(RecipeID) FROM dbo.Recipes);
SELECT r.*, c.CategoryName
FROM dbo.Recipes AS r
JOIN dbo.Categories AS c ON c.CategoryID = r.CategoryID
WHERE r.RecipeID = @RecipeID;

SELECT i.IngredientName, ri.Quantity, ri.Unit, ri.IsRequired, ri.Notes
FROM dbo.RecipeIngredients AS ri
JOIN dbo.Ingredients AS i ON i.IngredientID = ri.IngredientID
WHERE ri.RecipeID = @RecipeID
ORDER BY ri.IsRequired DESC, i.IngredientName;

SELECT StepNumber, Instruction, ImageUrl
FROM dbo.CookingSteps
WHERE RecipeID = @RecipeID
ORDER BY StepNumber;
GO
