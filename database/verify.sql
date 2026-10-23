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
       (N'Reviews'), (N'UserIngredients'), (N'SearchHistory');

IF EXISTS (
    SELECT 1 FROM @ExpectedTables
    WHERE OBJECT_ID(N'dbo.' + QUOTENAME(TableName), N'U') IS NULL
)
    THROW 51010, N'Thiếu bảng SmartCook. Hãy chạy schema.sql trước.', 1;

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
UNION ALL SELECT N'SearchHistory', COUNT_BIG(*) FROM dbo.SearchHistory;

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
