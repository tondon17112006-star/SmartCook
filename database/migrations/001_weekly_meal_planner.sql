/*
    SmartCookDB / MP-02 / SQL Server 2016+.
    Additive only: dbo.MealPlans and dbo.MealPlanItems. No seed or existing-table DML.
    Review permissions, back up and capture integrity before running (see database/README.md).
    Run the whole UTF-8 file, outside an open transaction. Safe to rerun when the
    existing new tables match this contract; incompatible objects cause a rollback.
*/
USE [SmartCookDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'SmartCookDB'
    THROW 51100, N'Sai database. Migration chỉ được chạy trên SmartCookDB.', 1;
IF @@TRANCOUNT <> 0
    THROW 51101, N'Chạy migration ngoài transaction đang mở.', 1;
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL OR OBJECT_ID(N'dbo.Recipes', N'U') IS NULL
    THROW 51102, N'Thiếu Users hoặc Recipes. Máy mới phải chạy schema.sql trước.', 1;
IF EXISTS (
    SELECT 1 FROM (VALUES (N'Users', N'UserID'), (N'Recipes', N'RecipeID')) AS e(TableName, ColumnName)
    LEFT JOIN sys.columns AS c ON c.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
        AND c.name COLLATE DATABASE_DEFAULT = e.ColumnName
    WHERE c.column_id IS NULL OR c.system_type_id <> TYPE_ID(N'int')
       OR c.user_type_id <> c.system_type_id OR c.is_nullable <> 0
)
    THROW 51103, N'Khóa Users/Recipes không tương thích INT NOT NULL. Dừng để rà soát.', 1;
IF (OBJECT_ID(N'dbo.MealPlans') IS NOT NULL AND OBJECT_ID(N'dbo.MealPlans', N'U') IS NULL)
   OR (OBJECT_ID(N'dbo.MealPlanItems') IS NOT NULL AND OBJECT_ID(N'dbo.MealPlanItems', N'U') IS NULL)
    THROW 51104, N'Tên MealPlans/MealPlanItems đang thuộc đối tượng khác; không tự thay thế.', 1;
IF (OBJECT_ID(N'dbo.MealPlans', N'U') IS NULL OR OBJECT_ID(N'dbo.MealPlanItems', N'U') IS NULL)
   AND (ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CREATE TABLE'), 0) <> 1
        OR ISNULL(HAS_PERMS_BY_NAME(N'dbo', N'SCHEMA', N'ALTER'), 0) <> 1
        OR ISNULL(HAS_PERMS_BY_NAME(N'dbo.Users', N'OBJECT', N'REFERENCES'), 0) <> 1
        OR ISNULL(HAS_PERMS_BY_NAME(N'dbo.Recipes', N'OBJECT', N'REFERENCES'), 0) <> 1)
    THROW 51105, N'Thiếu quyền CREATE TABLE, ALTER dbo hoặc REFERENCES Users/Recipes. Không tự cấp quyền.', 1;

BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @LockResult INT;
    EXEC @LockResult = sys.sp_getapplock
        @Resource = N'SmartCookDB.SchemaAndSeed', @LockMode = N'Exclusive',
        @LockOwner = N'Transaction', @LockTimeout = 15000;
    IF @LockResult < 0
        THROW 51106, N'Không lấy được khóa migration. Hãy chạy lại khi script khác đã xong.', 1;

    SELECT N'Before' AS MigrationPhase, DB_NAME() AS DatabaseName,
        COUNT(*) AS DboTableCount FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo');

    DECLARE @ExpectedColumns TABLE (
        TableName SYSNAME, ColumnName SYSNAME, TypeName SYSNAME,
        MaxLength SMALLINT, NumericScale TINYINT, IsIdentity BIT,
        CollationName SYSNAME NULL, PRIMARY KEY (TableName, ColumnName)
    );
    INSERT INTO @ExpectedColumns VALUES
    (N'MealPlans', N'MealPlanID', N'int', 4, 0, 1, NULL),
    (N'MealPlans', N'UserID', N'int', 4, 0, 0, NULL),
    (N'MealPlans', N'WeekStartDate', N'date', 3, 0, 0, NULL),
    (N'MealPlans', N'CreatedAt', N'datetime2', 6, 0, 0, NULL),
    (N'MealPlans', N'UpdatedAt', N'datetime2', 6, 0, 0, NULL),
    (N'MealPlanItems', N'MealPlanItemID', N'int', 4, 0, 1, NULL),
    (N'MealPlanItems', N'MealPlanID', N'int', 4, 0, 0, NULL),
    (N'MealPlanItems', N'RecipeID', N'int', 4, 0, 0, NULL),
    (N'MealPlanItems', N'MealDate', N'date', 3, 0, 0, NULL),
    (N'MealPlanItems', N'MealType', N'nvarchar', 40, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'MealPlanItems', N'Servings', N'int', 4, 0, 0, NULL),
    (N'MealPlanItems', N'SortOrder', N'int', 4, 0, 0, NULL),
    (N'MealPlanItems', N'CreatedAt', N'datetime2', 6, 0, 0, NULL),
    (N'MealPlanItems', N'UpdatedAt', N'datetime2', 6, 0, 0, NULL);

    DECLARE @ExpectedKeys TABLE (TableName SYSNAME, KeyName SYSNAME, KeyType CHAR(2), ColumnsList NVARCHAR(500));
    INSERT INTO @ExpectedKeys VALUES
    (N'MealPlans', N'PK_MealPlans', 'PK', N'MealPlanID'),
    (N'MealPlans', N'UQ_MealPlans_UserID_WeekStartDate', 'UQ', N'UserID,WeekStartDate'),
    (N'MealPlanItems', N'PK_MealPlanItems', 'PK', N'MealPlanItemID'),
    (N'MealPlanItems', N'UQ_MealPlanItems_Plan_Date_Type_Recipe', 'UQ', N'MealPlanID,MealDate,MealType,RecipeID');

    DECLARE @ExpectedForeignKeys TABLE (TableName SYSNAME, KeyName SYSNAME, ColumnName SYSNAME, ParentTable SYSNAME, ParentColumn SYSNAME);
    INSERT INTO @ExpectedForeignKeys VALUES
    (N'MealPlans', N'FK_MealPlans_Users', N'UserID', N'Users', N'UserID'),
    (N'MealPlanItems', N'FK_MealPlanItems_MealPlans', N'MealPlanID', N'MealPlans', N'MealPlanID'),
    (N'MealPlanItems', N'FK_MealPlanItems_Recipes', N'RecipeID', N'Recipes', N'RecipeID');

    DECLARE @ExpectedChecks TABLE (TableName SYSNAME, CheckName SYSNAME, CheckDefinition NVARCHAR(MAX));
    INSERT INTO @ExpectedChecks VALUES
    (N'MealPlans', N'CK_MealPlans_WeekStartDate', N'DATEDIFF(DAY, DATEFROMPARTS(1,1,1), WeekStartDate) % 7 = 0 AND WeekStartDate <= DATEFROMPARTS(9999,12,20)'),
    (N'MealPlans', N'CK_MealPlans_Timestamps', N'UpdatedAt >= CreatedAt'),
    (N'MealPlanItems', N'CK_MealPlanItems_MealDate', N'MealDate <= DATEFROMPARTS(9999,12,26)'),
    (N'MealPlanItems', N'CK_MealPlanItems_MealType', N'(MealType COLLATE Latin1_General_100_BIN2 = N''Breakfast'' AND DATALENGTH(MealType) = 18) OR (MealType COLLATE Latin1_General_100_BIN2 = N''Lunch'' AND DATALENGTH(MealType) = 10) OR (MealType COLLATE Latin1_General_100_BIN2 = N''Dinner'' AND DATALENGTH(MealType) = 12)'),
    (N'MealPlanItems', N'CK_MealPlanItems_Servings', N'Servings >= 1 AND Servings <= 20'),
    (N'MealPlanItems', N'CK_MealPlanItems_SortOrder', N'SortOrder >= 0'),
    (N'MealPlanItems', N'CK_MealPlanItems_Timestamps', N'UpdatedAt >= CreatedAt');

    DECLARE @ExpectedDefaults TABLE (TableName SYSNAME, ColumnName SYSNAME, DefaultName SYSNAME, DefaultDefinition NVARCHAR(100));
    INSERT INTO @ExpectedDefaults VALUES
    (N'MealPlans', N'CreatedAt', N'DF_MealPlans_CreatedAt', N'SYSUTCDATETIME()'),
    (N'MealPlans', N'UpdatedAt', N'DF_MealPlans_UpdatedAt', N'SYSUTCDATETIME()'),
    (N'MealPlanItems', N'SortOrder', N'DF_MealPlanItems_SortOrder', N'0'),
    (N'MealPlanItems', N'CreatedAt', N'DF_MealPlanItems_CreatedAt', N'SYSUTCDATETIME()'),
    (N'MealPlanItems', N'UpdatedAt', N'DF_MealPlanItems_UpdatedAt', N'SYSUTCDATETIME()');

    DECLARE @ExpectedIndexes TABLE (TableName SYSNAME, IndexName SYSNAME, KeyColumns NVARCHAR(500), IncludeColumns NVARCHAR(500));
    INSERT INTO @ExpectedIndexes VALUES
    (N'MealPlanItems', N'IX_MealPlanItems_Plan_Date_Type', N'MealPlanID,MealDate,MealType,SortOrder,MealPlanItemID', N'RecipeID,Servings'),
    (N'MealPlanItems', N'IX_MealPlanItems_RecipeID', N'RecipeID,MealPlanID', N'');

    -- Validate before any CREATE and again before COMMIT. Partial previous setup is
    -- resumed only when every already-existing table satisfies the full contract.
    DECLARE @Phase INT = 0;
    WHILE @Phase <= 1
    BEGIN
        DECLARE @Problem NVARCHAR(1000) = NULL;
        SELECT TOP (1) @Problem = CONCAT(e.TableName, N'.', e.ColumnName)
        FROM @ExpectedColumns AS e
        JOIN sys.tables AS t ON t.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
        LEFT JOIN sys.columns AS c ON c.object_id = t.object_id AND c.name COLLATE DATABASE_DEFAULT = e.ColumnName
        LEFT JOIN sys.identity_columns AS ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE c.column_id IS NULL OR TYPE_NAME(c.system_type_id) COLLATE DATABASE_DEFAULT <> e.TypeName
           OR c.user_type_id <> c.system_type_id OR c.max_length <> e.MaxLength OR c.scale <> e.NumericScale
           OR c.is_nullable <> 0 OR c.is_identity <> e.IsIdentity OR c.is_computed <> 0 OR c.generated_always_type <> 0
           OR (e.CollationName IS NOT NULL AND c.collation_name COLLATE DATABASE_DEFAULT <> e.CollationName)
           OR (e.IsIdentity = 1 AND (CONVERT(BIGINT, ic.seed_value) <> 1 OR CONVERT(BIGINT, ic.increment_value) <> 1));
        IF @Problem IS NULL
            SELECT TOP (1) @Problem = CONCAT(t.name, N'.', c.name, N' (cột ngoài thiết kế)')
            FROM sys.tables AS t JOIN sys.columns AS c ON c.object_id = t.object_id
            WHERE t.schema_id = SCHEMA_ID(N'dbo') AND t.name IN (N'MealPlans', N'MealPlanItems')
              AND NOT EXISTS (SELECT 1 FROM @ExpectedColumns AS e WHERE e.TableName = t.name COLLATE DATABASE_DEFAULT AND e.ColumnName = c.name COLLATE DATABASE_DEFAULT);

        IF @Problem IS NULL
            SELECT TOP (1) @Problem = e.KeyName
            FROM @ExpectedKeys AS e
            JOIN sys.tables AS t ON t.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
            LEFT JOIN sys.key_constraints AS k ON k.parent_object_id = t.object_id AND k.name COLLATE DATABASE_DEFAULT = e.KeyName
                AND k.type COLLATE DATABASE_DEFAULT = e.KeyType COLLATE DATABASE_DEFAULT
            LEFT JOIN sys.indexes AS ix ON ix.object_id = k.parent_object_id AND ix.index_id = k.unique_index_id
            OUTER APPLY (SELECT STUFF((SELECT N',' + c.name FROM sys.index_columns AS ic
                JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = ix.object_id AND ic.index_id = ix.index_id AND ic.key_ordinal > 0
                ORDER BY ic.key_ordinal FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'') AS ColumnsList) AS cols
            WHERE k.object_id IS NULL OR ix.is_disabled = 1 OR ix.is_hypothetical = 1 OR ix.has_filter = 1
               OR cols.ColumnsList COLLATE DATABASE_DEFAULT <> e.ColumnsList;

        IF @Problem IS NULL
            SELECT TOP (1) @Problem = e.KeyName
            FROM @ExpectedForeignKeys AS e
            JOIN sys.tables AS t ON t.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
            LEFT JOIN sys.foreign_keys AS fk ON fk.parent_object_id = t.object_id AND fk.name COLLATE DATABASE_DEFAULT = e.KeyName
            LEFT JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id AND fkc.constraint_column_id = 1
            WHERE fk.object_id IS NULL OR fk.referenced_object_id <> OBJECT_ID(N'dbo.' + e.ParentTable, N'U')
               OR COL_NAME(fkc.parent_object_id, fkc.parent_column_id) COLLATE DATABASE_DEFAULT <> e.ColumnName
               OR COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) COLLATE DATABASE_DEFAULT <> e.ParentColumn
               OR fk.is_disabled = 1 OR fk.is_not_trusted = 1 OR fk.is_not_for_replication = 1
               OR fk.delete_referential_action <> 0 OR fk.update_referential_action <> 0
               OR (SELECT COUNT(*) FROM sys.foreign_key_columns AS f WHERE f.constraint_object_id = fk.object_id) <> 1;

        -- Normalize SQL Server's added parentheses/brackets/whitespace only.
        -- SQL Server may canonicalize function/datepart casing. The MealType
        -- literals must still occur with the exact case required by BIN2.
        IF @Problem IS NULL
            SELECT TOP (1) @Problem = e.CheckName
            FROM @ExpectedChecks AS e
            JOIN sys.tables AS t ON t.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
            LEFT JOIN sys.check_constraints AS cc ON cc.parent_object_id = t.object_id AND cc.name COLLATE DATABASE_DEFAULT = e.CheckName
            CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cc.definition, N'(', N''), N')', N''), N'[', N''), N']', N''), N' ', N''), NCHAR(9), N''), NCHAR(13), N''), NCHAR(10), N'') AS Definition) AS actual
            CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(e.CheckDefinition, N'(', N''), N')', N''), N'[', N''), N']', N''), N' ', N''), NCHAR(9), N''), NCHAR(13), N''), NCHAR(10), N'') AS Definition) AS expected
            WHERE cc.object_id IS NULL OR cc.is_disabled = 1 OR cc.is_not_trusted = 1 OR cc.is_not_for_replication = 1
               OR LOWER(actual.Definition) COLLATE Latin1_General_100_BIN2 <> LOWER(expected.Definition) COLLATE Latin1_General_100_BIN2
               OR (e.CheckName = N'CK_MealPlanItems_MealType' AND
                   (CHARINDEX(N'''Breakfast''', cc.definition COLLATE Latin1_General_100_BIN2) = 0
                    OR CHARINDEX(N'''Lunch''', cc.definition COLLATE Latin1_General_100_BIN2) = 0
                    OR CHARINDEX(N'''Dinner''', cc.definition COLLATE Latin1_General_100_BIN2) = 0));

        IF @Problem IS NULL
            SELECT TOP (1) @Problem = e.DefaultName
            FROM @ExpectedDefaults AS e
            JOIN sys.tables AS t ON t.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
            LEFT JOIN sys.columns AS c ON c.object_id = t.object_id AND c.name COLLATE DATABASE_DEFAULT = e.ColumnName
            LEFT JOIN sys.default_constraints AS dc ON dc.parent_object_id = t.object_id AND dc.parent_column_id = c.column_id
            WHERE dc.object_id IS NULL OR dc.name COLLATE DATABASE_DEFAULT <> e.DefaultName
               OR REPLACE(REPLACE(REPLACE(UPPER(dc.definition), N'(', N''), N')', N''), N' ', N'') COLLATE DATABASE_DEFAULT
                  <> REPLACE(REPLACE(UPPER(e.DefaultDefinition), N'(', N''), N')', N'') COLLATE DATABASE_DEFAULT;

        IF @Problem IS NULL
            SELECT TOP (1) @Problem = e.IndexName
            FROM @ExpectedIndexes AS e
            JOIN sys.tables AS t ON t.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
            LEFT JOIN sys.indexes AS ix ON ix.object_id = t.object_id AND ix.name COLLATE DATABASE_DEFAULT = e.IndexName
            OUTER APPLY (SELECT STUFF((SELECT N',' + c.name FROM sys.index_columns AS ic
                JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = ix.object_id AND ic.index_id = ix.index_id AND ic.key_ordinal > 0
                ORDER BY ic.key_ordinal FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'') AS ColumnsList) AS keys
            OUTER APPLY (SELECT STUFF((SELECT N',' + c.name FROM sys.index_columns AS ic
                JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = ix.object_id AND ic.index_id = ix.index_id AND ic.is_included_column = 1
                ORDER BY ic.index_column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'') AS ColumnsList) AS includes
            WHERE ix.index_id IS NULL OR ix.type <> 2 OR ix.is_unique = 1 OR ix.is_disabled = 1 OR ix.is_hypothetical = 1 OR ix.has_filter = 1
               OR ISNULL(keys.ColumnsList, N'') COLLATE DATABASE_DEFAULT <> e.KeyColumns
               OR ISNULL(includes.ColumnsList, N'') COLLATE DATABASE_DEFAULT <> e.IncludeColumns
               OR EXISTS (SELECT 1 FROM sys.index_columns AS ic WHERE ic.object_id = ix.object_id AND ic.index_id = ix.index_id AND ic.is_descending_key = 1);

        IF @Problem IS NULL
            SELECT TOP (1) @Problem = CONCAT(o.name, N' (ràng buộc/trigger ngoài thiết kế)')
            FROM sys.objects AS o JOIN sys.tables AS t ON t.object_id = o.parent_object_id
            WHERE t.schema_id = SCHEMA_ID(N'dbo') AND t.name IN (N'MealPlans', N'MealPlanItems') AND o.type IN ('PK', 'UQ', 'F', 'C', 'D', 'TR')
              AND NOT EXISTS (SELECT 1 FROM @ExpectedKeys AS e WHERE e.TableName = t.name COLLATE DATABASE_DEFAULT AND e.KeyName = o.name COLLATE DATABASE_DEFAULT)
              AND NOT EXISTS (SELECT 1 FROM @ExpectedForeignKeys AS e WHERE e.TableName = t.name COLLATE DATABASE_DEFAULT AND e.KeyName = o.name COLLATE DATABASE_DEFAULT)
              AND NOT EXISTS (SELECT 1 FROM @ExpectedChecks AS e WHERE e.TableName = t.name COLLATE DATABASE_DEFAULT AND e.CheckName = o.name COLLATE DATABASE_DEFAULT)
              AND NOT EXISTS (SELECT 1 FROM @ExpectedDefaults AS e WHERE e.TableName = t.name COLLATE DATABASE_DEFAULT AND e.DefaultName = o.name COLLATE DATABASE_DEFAULT);

        IF @Problem IS NOT NULL
        BEGIN
            DECLARE @ContractError NVARCHAR(2048) = CONCAT(N'Migration dừng: cấu trúc không tương thích tại ', @Problem, N'. Không sửa/xóa đối tượng hoặc dữ liệu. Rà soát thủ công trước khi chạy lại.');
            THROW 51107, @ContractError, 1;
        END;

        IF @Phase = 0
        BEGIN
            IF OBJECT_ID(N'dbo.MealPlans', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.MealPlans (
                    MealPlanID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MealPlans PRIMARY KEY,
                    UserID INT NOT NULL,
                    WeekStartDate DATE NOT NULL,
                    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MealPlans_CreatedAt DEFAULT (SYSUTCDATETIME()),
                    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MealPlans_UpdatedAt DEFAULT (SYSUTCDATETIME()),
                    CONSTRAINT UQ_MealPlans_UserID_WeekStartDate UNIQUE (UserID, WeekStartDate),
                    CONSTRAINT FK_MealPlans_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE NO ACTION ON UPDATE NO ACTION,
                    CONSTRAINT CK_MealPlans_WeekStartDate CHECK (DATEDIFF(DAY, DATEFROMPARTS(1,1,1), WeekStartDate) % 7 = 0 AND WeekStartDate <= DATEFROMPARTS(9999,12,20)),
                    CONSTRAINT CK_MealPlans_Timestamps CHECK (UpdatedAt >= CreatedAt)
                );
            END;
            IF OBJECT_ID(N'dbo.MealPlanItems', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.MealPlanItems (
                    MealPlanItemID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MealPlanItems PRIMARY KEY,
                    MealPlanID INT NOT NULL,
                    RecipeID INT NOT NULL,
                    MealDate DATE NOT NULL,
                    MealType NVARCHAR(20) COLLATE Vietnamese_100_CI_AS NOT NULL,
                    Servings INT NOT NULL,
                    SortOrder INT NOT NULL CONSTRAINT DF_MealPlanItems_SortOrder DEFAULT (0),
                    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MealPlanItems_CreatedAt DEFAULT (SYSUTCDATETIME()),
                    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MealPlanItems_UpdatedAt DEFAULT (SYSUTCDATETIME()),
                    CONSTRAINT UQ_MealPlanItems_Plan_Date_Type_Recipe UNIQUE (MealPlanID, MealDate, MealType, RecipeID),
                    CONSTRAINT FK_MealPlanItems_MealPlans FOREIGN KEY (MealPlanID) REFERENCES dbo.MealPlans(MealPlanID) ON DELETE NO ACTION ON UPDATE NO ACTION,
                    CONSTRAINT FK_MealPlanItems_Recipes FOREIGN KEY (RecipeID) REFERENCES dbo.Recipes(RecipeID) ON DELETE NO ACTION ON UPDATE NO ACTION,
                    CONSTRAINT CK_MealPlanItems_MealDate CHECK (MealDate <= DATEFROMPARTS(9999,12,26)),
                    CONSTRAINT CK_MealPlanItems_MealType CHECK (
                        (MealType COLLATE Latin1_General_100_BIN2 = N'Breakfast' AND DATALENGTH(MealType) = 18)
                        OR (MealType COLLATE Latin1_General_100_BIN2 = N'Lunch' AND DATALENGTH(MealType) = 10)
                        OR (MealType COLLATE Latin1_General_100_BIN2 = N'Dinner' AND DATALENGTH(MealType) = 12)),
                    CONSTRAINT CK_MealPlanItems_Servings CHECK (Servings >= 1 AND Servings <= 20),
                    CONSTRAINT CK_MealPlanItems_SortOrder CHECK (SortOrder >= 0),
                    CONSTRAINT CK_MealPlanItems_Timestamps CHECK (UpdatedAt >= CreatedAt)
                );
                CREATE NONCLUSTERED INDEX IX_MealPlanItems_Plan_Date_Type
                    ON dbo.MealPlanItems (MealPlanID, MealDate, MealType, SortOrder, MealPlanItemID) INCLUDE (RecipeID, Servings);
                CREATE NONCLUSTERED INDEX IX_MealPlanItems_RecipeID ON dbo.MealPlanItems (RecipeID, MealPlanID);
            END;
        END;
        ELSE IF OBJECT_ID(N'dbo.MealPlans', N'U') IS NULL OR OBJECT_ID(N'dbo.MealPlanItems', N'U') IS NULL
            THROW 51108, N'Migration chưa tạo đủ hai bảng. Toàn bộ thao tác được rollback.', 1;
        SET @Phase += 1;
    END;

    COMMIT TRANSACTION;
    SELECT N'After' AS MigrationPhase, DB_NAME() AS DatabaseName,
        COUNT(*) AS DboTableCount FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo');
    SELECT N'MealPlans' AS TableName, COUNT_BIG(*) AS [RowCount] FROM dbo.MealPlans
    UNION ALL SELECT N'MealPlanItems', COUNT_BIG(*) FROM dbo.MealPlanItems;
    PRINT N'Migration 001 hoàn tất. Hai bảng mới hợp lệ; không thay đổi dữ liệu các bảng cũ.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
