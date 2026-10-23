/*
    SmartCookDB - SQL Server 2016+ (SSMS, no SQLCMD mode required).
    Safe to rerun: create missing objects; never drop, truncate, overwrite or migrate data.
    Existing tables must pass the metadata checks below. Review incompatible schemas
    manually instead of changing their columns or constraints automatically.
    Save/open this file as UTF-8 so that all Vietnamese Unicode literals are preserved.
*/
USE [master];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- CREATE DATABASE cannot run inside a user transaction.
IF @@TRANCOUNT <> 0
    THROW 51000, N'Chạy schema.sql ngoài transaction đang mở.', 1;

IF DB_ID(N'SmartCookDB') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE [SmartCookDB] COLLATE Vietnamese_100_CI_AS;');
    PRINT N'Đã tạo cơ sở dữ liệu SmartCookDB.';
END
ELSE
    PRINT N'SmartCookDB đã tồn tại; giữ nguyên database và dữ liệu.';
GO
USE [SmartCookDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Also protects master when SSMS continues after a failed CREATE DATABASE/USE batch.
IF DB_NAME() <> N'SmartCookDB'
    THROW 51001, N'Sai database hiện tại. Dừng; không tạo bảng ngoài SmartCookDB.', 1;

IF @@TRANCOUNT <> 0
    THROW 51002, N'Chạy schema.sql ngoài transaction đang mở.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @LockResult INT;
    EXEC @LockResult = sys.sp_getapplock
        @Resource = N'SmartCookDB.SchemaAndSeed',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 15000;
    IF @LockResult < 0
        THROW 51003, N'Không lấy được khóa thiết lập SmartCookDB. Hãy chạy lại sau.', 1;

    DECLARE @ExpectedColumns TABLE
    (
        TableName SYSNAME NOT NULL,
        ColumnName SYSNAME NOT NULL,
        TypeName SYSNAME NOT NULL,
        MaxLength SMALLINT NOT NULL,
        NumericPrecision TINYINT NULL,
        NumericScale TINYINT NULL,
        IsNullable BIT NOT NULL,
        IsIdentity BIT NOT NULL,
        CollationName SYSNAME NULL,
        PRIMARY KEY (TableName, ColumnName)
    );

    -- max_length is measured in bytes; -1 is NVARCHAR(MAX).
    INSERT INTO @ExpectedColumns VALUES
    (N'Users', N'UserID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'Users', N'FullName', N'nvarchar', 300, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Users', N'Email', N'nvarchar', 510, NULL, NULL, 0, 0, N'Latin1_General_100_CI_AS'),
    (N'Users', N'PasswordHash', N'nvarchar', 510, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Users', N'Phone', N'nvarchar', 40, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Users', N'Avatar', N'nvarchar', 1000, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Users', N'Role', N'nvarchar', 40, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Users', N'CreatedAt', N'datetime2', 6, NULL, 0, 0, 0, NULL),
    (N'Categories', N'CategoryID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'Categories', N'CategoryName', N'nvarchar', 300, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Categories', N'Description', N'nvarchar', 1000, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Categories', N'ImageUrl', N'nvarchar', 1000, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Recipes', N'RecipeID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'Recipes', N'CategoryID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Recipes', N'RecipeName', N'nvarchar', 400, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Recipes', N'Description', N'nvarchar', -1, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Recipes', N'ImageUrl', N'nvarchar', 1000, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Recipes', N'PrepTime', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Recipes', N'CookTime', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Recipes', N'Servings', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Recipes', N'Difficulty', N'nvarchar', 60, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Recipes', N'CreatedBy', N'int', 4, NULL, NULL, 1, 0, NULL),
    (N'Recipes', N'CreatedAt', N'datetime2', 6, NULL, 0, 0, 0, NULL),
    (N'Recipes', N'UpdatedAt', N'datetime2', 6, NULL, 0, 0, 0, NULL),
    (N'Ingredients', N'IngredientID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'Ingredients', N'IngredientName', N'nvarchar', 300, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Ingredients', N'IngredientCategory', N'nvarchar', 200, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Ingredients', N'DefaultUnit', N'nvarchar', 60, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'Ingredients', N'ImageUrl', N'nvarchar', 1000, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'RecipeIngredients', N'RecipeID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'RecipeIngredients', N'IngredientID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'RecipeIngredients', N'Quantity', N'decimal', 9, 12, 2, 0, 0, NULL),
    (N'RecipeIngredients', N'Unit', N'nvarchar', 60, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'RecipeIngredients', N'IsRequired', N'bit', 1, NULL, NULL, 0, 0, NULL),
    (N'RecipeIngredients', N'Notes', N'nvarchar', 510, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'CookingSteps', N'StepID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'CookingSteps', N'RecipeID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'CookingSteps', N'StepNumber', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'CookingSteps', N'Instruction', N'nvarchar', -1, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'CookingSteps', N'ImageUrl', N'nvarchar', 1000, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Favorites', N'FavoriteID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'Favorites', N'UserID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Favorites', N'RecipeID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Favorites', N'CreatedAt', N'datetime2', 6, NULL, 0, 0, 0, NULL),
    (N'Reviews', N'ReviewID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'Reviews', N'UserID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Reviews', N'RecipeID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Reviews', N'Rating', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'Reviews', N'Comment', N'nvarchar', -1, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'Reviews', N'CreatedAt', N'datetime2', 6, NULL, 0, 0, 0, NULL),
    (N'UserIngredients', N'UserIngredientID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'UserIngredients', N'UserID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'UserIngredients', N'IngredientID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'UserIngredients', N'Quantity', N'decimal', 9, 12, 2, 1, 0, NULL),
    (N'UserIngredients', N'Unit', N'nvarchar', 60, NULL, NULL, 1, 0, N'Vietnamese_100_CI_AS'),
    (N'UserIngredients', N'ExpiryDate', N'date', 3, NULL, NULL, 1, 0, NULL),
    (N'SearchHistory', N'SearchID', N'int', 4, NULL, NULL, 0, 1, NULL),
    (N'SearchHistory', N'UserID', N'int', 4, NULL, NULL, 0, 0, NULL),
    (N'SearchHistory', N'SearchKeyword', N'nvarchar', 510, NULL, NULL, 0, 0, N'Vietnamese_100_CI_AS'),
    (N'SearchHistory', N'SearchedAt', N'datetime2', 6, NULL, 0, 0, 0, NULL);

    DECLARE @IncompatibleColumn NVARCHAR(1000);
    SELECT TOP (1) @IncompatibleColumn = CONCAT(e.TableName, N'.', e.ColumnName)
    FROM @ExpectedColumns AS e
    JOIN sys.tables AS t ON t.object_id = OBJECT_ID(N'dbo.' + e.TableName, N'U')
    -- Catalog collation may differ from the database default (including existing databases).
    -- Normalize metadata strings before comparing them with database-scoped table variables.
    LEFT JOIN sys.columns AS c ON c.object_id = t.object_id AND c.name COLLATE DATABASE_DEFAULT = e.ColumnName
    LEFT JOIN sys.identity_columns AS ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE c.column_id IS NULL
       OR TYPE_NAME(c.system_type_id) COLLATE DATABASE_DEFAULT <> e.TypeName
       OR c.user_type_id <> c.system_type_id
       OR c.max_length <> e.MaxLength
       OR (e.NumericPrecision IS NOT NULL AND c.precision <> e.NumericPrecision)
       OR (e.NumericScale IS NOT NULL AND c.scale <> e.NumericScale)
       OR c.is_nullable <> e.IsNullable OR c.is_identity <> e.IsIdentity
       OR c.is_computed <> 0 OR c.generated_always_type <> 0
       OR (e.CollationName IS NOT NULL AND c.collation_name COLLATE DATABASE_DEFAULT <> e.CollationName)
       OR (e.IsIdentity = 1 AND
           (CONVERT(BIGINT, ic.seed_value) <> 1 OR CONVERT(BIGINT, ic.increment_value) <> 1))
    ORDER BY e.TableName, e.ColumnName;

    IF @IncompatibleColumn IS NULL
    BEGIN
        SELECT TOP (1) @IncompatibleColumn = CONCAT(t.name, N'.', c.name, N' (cột ngoài thiết kế)')
        FROM sys.tables AS t
        JOIN sys.columns AS c ON c.object_id = t.object_id
        WHERE t.schema_id = SCHEMA_ID(N'dbo')
          AND EXISTS (SELECT 1 FROM @ExpectedColumns AS e WHERE e.TableName = t.name COLLATE DATABASE_DEFAULT)
          AND NOT EXISTS (SELECT 1 FROM @ExpectedColumns AS e WHERE e.TableName = t.name COLLATE DATABASE_DEFAULT AND e.ColumnName = c.name COLLATE DATABASE_DEFAULT)
        ORDER BY t.name, c.column_id;
    END;

    IF @IncompatibleColumn IS NOT NULL
    BEGIN
        DECLARE @ColumnError NVARCHAR(2048) = CONCAT(
            N'Schema hiện có không tương thích tại ', @IncompatibleColumn,
            N'. Dừng; không tự thay đổi bảng/dữ liệu. Hãy rà soát migration thủ công.');
        THROW 51004, @ColumnError, 1;
    END;

    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Users
        (
            UserID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
            FullName NVARCHAR(150) COLLATE Vietnamese_100_CI_AS NOT NULL,
            Email NVARCHAR(255) COLLATE Latin1_General_100_CI_AS NOT NULL,
            PasswordHash NVARCHAR(255) COLLATE Vietnamese_100_CI_AS NOT NULL,
            Phone NVARCHAR(20) COLLATE Vietnamese_100_CI_AS NULL,
            Avatar NVARCHAR(500) COLLATE Vietnamese_100_CI_AS NULL,
            Role NVARCHAR(20) COLLATE Vietnamese_100_CI_AS NOT NULL CONSTRAINT DF_Users_Role DEFAULT (N'User'),
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT UQ_Users_Email UNIQUE (Email),
            CONSTRAINT CK_Users_FullName_NotBlank CHECK (LEN(LTRIM(RTRIM(FullName))) > 0),
            CONSTRAINT CK_Users_Email_Format CHECK
                (Email LIKE N'%_@_%._%' AND Email NOT LIKE N'% %'
                 AND DATALENGTH(Email) = DATALENGTH(LTRIM(RTRIM(Email)))),
            CONSTRAINT CK_Users_PasswordHash_NotBlank CHECK (LEN(LTRIM(RTRIM(PasswordHash))) > 0),
            CONSTRAINT CK_Users_Phone_NotBlank CHECK (Phone IS NULL OR LEN(LTRIM(RTRIM(Phone))) > 0),
            CONSTRAINT CK_Users_Avatar_NotBlank CHECK (Avatar IS NULL OR LEN(LTRIM(RTRIM(Avatar))) > 0),
            CONSTRAINT CK_Users_Role CHECK
                ((Role COLLATE Latin1_General_100_BIN2 = N'User' AND DATALENGTH(Role) = 8)
                 OR (Role COLLATE Latin1_General_100_BIN2 = N'Admin' AND DATALENGTH(Role) = 10))
        );
    END;

    IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Categories
        (
            CategoryID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
            CategoryName NVARCHAR(150) COLLATE Vietnamese_100_CI_AS NOT NULL,
            Description NVARCHAR(500) COLLATE Vietnamese_100_CI_AS NULL,
            ImageUrl NVARCHAR(500) COLLATE Vietnamese_100_CI_AS NULL,
            CONSTRAINT UQ_Categories_CategoryName UNIQUE (CategoryName),
            CONSTRAINT CK_Categories_CategoryName_NotBlank CHECK (LEN(LTRIM(RTRIM(CategoryName))) > 0),
            CONSTRAINT CK_Categories_Description_NotBlank CHECK (Description IS NULL OR LEN(LTRIM(RTRIM(Description))) > 0),
            CONSTRAINT CK_Categories_ImageUrl_NotBlank CHECK (ImageUrl IS NULL OR LEN(LTRIM(RTRIM(ImageUrl))) > 0)
        );
    END;

    IF OBJECT_ID(N'dbo.Ingredients', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Ingredients
        (
            IngredientID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Ingredients PRIMARY KEY,
            IngredientName NVARCHAR(150) COLLATE Vietnamese_100_CI_AS NOT NULL,
            IngredientCategory NVARCHAR(100) COLLATE Vietnamese_100_CI_AS NOT NULL,
            DefaultUnit NVARCHAR(30) COLLATE Vietnamese_100_CI_AS NOT NULL,
            ImageUrl NVARCHAR(500) COLLATE Vietnamese_100_CI_AS NULL,
            CONSTRAINT UQ_Ingredients_IngredientName UNIQUE (IngredientName),
            CONSTRAINT CK_Ingredients_IngredientName_NotBlank CHECK (LEN(LTRIM(RTRIM(IngredientName))) > 0),
            CONSTRAINT CK_Ingredients_IngredientCategory_NotBlank CHECK (LEN(LTRIM(RTRIM(IngredientCategory))) > 0),
            CONSTRAINT CK_Ingredients_DefaultUnit_NotBlank CHECK (LEN(LTRIM(RTRIM(DefaultUnit))) > 0),
            CONSTRAINT CK_Ingredients_ImageUrl_NotBlank CHECK (ImageUrl IS NULL OR LEN(LTRIM(RTRIM(ImageUrl))) > 0)
        );
    END;

    IF OBJECT_ID(N'dbo.Recipes', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Recipes
        (
            RecipeID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Recipes PRIMARY KEY,
            CategoryID INT NOT NULL,
            RecipeName NVARCHAR(200) COLLATE Vietnamese_100_CI_AS NOT NULL,
            Description NVARCHAR(MAX) COLLATE Vietnamese_100_CI_AS NULL,
            ImageUrl NVARCHAR(500) COLLATE Vietnamese_100_CI_AS NULL,
            PrepTime INT NOT NULL,
            CookTime INT NOT NULL,
            Servings INT NOT NULL,
            Difficulty NVARCHAR(30) COLLATE Vietnamese_100_CI_AS NOT NULL,
            CreatedBy INT NULL,
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Recipes_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Recipes_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_Recipes_Categories FOREIGN KEY (CategoryID) REFERENCES dbo.Categories(CategoryID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT FK_Recipes_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT CK_Recipes_RecipeName_NotBlank CHECK (LEN(LTRIM(RTRIM(RecipeName))) > 0),
            CONSTRAINT CK_Recipes_Description_NotBlank CHECK (Description IS NULL OR LEN(LTRIM(RTRIM(Description))) > 0),
            CONSTRAINT CK_Recipes_ImageUrl_NotBlank CHECK (ImageUrl IS NULL OR LEN(LTRIM(RTRIM(ImageUrl))) > 0),
            CONSTRAINT CK_Recipes_Times CHECK
                (PrepTime >= 0 AND CookTime >= 0 AND CONVERT(BIGINT, PrepTime) + CONVERT(BIGINT, CookTime) > 0),
            CONSTRAINT CK_Recipes_Servings CHECK (Servings > 0),
            CONSTRAINT CK_Recipes_Difficulty CHECK
                (Difficulty COLLATE Latin1_General_100_BIN2 IN (N'Dễ', N'Trung bình', N'Khó')
                 AND DATALENGTH(Difficulty) = DATALENGTH(LTRIM(RTRIM(Difficulty)))),
            CONSTRAINT CK_Recipes_Timestamps CHECK (UpdatedAt >= CreatedAt)
        );
    END;

    IF OBJECT_ID(N'dbo.RecipeIngredients', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.RecipeIngredients
        (
            RecipeID INT NOT NULL,
            IngredientID INT NOT NULL,
            Quantity DECIMAL(12,2) NOT NULL,
            Unit NVARCHAR(30) COLLATE Vietnamese_100_CI_AS NOT NULL,
            IsRequired BIT NOT NULL CONSTRAINT DF_RecipeIngredients_IsRequired DEFAULT (1),
            Notes NVARCHAR(255) COLLATE Vietnamese_100_CI_AS NULL,
            CONSTRAINT PK_RecipeIngredients PRIMARY KEY (RecipeID, IngredientID),
            CONSTRAINT FK_RecipeIngredients_Recipes FOREIGN KEY (RecipeID) REFERENCES dbo.Recipes(RecipeID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT FK_RecipeIngredients_Ingredients FOREIGN KEY (IngredientID) REFERENCES dbo.Ingredients(IngredientID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT CK_RecipeIngredients_Quantity CHECK (Quantity > 0),
            CONSTRAINT CK_RecipeIngredients_Unit_NotBlank CHECK (LEN(LTRIM(RTRIM(Unit))) > 0),
            CONSTRAINT CK_RecipeIngredients_Notes_NotBlank CHECK (Notes IS NULL OR LEN(LTRIM(RTRIM(Notes))) > 0)
        );
    END;

    IF OBJECT_ID(N'dbo.CookingSteps', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.CookingSteps
        (
            StepID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CookingSteps PRIMARY KEY,
            RecipeID INT NOT NULL,
            StepNumber INT NOT NULL,
            Instruction NVARCHAR(MAX) COLLATE Vietnamese_100_CI_AS NOT NULL,
            ImageUrl NVARCHAR(500) COLLATE Vietnamese_100_CI_AS NULL,
            CONSTRAINT UQ_CookingSteps_RecipeID_StepNumber UNIQUE (RecipeID, StepNumber),
            CONSTRAINT FK_CookingSteps_Recipes FOREIGN KEY (RecipeID) REFERENCES dbo.Recipes(RecipeID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT CK_CookingSteps_StepNumber CHECK (StepNumber > 0),
            CONSTRAINT CK_CookingSteps_Instruction_NotBlank CHECK (LEN(LTRIM(RTRIM(Instruction))) > 0),
            CONSTRAINT CK_CookingSteps_ImageUrl_NotBlank CHECK (ImageUrl IS NULL OR LEN(LTRIM(RTRIM(ImageUrl))) > 0)
        );
    END;

    IF OBJECT_ID(N'dbo.Favorites', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Favorites
        (
            FavoriteID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Favorites PRIMARY KEY,
            UserID INT NOT NULL,
            RecipeID INT NOT NULL,
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Favorites_CreatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT UQ_Favorites_UserID_RecipeID UNIQUE (UserID, RecipeID),
            CONSTRAINT FK_Favorites_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT FK_Favorites_Recipes FOREIGN KEY (RecipeID) REFERENCES dbo.Recipes(RecipeID) ON DELETE NO ACTION ON UPDATE NO ACTION
        );
    END;

    IF OBJECT_ID(N'dbo.Reviews', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Reviews
        (
            ReviewID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Reviews PRIMARY KEY,
            UserID INT NOT NULL,
            RecipeID INT NOT NULL,
            Rating INT NOT NULL,
            Comment NVARCHAR(MAX) COLLATE Vietnamese_100_CI_AS NULL,
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Reviews_CreatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT UQ_Reviews_UserID_RecipeID UNIQUE (UserID, RecipeID),
            CONSTRAINT FK_Reviews_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT FK_Reviews_Recipes FOREIGN KEY (RecipeID) REFERENCES dbo.Recipes(RecipeID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT CK_Reviews_Rating CHECK (Rating BETWEEN 1 AND 5),
            CONSTRAINT CK_Reviews_Comment_NotBlank CHECK (Comment IS NULL OR LEN(LTRIM(RTRIM(Comment))) > 0)
        );
    END;

    IF OBJECT_ID(N'dbo.UserIngredients', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.UserIngredients
        (
            UserIngredientID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserIngredients PRIMARY KEY,
            UserID INT NOT NULL,
            IngredientID INT NOT NULL,
            Quantity DECIMAL(12,2) NULL,
            Unit NVARCHAR(30) COLLATE Vietnamese_100_CI_AS NULL,
            ExpiryDate DATE NULL,
            CONSTRAINT UQ_UserIngredients_UserID_IngredientID UNIQUE (UserID, IngredientID),
            CONSTRAINT FK_UserIngredients_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT FK_UserIngredients_Ingredients FOREIGN KEY (IngredientID) REFERENCES dbo.Ingredients(IngredientID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT CK_UserIngredients_Quantity CHECK (Quantity IS NULL OR Quantity > 0),
            CONSTRAINT CK_UserIngredients_Unit_NotBlank CHECK (Unit IS NULL OR LEN(LTRIM(RTRIM(Unit))) > 0),
            CONSTRAINT CK_UserIngredients_QuantityUnit CHECK (Quantity IS NULL OR Unit IS NOT NULL)
        );
    END;

    IF OBJECT_ID(N'dbo.SearchHistory', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.SearchHistory
        (
            SearchID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SearchHistory PRIMARY KEY,
            UserID INT NOT NULL,
            SearchKeyword NVARCHAR(255) COLLATE Vietnamese_100_CI_AS NOT NULL,
            SearchedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SearchHistory_SearchedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_SearchHistory_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE NO ACTION ON UPDATE NO ACTION,
            CONSTRAINT CK_SearchHistory_SearchKeyword_NotBlank CHECK (LEN(LTRIM(RTRIM(SearchKeyword))) > 0)
        );
    END;

    -- PK and UNIQUE constraints create their own indexes. Only add uncovered query/FK paths.
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Recipes') AND name = N'IX_Recipes_CategoryID')
        CREATE INDEX IX_Recipes_CategoryID ON dbo.Recipes (CategoryID, RecipeName);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Recipes') AND name = N'IX_Recipes_CreatedBy')
        CREATE INDEX IX_Recipes_CreatedBy ON dbo.Recipes (CreatedBy);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Recipes') AND name = N'IX_Recipes_RecipeName')
        CREATE INDEX IX_Recipes_RecipeName ON dbo.Recipes (RecipeName);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.RecipeIngredients') AND name = N'IX_RecipeIngredients_IngredientID')
        CREATE INDEX IX_RecipeIngredients_IngredientID ON dbo.RecipeIngredients (IngredientID, RecipeID);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Favorites') AND name = N'IX_Favorites_RecipeID')
        CREATE INDEX IX_Favorites_RecipeID ON dbo.Favorites (RecipeID, UserID);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Reviews') AND name = N'IX_Reviews_RecipeID')
        CREATE INDEX IX_Reviews_RecipeID ON dbo.Reviews (RecipeID, CreatedAt DESC);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.UserIngredients') AND name = N'IX_UserIngredients_IngredientID')
        CREATE INDEX IX_UserIngredients_IngredientID ON dbo.UserIngredients (IngredientID, UserID);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.SearchHistory') AND name = N'IX_SearchHistory_UserID_SearchedAt')
        CREATE INDEX IX_SearchHistory_UserID_SearchedAt ON dbo.SearchHistory (UserID, SearchedAt DESC);

    -- Existing tables are not migrated. Require the documented named keys, CHECKs and defaults.
    DECLARE @ExpectedKeys TABLE
    (
        TableName SYSNAME NOT NULL, ConstraintName SYSNAME NOT NULL,
        Kind CHAR(2) NOT NULL, ColumnName SYSNAME NOT NULL, KeyOrdinal INT NOT NULL
    );
    INSERT INTO @ExpectedKeys VALUES
    (N'Users', N'PK_Users', 'PK', N'UserID', 1),
    (N'Categories', N'PK_Categories', 'PK', N'CategoryID', 1),
    (N'Recipes', N'PK_Recipes', 'PK', N'RecipeID', 1),
    (N'Ingredients', N'PK_Ingredients', 'PK', N'IngredientID', 1),
    (N'RecipeIngredients', N'PK_RecipeIngredients', 'PK', N'RecipeID', 1),
    (N'RecipeIngredients', N'PK_RecipeIngredients', 'PK', N'IngredientID', 2),
    (N'CookingSteps', N'PK_CookingSteps', 'PK', N'StepID', 1),
    (N'Favorites', N'PK_Favorites', 'PK', N'FavoriteID', 1),
    (N'Reviews', N'PK_Reviews', 'PK', N'ReviewID', 1),
    (N'UserIngredients', N'PK_UserIngredients', 'PK', N'UserIngredientID', 1),
    (N'SearchHistory', N'PK_SearchHistory', 'PK', N'SearchID', 1),
    (N'Users', N'UQ_Users_Email', 'UQ', N'Email', 1),
    (N'Categories', N'UQ_Categories_CategoryName', 'UQ', N'CategoryName', 1),
    (N'Ingredients', N'UQ_Ingredients_IngredientName', 'UQ', N'IngredientName', 1),
    (N'CookingSteps', N'UQ_CookingSteps_RecipeID_StepNumber', 'UQ', N'RecipeID', 1),
    (N'CookingSteps', N'UQ_CookingSteps_RecipeID_StepNumber', 'UQ', N'StepNumber', 2),
    (N'Favorites', N'UQ_Favorites_UserID_RecipeID', 'UQ', N'UserID', 1),
    (N'Favorites', N'UQ_Favorites_UserID_RecipeID', 'UQ', N'RecipeID', 2),
    (N'Reviews', N'UQ_Reviews_UserID_RecipeID', 'UQ', N'UserID', 1),
    (N'Reviews', N'UQ_Reviews_UserID_RecipeID', 'UQ', N'RecipeID', 2),
    (N'UserIngredients', N'UQ_UserIngredients_UserID_IngredientID', 'UQ', N'UserID', 1),
    (N'UserIngredients', N'UQ_UserIngredients_UserID_IngredientID', 'UQ', N'IngredientID', 2);

    IF EXISTS
    (
        SELECT 1 FROM @ExpectedKeys AS e
        LEFT JOIN sys.key_constraints AS k ON k.parent_object_id = OBJECT_ID(N'dbo.' + e.TableName)
            AND k.name COLLATE DATABASE_DEFAULT = e.ConstraintName AND k.type COLLATE DATABASE_DEFAULT = e.Kind
        LEFT JOIN sys.indexes AS i ON i.object_id = k.parent_object_id AND i.index_id = k.unique_index_id
        LEFT JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = e.KeyOrdinal
        LEFT JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE k.object_id IS NULL OR i.is_disabled = 1 OR i.ignore_dup_key = 1
           OR c.name IS NULL OR c.name COLLATE DATABASE_DEFAULT <> e.ColumnName
           OR (SELECT COUNT(*) FROM sys.index_columns AS a WHERE a.object_id = i.object_id AND a.index_id = i.index_id AND a.key_ordinal > 0)
              <> (SELECT COUNT(*) FROM @ExpectedKeys AS a WHERE a.TableName = e.TableName AND a.ConstraintName = e.ConstraintName)
    )
        THROW 51005, N'PK/UNIQUE hiện có thiếu hoặc không tương thích; không tự sửa bảng/dữ liệu.', 1;

    DECLARE @ExpectedForeignKeys TABLE
    (
        TableName SYSNAME, ConstraintName SYSNAME, ColumnName SYSNAME,
        ReferencedTable SYSNAME, ReferencedColumn SYSNAME
    );
    INSERT INTO @ExpectedForeignKeys VALUES
    (N'Recipes', N'FK_Recipes_Categories', N'CategoryID', N'Categories', N'CategoryID'),
    (N'Recipes', N'FK_Recipes_Users', N'CreatedBy', N'Users', N'UserID'),
    (N'RecipeIngredients', N'FK_RecipeIngredients_Recipes', N'RecipeID', N'Recipes', N'RecipeID'),
    (N'RecipeIngredients', N'FK_RecipeIngredients_Ingredients', N'IngredientID', N'Ingredients', N'IngredientID'),
    (N'CookingSteps', N'FK_CookingSteps_Recipes', N'RecipeID', N'Recipes', N'RecipeID'),
    (N'Favorites', N'FK_Favorites_Users', N'UserID', N'Users', N'UserID'),
    (N'Favorites', N'FK_Favorites_Recipes', N'RecipeID', N'Recipes', N'RecipeID'),
    (N'Reviews', N'FK_Reviews_Users', N'UserID', N'Users', N'UserID'),
    (N'Reviews', N'FK_Reviews_Recipes', N'RecipeID', N'Recipes', N'RecipeID'),
    (N'UserIngredients', N'FK_UserIngredients_Users', N'UserID', N'Users', N'UserID'),
    (N'UserIngredients', N'FK_UserIngredients_Ingredients', N'IngredientID', N'Ingredients', N'IngredientID'),
    (N'SearchHistory', N'FK_SearchHistory_Users', N'UserID', N'Users', N'UserID');

    IF EXISTS
    (
        SELECT 1 FROM @ExpectedForeignKeys AS e
        LEFT JOIN sys.foreign_keys AS f ON f.parent_object_id = OBJECT_ID(N'dbo.' + e.TableName) AND f.name COLLATE DATABASE_DEFAULT = e.ConstraintName
        LEFT JOIN sys.foreign_key_columns AS fc ON fc.constraint_object_id = f.object_id AND fc.constraint_column_id = 1
        WHERE f.object_id IS NULL OR f.is_disabled = 1 OR f.is_not_trusted = 1
           OR f.delete_referential_action <> 0 OR f.update_referential_action <> 0 OR f.is_not_for_replication = 1
           OR fc.parent_column_id <> COLUMNPROPERTY(OBJECT_ID(N'dbo.' + e.TableName), e.ColumnName, 'ColumnId')
           OR f.referenced_object_id <> OBJECT_ID(N'dbo.' + e.ReferencedTable)
           OR fc.referenced_column_id <> COLUMNPROPERTY(OBJECT_ID(N'dbo.' + e.ReferencedTable), e.ReferencedColumn, 'ColumnId')
           OR (SELECT COUNT(*) FROM sys.foreign_key_columns AS a WHERE a.constraint_object_id = f.object_id) <> 1
    )
        THROW 51006, N'FK hiện có thiếu, không trusted hoặc không đúng quan hệ NO ACTION; không tự sửa dữ liệu.', 1;

    DECLARE @ExpectedChecks TABLE (TableName SYSNAME, ConstraintName SYSNAME);
    INSERT INTO @ExpectedChecks VALUES
    (N'Users', N'CK_Users_FullName_NotBlank'), (N'Users', N'CK_Users_Email_Format'),
    (N'Users', N'CK_Users_PasswordHash_NotBlank'), (N'Users', N'CK_Users_Phone_NotBlank'),
    (N'Users', N'CK_Users_Avatar_NotBlank'), (N'Users', N'CK_Users_Role'),
    (N'Categories', N'CK_Categories_CategoryName_NotBlank'), (N'Categories', N'CK_Categories_Description_NotBlank'),
    (N'Categories', N'CK_Categories_ImageUrl_NotBlank'),
    (N'Ingredients', N'CK_Ingredients_IngredientName_NotBlank'), (N'Ingredients', N'CK_Ingredients_IngredientCategory_NotBlank'),
    (N'Ingredients', N'CK_Ingredients_DefaultUnit_NotBlank'), (N'Ingredients', N'CK_Ingredients_ImageUrl_NotBlank'),
    (N'Recipes', N'CK_Recipes_RecipeName_NotBlank'), (N'Recipes', N'CK_Recipes_Description_NotBlank'),
    (N'Recipes', N'CK_Recipes_ImageUrl_NotBlank'), (N'Recipes', N'CK_Recipes_Times'),
    (N'Recipes', N'CK_Recipes_Servings'), (N'Recipes', N'CK_Recipes_Difficulty'), (N'Recipes', N'CK_Recipes_Timestamps'),
    (N'RecipeIngredients', N'CK_RecipeIngredients_Quantity'), (N'RecipeIngredients', N'CK_RecipeIngredients_Unit_NotBlank'),
    (N'RecipeIngredients', N'CK_RecipeIngredients_Notes_NotBlank'),
    (N'CookingSteps', N'CK_CookingSteps_StepNumber'), (N'CookingSteps', N'CK_CookingSteps_Instruction_NotBlank'),
    (N'CookingSteps', N'CK_CookingSteps_ImageUrl_NotBlank'),
    (N'Reviews', N'CK_Reviews_Rating'), (N'Reviews', N'CK_Reviews_Comment_NotBlank'),
    (N'UserIngredients', N'CK_UserIngredients_Quantity'), (N'UserIngredients', N'CK_UserIngredients_Unit_NotBlank'),
    (N'UserIngredients', N'CK_UserIngredients_QuantityUnit'), (N'SearchHistory', N'CK_SearchHistory_SearchKeyword_NotBlank');

    IF EXISTS
    (
        SELECT 1 FROM @ExpectedChecks AS e
        LEFT JOIN sys.check_constraints AS c ON c.parent_object_id = OBJECT_ID(N'dbo.' + e.TableName) AND c.name COLLATE DATABASE_DEFAULT = e.ConstraintName
        WHERE c.object_id IS NULL OR c.is_disabled = 1 OR c.is_not_trusted = 1 OR c.is_not_for_replication = 1
    )
        THROW 51007, N'CHECK hiện có thiếu, bị vô hiệu hóa hoặc không trusted; không tự sửa dữ liệu.', 1;

    DECLARE @ExpectedDefaults TABLE (TableName SYSNAME, ColumnName SYSNAME, ConstraintName SYSNAME, NormalizedDefinition NVARCHAR(200));
    INSERT INTO @ExpectedDefaults VALUES
    (N'Users', N'Role', N'DF_Users_Role', N'n''user'''),
    (N'Users', N'CreatedAt', N'DF_Users_CreatedAt', N'sysutcdatetime'),
    (N'Recipes', N'CreatedAt', N'DF_Recipes_CreatedAt', N'sysutcdatetime'),
    (N'Recipes', N'UpdatedAt', N'DF_Recipes_UpdatedAt', N'sysutcdatetime'),
    (N'RecipeIngredients', N'IsRequired', N'DF_RecipeIngredients_IsRequired', N'1'),
    (N'Favorites', N'CreatedAt', N'DF_Favorites_CreatedAt', N'sysutcdatetime'),
    (N'Reviews', N'CreatedAt', N'DF_Reviews_CreatedAt', N'sysutcdatetime'),
    (N'SearchHistory', N'SearchedAt', N'DF_SearchHistory_SearchedAt', N'sysutcdatetime');

    IF EXISTS
    (
        SELECT 1 FROM @ExpectedDefaults AS e
        LEFT JOIN sys.default_constraints AS d ON d.parent_object_id = OBJECT_ID(N'dbo.' + e.TableName)
            AND d.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + e.TableName), e.ColumnName, 'ColumnId') AND d.name COLLATE DATABASE_DEFAULT = e.ConstraintName
        WHERE d.object_id IS NULL
           OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(d.definition, N'(', N''), N')', N''), N' ', N''), N'[', N''), N']', N'')) COLLATE DATABASE_DEFAULT <> e.NormalizedDefinition
    )
        THROW 51008, N'DEFAULT hiện có thiếu hoặc không tương thích; không tự sửa dữ liệu.', 1;

    DECLARE @ExpectedIndexes TABLE
        (TableName SYSNAME, IndexName SYSNAME, ColumnName SYSNAME, KeyOrdinal INT, IsDescending BIT);
    INSERT INTO @ExpectedIndexes VALUES
    (N'Recipes', N'IX_Recipes_CategoryID', N'CategoryID', 1, 0),
    (N'Recipes', N'IX_Recipes_CategoryID', N'RecipeName', 2, 0),
    (N'Recipes', N'IX_Recipes_CreatedBy', N'CreatedBy', 1, 0),
    (N'Recipes', N'IX_Recipes_RecipeName', N'RecipeName', 1, 0),
    (N'RecipeIngredients', N'IX_RecipeIngredients_IngredientID', N'IngredientID', 1, 0),
    (N'RecipeIngredients', N'IX_RecipeIngredients_IngredientID', N'RecipeID', 2, 0),
    (N'Favorites', N'IX_Favorites_RecipeID', N'RecipeID', 1, 0),
    (N'Favorites', N'IX_Favorites_RecipeID', N'UserID', 2, 0),
    (N'Reviews', N'IX_Reviews_RecipeID', N'RecipeID', 1, 0),
    (N'Reviews', N'IX_Reviews_RecipeID', N'CreatedAt', 2, 1),
    (N'UserIngredients', N'IX_UserIngredients_IngredientID', N'IngredientID', 1, 0),
    (N'UserIngredients', N'IX_UserIngredients_IngredientID', N'UserID', 2, 0),
    (N'SearchHistory', N'IX_SearchHistory_UserID_SearchedAt', N'UserID', 1, 0),
    (N'SearchHistory', N'IX_SearchHistory_UserID_SearchedAt', N'SearchedAt', 2, 1);

    IF EXISTS
    (
        SELECT 1 FROM @ExpectedIndexes AS e
        LEFT JOIN sys.indexes AS i ON i.object_id = OBJECT_ID(N'dbo.' + e.TableName) AND i.name COLLATE DATABASE_DEFAULT = e.IndexName
        LEFT JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = e.KeyOrdinal
        LEFT JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.index_id IS NULL OR i.type <> 2 OR i.is_disabled = 1 OR i.is_hypothetical = 1 OR i.has_filter = 1
           OR c.name IS NULL OR c.name COLLATE DATABASE_DEFAULT <> e.ColumnName OR ic.is_descending_key <> e.IsDescending
           OR (SELECT COUNT(*) FROM sys.index_columns AS a WHERE a.object_id = i.object_id AND a.index_id = i.index_id AND a.key_ordinal > 0)
              <> (SELECT COUNT(*) FROM @ExpectedIndexes AS a WHERE a.TableName = e.TableName AND a.IndexName = e.IndexName)
    )
        THROW 51009, N'Index hiện có không tương thích; không tự thay đổi index của dữ liệu đã có.', 1;

    COMMIT TRANSACTION;
    PRINT N'Schema SmartCookDB đã sẵn sàng: 10 bảng, 12 FK, không thay đổi dữ liệu đã có.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;