/*
    SmartCookDB - Du lieu mau Unicode, Microsoft SQL Server 2016+.
    Chay schema.sql truoc, sau do mo file nay bang SSMS va Execute.
    8 danh muc, 64 nguyen lieu, 20 mon, 148 thanh phan, 80 buoc nau.
    Khong tao tai khoan, mat khau, danh gia hoac du lieu ca nhan.
    Khong ghi de: mon co cung (CategoryID, RecipeName) duoc giu nguyen,
    ke ca thanh phan va buoc nau cua mon do. Khong sua mon da co.
    ImageUrl = NULL vi chua co anh da xac minh quyen su dung.
*/
USE [SmartCookDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'SmartCookDB'
    THROW 51024, N'Sai database hiện tại. Không ghi dữ liệu ngoài SmartCookDB.', 1;
IF @@TRANCOUNT <> 0
    THROW 51025, N'Chạy seed.sql ngoài transaction đang mở.', 1;

IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Ingredients', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Recipes', N'U') IS NULL
   OR OBJECT_ID(N'dbo.RecipeIngredients', N'U') IS NULL
   OR OBJECT_ID(N'dbo.CookingSteps', N'U') IS NULL
    THROW 51020, N'Thiếu bảng SmartCookDB. Hãy chạy schema.sql thành công trước seed.sql.', 1;

DECLARE @Categories TABLE (
    CategoryName NVARCHAR(150) COLLATE Vietnamese_100_CI_AS NOT NULL PRIMARY KEY,
    Description NVARCHAR(500) NOT NULL
);
INSERT INTO @Categories (CategoryName, Description) VALUES
(N'Món chiên', N'Món chiên áp chảo hoặc chiên vàng, phù hợp bữa cơm gia đình.'),
(N'Món xào', N'Nguyên liệu xào nhanh để giữ độ giòn và vị tươi.'),
(N'Món kho', N'Món kho đậm đà, nấu lửa nhỏ để nguyên liệu thấm vị.'),
(N'Món canh', N'Canh rau, thịt và cá dùng cùng cơm.'),
(N'Cơm và cháo', N'Món cơm, cháo dùng làm bữa chính hoặc bữa nhẹ.'),
(N'Món sốt', N'Món ăn kết hợp cùng nước sốt sánh, dễ ăn với cơm.'),
(N'Món luộc', N'Món luộc đơn giản, ít dầu và dễ chuẩn bị.'),
(N'Món hấp', N'Món làm chín bằng hơi nước, giữ vị ngọt tự nhiên.');

DECLARE @Ingredients TABLE (
    IngredientName NVARCHAR(150) COLLATE Vietnamese_100_CI_AS NOT NULL PRIMARY KEY,
    IngredientCategory NVARCHAR(100) NOT NULL,
    DefaultUnit NVARCHAR(30) NOT NULL
);
INSERT INTO @Ingredients (IngredientName, IngredientCategory, DefaultUnit) VALUES
(N'Trứng gà', N'Trứng', N'quả'),
(N'Thịt ba chỉ', N'Thịt', N'g'),
(N'Thịt heo xay', N'Thịt', N'g'),
(N'Thịt gà', N'Thịt', N'g'),
(N'Thịt bò', N'Thịt', N'g'),
(N'Cá lóc', N'Thủy sản', N'g'),
(N'Cá rô phi', N'Thủy sản', N'g'),
(N'Cá basa', N'Thủy sản', N'g'),
(N'Tôm', N'Thủy sản', N'g'),
(N'Đậu hũ', N'Đậu và chế phẩm', N'g'),
(N'Cà chua', N'Rau củ', N'g'),
(N'Bí đỏ', N'Rau củ', N'g'),
(N'Rau muống', N'Rau củ', N'g'),
(N'Rau ngót', N'Rau củ', N'g'),
(N'Bắp cải', N'Rau củ', N'g'),
(N'Cà rốt', N'Rau củ', N'g'),
(N'Su su', N'Rau củ', N'g'),
(N'Hành tây', N'Rau củ', N'g'),
(N'Hành lá', N'Rau thơm', N'g'),
(N'Hành tím', N'Gia vị tươi', N'g'),
(N'Tỏi', N'Gia vị tươi', N'g'),
(N'Gừng', N'Gia vị tươi', N'g'),
(N'Sả', N'Gia vị tươi', N'g'),
(N'Ớt', N'Gia vị tươi', N'g'),
(N'Chanh', N'Trái cây', N'quả'),
(N'Me', N'Gia vị', N'g'),
(N'Thơm', N'Rau củ', N'g'),
(N'Đậu bắp', N'Rau củ', N'g'),
(N'Bạc hà', N'Rau củ', N'g'),
(N'Giá đỗ', N'Rau củ', N'g'),
(N'Ngò om', N'Rau thơm', N'g'),
(N'Ngò gai', N'Rau thơm', N'g'),
(N'Rau mùi', N'Rau thơm', N'g'),
(N'Thì là', N'Rau thơm', N'g'),
(N'Nấm hương', N'Nấm', N'g'),
(N'Nấm rơm', N'Nấm', N'g'),
(N'Dưa leo', N'Rau củ', N'g'),
(N'Khoai tây', N'Rau củ', N'g'),
(N'Khoai lang', N'Rau củ', N'g'),
(N'Cải thìa', N'Rau củ', N'g'),
(N'Cải ngọt', N'Rau củ', N'g'),
(N'Rau dền', N'Rau củ', N'g'),
(N'Mồng tơi', N'Rau củ', N'g'),
(N'Mướp', N'Rau củ', N'g'),
(N'Bầu', N'Rau củ', N'g'),
(N'Củ cải trắng', N'Rau củ', N'g'),
(N'Gạo tẻ', N'Gạo và tinh bột', N'g'),
(N'Gạo nếp', N'Gạo và tinh bột', N'g'),
(N'Cơm nguội', N'Gạo và tinh bột', N'g'),
(N'Bún tươi', N'Gạo và tinh bột', N'g'),
(N'Bánh phở', N'Gạo và tinh bột', N'g'),
(N'Miến', N'Gạo và tinh bột', N'g'),
(N'Nước mắm', N'Gia vị', N'ml'),
(N'Nước tương', N'Gia vị', N'ml'),
(N'Dầu ăn', N'Gia vị', N'ml'),
(N'Muối', N'Gia vị', N'g'),
(N'Đường', N'Gia vị', N'g'),
(N'Tiêu', N'Gia vị', N'g'),
(N'Hạt nêm', N'Gia vị', N'g'),
(N'Nước', N'Chất lỏng', N'ml'),
(N'Nước dừa', N'Chất lỏng', N'ml'),
(N'Giấm gạo', N'Gia vị', N'ml'),
(N'Bột năng', N'Gạo và tinh bột', N'g'),
(N'Nước màu', N'Gia vị', N'ml');

DECLARE @Recipes TABLE (
    RecipeName NVARCHAR(200) COLLATE Vietnamese_100_CI_AS NOT NULL PRIMARY KEY,
    CategoryName NVARCHAR(150) COLLATE Vietnamese_100_CI_AS NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    PrepTime INT NOT NULL,
    CookTime INT NOT NULL,
    Servings INT NOT NULL,
    Difficulty NVARCHAR(30) NOT NULL
);
INSERT INTO @Recipes (RecipeName, CategoryName, Description, PrepTime, CookTime, Servings, Difficulty) VALUES
(N'Trứng chiên', N'Món chiên', N'Trứng chiên hành lá mềm thơm cho bữa cơm nhanh.', 5, 7, 2, N'Dễ'),
(N'Trứng xào cà chua', N'Món xào', N'Trứng mềm quyện cà chua mọng, dùng nóng với cơm.', 7, 8, 2, N'Dễ'),
(N'Thịt kho trứng', N'Món kho', N'Thịt ba chỉ và trứng kho nước dừa, vị mặn ngọt hài hòa.', 20, 60, 4, N'Trung bình'),
(N'Thịt kho tiêu', N'Món kho', N'Thịt ba chỉ kho sánh cùng tiêu và hành tím.', 15, 35, 3, N'Dễ'),
(N'Canh chua cá', N'Món canh', N'Canh cá lóc nấu me, thơm và rau, có vị chua thanh.', 20, 20, 4, N'Trung bình'),
(N'Canh bí đỏ', N'Món canh', N'Bí đỏ mềm ngọt nấu cùng thịt heo xay.', 10, 20, 3, N'Dễ'),
(N'Rau muống xào tỏi', N'Món xào', N'Rau muống xào nhanh với tỏi, giữ màu và độ giòn.', 10, 6, 3, N'Dễ'),
(N'Cơm chiên trứng', N'Cơm và cháo', N'Cơm nguội chiên với trứng và cà rốt cho bữa ăn gọn nhẹ.', 10, 12, 2, N'Dễ'),
(N'Gà kho gừng', N'Món kho', N'Gà kho thấm nước mắm, thơm gừng và hành tím.', 15, 30, 4, N'Dễ'),
(N'Cá chiên nước mắm', N'Món chiên', N'Phi lê cá rô phi chiên vàng áo nước mắm tỏi.', 15, 18, 3, N'Trung bình'),
(N'Thịt bò xào hành tây', N'Món xào', N'Thịt bò thái mỏng xào nhanh với hành tây.', 15, 7, 3, N'Dễ'),
(N'Su su xào cà rốt', N'Món xào', N'Su su và cà rốt thái sợi xào tỏi, hợp bữa cơm gia đình.', 12, 8, 3, N'Dễ'),
(N'Cá kho tộ', N'Món kho', N'Cá basa kho lửa nhỏ với nước màu và tiêu.', 20, 35, 4, N'Trung bình'),
(N'Canh rau ngót thịt băm', N'Món canh', N'Canh rau ngót xanh, ngọt tự nhiên từ thịt heo xay.', 10, 15, 3, N'Dễ'),
(N'Cháo gà', N'Cơm và cháo', N'Cháo gạo tẻ nấu với gà, gừng và hành lá.', 15, 55, 4, N'Trung bình'),
(N'Đậu hũ sốt cà chua', N'Món sốt', N'Đậu hũ chiên sơ rồi rim trong sốt cà chua.', 10, 18, 3, N'Dễ'),
(N'Đậu hũ chiên sả', N'Món chiên', N'Đậu hũ chiên vàng phủ sả tỏi thơm giòn.', 10, 15, 3, N'Dễ'),
(N'Bắp cải luộc', N'Món luộc', N'Bắp cải luộc vừa chín, dùng cùng nước mắm.', 5, 12, 3, N'Dễ'),
(N'Trứng luộc', N'Món luộc', N'Trứng gà luộc chín hoàn toàn, dùng cùng muối tiêu.', 3, 18, 2, N'Dễ'),
(N'Cá hấp gừng', N'Món hấp', N'Phi lê cá rô phi hấp với gừng, hành lá và nước tương.', 15, 25, 3, N'Trung bình');

/* Quantity la dinh luong cho toan bo Servings, khong phai moi nguoi.
   1 = thanh phan chinh / can thiet cho phuong phap nau.
   0 = gia vi hoac rau trang tri co the bo qua; khong tu dong coi la da co.
   Nuoc cung duoc luu ro de co the quy doi dinh luong; thuat toan sau nay
   phai quy dinh cach xu ly nguyen lieu co ban, khong suy luan tu ten mon. */
DECLARE @RecipeIngredients TABLE (
    RecipeName NVARCHAR(200) COLLATE Vietnamese_100_CI_AS NOT NULL,
    IngredientName NVARCHAR(150) COLLATE Vietnamese_100_CI_AS NOT NULL,
    Quantity DECIMAL(12,2) NOT NULL,
    Unit NVARCHAR(30) NOT NULL,
    IsRequired BIT NOT NULL,
    Notes NVARCHAR(255) NULL,
    PRIMARY KEY (RecipeName, IngredientName)
);
INSERT INTO @RecipeIngredients (RecipeName, IngredientName, Quantity, Unit, IsRequired, Notes) VALUES
(N'Trứng chiên', N'Trứng gà', 3, N'quả', 1, NULL),
(N'Trứng chiên', N'Dầu ăn', 15, N'ml', 1, N'Dùng chảo chống dính đường kính khoảng 20 cm.'),
(N'Trứng chiên', N'Hành lá', 10, N'g', 0, N'Thái nhỏ.'),
(N'Trứng chiên', N'Nước mắm', 5, N'ml', 0, NULL),
(N'Trứng chiên', N'Tiêu', 0.5, N'g', 0, NULL),
(N'Trứng xào cà chua', N'Trứng gà', 3, N'quả', 1, NULL),
(N'Trứng xào cà chua', N'Cà chua', 250, N'g', 1, N'Cắt múi cau.'),
(N'Trứng xào cà chua', N'Dầu ăn', 15, N'ml', 1, N'Chia hai lần xào.'),
(N'Trứng xào cà chua', N'Hành lá', 10, N'g', 0, NULL),
(N'Trứng xào cà chua', N'Hành tím', 10, N'g', 0, NULL),
(N'Trứng xào cà chua', N'Nước mắm', 7, N'ml', 0, NULL),
(N'Trứng xào cà chua', N'Đường', 2, N'g', 0, N'Có thể bỏ nếu cà chua ngọt.'),
(N'Thịt kho trứng', N'Thịt ba chỉ', 600, N'g', 1, N'Cắt miếng khoảng 4 cm.'),
(N'Thịt kho trứng', N'Trứng gà', 4, N'quả', 1, NULL),
(N'Thịt kho trứng', N'Nước dừa', 500, N'ml', 1, N'Nước dừa tươi không thêm đường.'),
(N'Thịt kho trứng', N'Nước', 700, N'ml', 1, N'500 ml luộc trứng, 200 ml kho thịt; điều chỉnh vừa ngập thịt.'),
(N'Thịt kho trứng', N'Nước mắm', 35, N'ml', 1, NULL),
(N'Thịt kho trứng', N'Đường', 15, N'g', 0, N'Điều chỉnh theo độ ngọt nước dừa.'),
(N'Thịt kho trứng', N'Hành tím', 20, N'g', 0, NULL),
(N'Thịt kho trứng', N'Tỏi', 10, N'g', 0, NULL),
(N'Thịt kho trứng', N'Tiêu', 1, N'g', 0, NULL),
(N'Thịt kho tiêu', N'Thịt ba chỉ', 500, N'g', 1, N'Thái miếng dày khoảng 1 cm.'),
(N'Thịt kho tiêu', N'Tiêu', 3, N'g', 1, N'Tiêu giã dập tạo vị đặc trưng.'),
(N'Thịt kho tiêu', N'Nước mắm', 25, N'ml', 1, NULL),
(N'Thịt kho tiêu', N'Nước', 250, N'ml', 1, NULL),
(N'Thịt kho tiêu', N'Nước màu', 10, N'ml', 0, NULL),
(N'Thịt kho tiêu', N'Đường', 10, N'g', 0, NULL),
(N'Thịt kho tiêu', N'Hành tím', 20, N'g', 0, NULL),
(N'Thịt kho tiêu', N'Tỏi', 10, N'g', 0, NULL),
(N'Thịt kho tiêu', N'Hành lá', 10, N'g', 0, NULL),
(N'Canh chua cá', N'Cá lóc', 600, N'g', 1, N'Cá đã làm sạch, cắt khúc.'),
(N'Canh chua cá', N'Me', 30, N'g', 1, N'Me vắt, lọc bỏ hạt.'),
(N'Canh chua cá', N'Cà chua', 200, N'g', 1, NULL),
(N'Canh chua cá', N'Thơm', 150, N'g', 1, NULL),
(N'Canh chua cá', N'Đậu bắp', 150, N'g', 1, NULL),
(N'Canh chua cá', N'Bạc hà', 150, N'g', 1, N'Tước vỏ, thái xéo.'),
(N'Canh chua cá', N'Giá đỗ', 100, N'g', 0, NULL),
(N'Canh chua cá', N'Nước', 1400, N'ml', 1, N'Trích 100 ml nước nóng để dầm me.'),
(N'Canh chua cá', N'Nước mắm', 25, N'ml', 1, NULL),
(N'Canh chua cá', N'Đường', 15, N'g', 0, NULL),
(N'Canh chua cá', N'Ngò om', 10, N'g', 0, NULL),
(N'Canh chua cá', N'Ngò gai', 10, N'g', 0, NULL),
(N'Canh chua cá', N'Ớt', 5, N'g', 0, NULL),
(N'Canh bí đỏ', N'Bí đỏ', 450, N'g', 1, N'Khối lượng sau khi gọt vỏ và bỏ hạt.'),
(N'Canh bí đỏ', N'Thịt heo xay', 150, N'g', 1, NULL),
(N'Canh bí đỏ', N'Nước', 1000, N'ml', 1, NULL),
(N'Canh bí đỏ', N'Nước mắm', 15, N'ml', 0, NULL),
(N'Canh bí đỏ', N'Hành tím', 10, N'g', 0, NULL),
(N'Canh bí đỏ', N'Hành lá', 10, N'g', 0, NULL),
(N'Canh bí đỏ', N'Muối', 2, N'g', 0, NULL),
(N'Rau muống xào tỏi', N'Rau muống', 500, N'g', 1, N'Khối lượng sau nhặt bỏ phần già.'),
(N'Rau muống xào tỏi', N'Tỏi', 25, N'g', 1, N'Đập dập và băm một phần.'),
(N'Rau muống xào tỏi', N'Dầu ăn', 25, N'ml', 1, NULL),
(N'Rau muống xào tỏi', N'Nước', 40, N'ml', 0, N'Thêm khi chảo khô để rau chín đều.'),
(N'Rau muống xào tỏi', N'Nước mắm', 10, N'ml', 0, NULL),
(N'Rau muống xào tỏi', N'Hạt nêm', 3, N'g', 0, NULL),
(N'Cơm chiên trứng', N'Cơm nguội', 400, N'g', 1, N'Cơm đã bảo quản lạnh đúng cách, lấy ra ngay trước khi chiên.'),
(N'Cơm chiên trứng', N'Trứng gà', 2, N'quả', 1, NULL),
(N'Cơm chiên trứng', N'Cà rốt', 80, N'g', 0, N'Cắt hạt lựu nhỏ.'),
(N'Cơm chiên trứng', N'Dầu ăn', 20, N'ml', 1, NULL),
(N'Cơm chiên trứng', N'Hành lá', 10, N'g', 0, NULL),
(N'Cơm chiên trứng', N'Tỏi', 5, N'g', 0, NULL),
(N'Cơm chiên trứng', N'Nước tương', 10, N'ml', 0, NULL),
(N'Cơm chiên trứng', N'Tiêu', 0.5, N'g', 0, NULL),
(N'Gà kho gừng', N'Thịt gà', 700, N'g', 1, N'Gà có xương chặt miếng vừa ăn.'),
(N'Gà kho gừng', N'Gừng', 40, N'g', 1, N'Thái sợi.'),
(N'Gà kho gừng', N'Nước mắm', 30, N'ml', 1, NULL),
(N'Gà kho gừng', N'Nước', 250, N'ml', 1, NULL),
(N'Gà kho gừng', N'Dầu ăn', 15, N'ml', 1, NULL),
(N'Gà kho gừng', N'Hành tím', 20, N'g', 0, NULL),
(N'Gà kho gừng', N'Đường', 12, N'g', 0, NULL),
(N'Gà kho gừng', N'Tiêu', 1, N'g', 0, NULL),
(N'Cá chiên nước mắm', N'Cá rô phi', 600, N'g', 1, N'Phi lê có da, dày khoảng 2 cm, đã loại xương.'),
(N'Cá chiên nước mắm', N'Dầu ăn', 60, N'ml', 1, N'Lượng dùng chiên áp chảo; không phải lượng hấp thụ.'),
(N'Cá chiên nước mắm', N'Nước mắm', 25, N'ml', 1, NULL),
(N'Cá chiên nước mắm', N'Nước', 40, N'ml', 1, NULL),
(N'Cá chiên nước mắm', N'Đường', 15, N'g', 1, N'Tạo sốt mặn ngọt.'),
(N'Cá chiên nước mắm', N'Tỏi', 15, N'g', 0, NULL),
(N'Cá chiên nước mắm', N'Ớt', 5, N'g', 0, NULL),
(N'Thịt bò xào hành tây', N'Thịt bò', 350, N'g', 1, N'Thái mỏng ngang thớ.'),
(N'Thịt bò xào hành tây', N'Hành tây', 250, N'g', 1, N'Cắt múi cau mỏng.'),
(N'Thịt bò xào hành tây', N'Dầu ăn', 20, N'ml', 1, NULL),
(N'Thịt bò xào hành tây', N'Tỏi', 15, N'g', 0, NULL),
(N'Thịt bò xào hành tây', N'Nước tương', 15, N'ml', 0, NULL),
(N'Thịt bò xào hành tây', N'Tiêu', 1, N'g', 0, NULL),
(N'Thịt bò xào hành tây', N'Hành lá', 10, N'g', 0, NULL),
(N'Su su xào cà rốt', N'Su su', 350, N'g', 1, N'Gọt vỏ, bỏ hạt, thái sợi.'),
(N'Su su xào cà rốt', N'Cà rốt', 150, N'g', 1, N'Gọt vỏ, thái sợi.'),
(N'Su su xào cà rốt', N'Dầu ăn', 20, N'ml', 1, NULL),
(N'Su su xào cà rốt', N'Tỏi', 10, N'g', 0, NULL),
(N'Su su xào cà rốt', N'Nước', 40, N'ml', 0, NULL),
(N'Su su xào cà rốt', N'Hạt nêm', 4, N'g', 0, NULL),
(N'Su su xào cà rốt', N'Hành lá', 10, N'g', 0, NULL),
(N'Cá kho tộ', N'Cá basa', 700, N'g', 1, N'Cắt khúc dày khoảng 3 cm.'),
(N'Cá kho tộ', N'Nước mắm', 30, N'ml', 1, NULL),
(N'Cá kho tộ', N'Nước', 300, N'ml', 1, NULL),
(N'Cá kho tộ', N'Nước màu', 15, N'ml', 1, NULL),
(N'Cá kho tộ', N'Đường', 15, N'g', 0, NULL),
(N'Cá kho tộ', N'Tiêu', 2, N'g', 0, NULL),
(N'Cá kho tộ', N'Hành tím', 20, N'g', 0, NULL),
(N'Cá kho tộ', N'Hành lá', 10, N'g', 0, NULL),
(N'Cá kho tộ', N'Ớt', 5, N'g', 0, NULL),
(N'Canh rau ngót thịt băm', N'Rau ngót', 300, N'g', 1, N'Chỉ lấy lá và ngọn non.'),
(N'Canh rau ngót thịt băm', N'Thịt heo xay', 150, N'g', 1, NULL),
(N'Canh rau ngót thịt băm', N'Nước', 1000, N'ml', 1, NULL),
(N'Canh rau ngót thịt băm', N'Nước mắm', 15, N'ml', 0, NULL),
(N'Canh rau ngót thịt băm', N'Hành tím', 10, N'g', 0, NULL),
(N'Canh rau ngót thịt băm', N'Muối', 2, N'g', 0, NULL),
(N'Cháo gà', N'Thịt gà', 700, N'g', 1, N'Đùi hoặc ức gà có xương.'),
(N'Cháo gà', N'Gạo tẻ', 200, N'g', 1, NULL),
(N'Cháo gà', N'Nước', 2200, N'ml', 1, N'Có thể thêm nước nóng nếu muốn cháo loãng hơn.'),
(N'Cháo gà', N'Gừng', 20, N'g', 1, NULL),
(N'Cháo gà', N'Hành tím', 20, N'g', 0, NULL),
(N'Cháo gà', N'Hành lá', 20, N'g', 0, NULL),
(N'Cháo gà', N'Rau mùi', 10, N'g', 0, NULL),
(N'Cháo gà', N'Nước mắm', 20, N'ml', 0, NULL),
(N'Cháo gà', N'Muối', 3, N'g', 0, NULL),
(N'Cháo gà', N'Tiêu', 1, N'g', 0, NULL),
(N'Đậu hũ sốt cà chua', N'Đậu hũ', 400, N'g', 1, N'Đậu trắng chắc, thấm khô rồi cắt miếng.'),
(N'Đậu hũ sốt cà chua', N'Cà chua', 300, N'g', 1, NULL),
(N'Đậu hũ sốt cà chua', N'Dầu ăn', 40, N'ml', 1, NULL),
(N'Đậu hũ sốt cà chua', N'Nước', 100, N'ml', 1, NULL),
(N'Đậu hũ sốt cà chua', N'Nước tương', 15, N'ml', 0, NULL),
(N'Đậu hũ sốt cà chua', N'Hành lá', 10, N'g', 0, NULL),
(N'Đậu hũ sốt cà chua', N'Hành tím', 10, N'g', 0, NULL),
(N'Đậu hũ sốt cà chua', N'Đường', 5, N'g', 0, NULL),
(N'Đậu hũ chiên sả', N'Đậu hũ', 400, N'g', 1, N'Đậu trắng chắc, thấm khô, cắt miếng dày 1,5 cm.'),
(N'Đậu hũ chiên sả', N'Sả', 40, N'g', 1, N'Lấy phần non, băm nhỏ.'),
(N'Đậu hũ chiên sả', N'Dầu ăn', 50, N'ml', 1, N'Dùng chiên áp chảo.'),
(N'Đậu hũ chiên sả', N'Tỏi', 10, N'g', 0, NULL),
(N'Đậu hũ chiên sả', N'Muối', 3, N'g', 0, NULL),
(N'Đậu hũ chiên sả', N'Ớt', 5, N'g', 0, NULL),
(N'Bắp cải luộc', N'Bắp cải', 600, N'g', 1, N'Bỏ lá già và lõi cứng.'),
(N'Bắp cải luộc', N'Nước', 1500, N'ml', 1, N'Nước luộc, không tính là phần nước ăn kèm.'),
(N'Bắp cải luộc', N'Muối', 3, N'g', 0, NULL),
(N'Bắp cải luộc', N'Nước mắm', 20, N'ml', 0, N'Dùng làm nước chấm.'),
(N'Trứng luộc', N'Trứng gà', 4, N'quả', 1, N'Trứng cỡ vừa, đã bảo quản đúng cách.'),
(N'Trứng luộc', N'Nước', 1000, N'ml', 1, N'Nước ngập trứng khoảng 2 cm, tùy kích thước nồi.'),
(N'Trứng luộc', N'Muối', 2, N'g', 0, N'Làm muối tiêu chấm.'),
(N'Trứng luộc', N'Tiêu', 0.5, N'g', 0, NULL),
(N'Cá hấp gừng', N'Cá rô phi', 600, N'g', 1, N'Phi lê có da, dày khoảng 2 cm, đã loại xương.'),
(N'Cá hấp gừng', N'Gừng', 35, N'g', 1, N'Thái sợi.'),
(N'Cá hấp gừng', N'Nước', 1200, N'ml', 1, N'Nước dưới xửng hấp, không cho trực tiếp vào cá.'),
(N'Cá hấp gừng', N'Nước tương', 25, N'ml', 1, NULL),
(N'Cá hấp gừng', N'Hành lá', 25, N'g', 0, NULL),
(N'Cá hấp gừng', N'Hành tím', 15, N'g', 0, NULL),
(N'Cá hấp gừng', N'Ớt', 5, N'g', 0, NULL),
(N'Cá hấp gừng', N'Tiêu', 1, N'g', 0, NULL);

DECLARE @CookingSteps TABLE (
    RecipeName NVARCHAR(200) COLLATE Vietnamese_100_CI_AS NOT NULL,
    StepNumber INT NOT NULL,
    Instruction NVARCHAR(MAX) NOT NULL,
    PRIMARY KEY (RecipeName, StepNumber)
);
INSERT INTO @CookingSteps (RecipeName, StepNumber, Instruction) VALUES
(N'Trứng chiên', 1, N'Rửa sạch hành lá, thái nhỏ. Đập 3 quả trứng vào bát sạch, đánh đều với nước mắm, tiêu và hành lá nếu dùng.'),
(N'Trứng chiên', 2, N'Làm nóng chảo ở lửa vừa, cho 15 ml dầu ăn và láng đều mặt chảo.'),
(N'Trứng chiên', 3, N'Đổ trứng vào, dàn đều và chiên khoảng 3–4 phút đến khi mặt dưới vàng, mặt trên se lại.'),
(N'Trứng chiên', 4, N'Lật hoặc gấp trứng, nấu thêm 2–3 phút cho phần giữa chín hoàn toàn, không còn trứng lỏng. Cắt miếng và dùng nóng.'),
(N'Trứng xào cà chua', 1, N'Cà chua rửa sạch, cắt múi cau; hành tím băm, hành lá thái nhỏ. Đánh đều 3 quả trứng với một nửa nước mắm nếu dùng.'),
(N'Trứng xào cà chua', 2, N'Làm nóng một nửa dầu ăn, cho trứng vào đảo nhẹ đến khi vừa đông, trút ra bát sạch.'),
(N'Trứng xào cà chua', 3, N'Cho phần dầu còn lại vào chảo, phi hành tím nếu dùng. Xào cà chua 3–4 phút đến khi mềm, thêm đường và phần nước mắm còn lại nếu dùng.'),
(N'Trứng xào cà chua', 4, N'Cho trứng trở lại chảo, đảo nhẹ thêm 2 phút để trứng chín hoàn toàn và thấm sốt. Thêm hành lá nếu dùng rồi tắt bếp.'),
(N'Thịt kho trứng', 1, N'Thịt ba chỉ rửa sạch, thấm khô và cắt miếng. Ướp thịt với nước mắm, đường, hành tím, tỏi băm và tiêu nếu dùng trong 15 phút.'),
(N'Thịt kho trứng', 2, N'Cho trứng vào nồi với khoảng 500 ml nước, luộc sôi nhẹ 10 phút cho chín hoàn toàn; để nguội bớt và bóc vỏ. Trong lúc đó đảo thịt trong nồi riêng 5 phút cho săn.'),
(N'Thịt kho trứng', 3, N'Cho nước dừa và 200 ml nước còn lại vào nồi thịt, đun sôi, hớt bọt rồi hạ lửa. Kho liu riu khoảng 35 phút đến khi thịt mềm.'),
(N'Thịt kho trứng', 4, N'Thêm trứng đã bóc vỏ, trở nhẹ và kho tiếp 15–20 phút. Thịt phải chín mềm hoàn toàn, nước kho còn xâm xấp; tắt bếp và dùng nóng.'),
(N'Thịt kho tiêu', 1, N'Thịt rửa sạch, thấm khô, cắt miếng. Băm hành tím và tỏi nếu dùng. Ướp thịt với nước mắm, tiêu, đường và nước màu nếu dùng trong 10 phút.'),
(N'Thịt kho tiêu', 2, N'Cho thịt vào nồi, đảo ở lửa vừa 5 phút để thịt săn và tự tiết mỡ; thêm hành tím, tỏi nếu dùng, đảo thơm.'),
(N'Thịt kho tiêu', 3, N'Thêm 250 ml nước, đun sôi rồi hạ lửa nhỏ, đậy hé nắp và kho khoảng 25 phút; đảo nhẹ vài lần để thịt thấm đều.'),
(N'Thịt kho tiêu', 4, N'Mở nắp, kho thêm 5 phút cho nước sánh, thịt chín mềm hoàn toàn. Rắc hành lá nếu dùng và tắt bếp.'),
(N'Canh chua cá', 1, N'Cá làm sạch, cắt khúc. Rửa rau; cà chua và thơm cắt miếng, đậu bắp thái xéo, bạc hà tước vỏ cắt lát. Dầm me với 100 ml nước nóng lấy từ phần nước đã định lượng, lọc bỏ hạt.'),
(N'Canh chua cá', 2, N'Đun sôi 1.300 ml nước còn lại cùng thơm và nước me. Cho cá vào, hạ lửa vừa và nấu 10–12 phút, hớt bọt, hạn chế đảo để cá không nát.'),
(N'Canh chua cá', 3, N'Khi cá gần chín, thêm cà chua, đậu bắp và bạc hà; nấu thêm 4–5 phút. Cho nước mắm và đường nếu dùng, đảo nhẹ phần nước canh.'),
(N'Canh chua cá', 4, N'Thêm giá đỗ nếu dùng, đun sôi thêm 1–2 phút. Kiểm tra cá chín đục, dễ tách thớ; tắt bếp rồi thêm ngò om, ngò gai và ớt nếu dùng.'),
(N'Canh bí đỏ', 1, N'Bí đỏ gọt vỏ, bỏ hạt, rửa sạch và cắt miếng 2–3 cm. Hành tím băm, hành lá thái nhỏ nếu dùng.'),
(N'Canh bí đỏ', 2, N'Đun sôi 1.000 ml nước với hành tím nếu dùng, cho thịt heo xay vào từng ít một, khuấy tơi và hớt bọt.'),
(N'Canh bí đỏ', 3, N'Thêm bí đỏ, nấu lửa vừa 12–15 phút đến khi bí mềm và thịt chín hoàn toàn. Cho nước mắm và muối nếu dùng.'),
(N'Canh bí đỏ', 4, N'Kiểm tra bí xuyên đũa dễ dàng, thêm hành lá nếu dùng, đun lại nhẹ rồi tắt bếp. Múc ra bát và dùng nóng.'),
(N'Rau muống xào tỏi', 1, N'Nhặt rau muống, bỏ cọng già, cắt khúc và rửa kỹ nhiều lần, để ráo. Tỏi bóc vỏ, đập dập và băm một phần.'),
(N'Rau muống xào tỏi', 2, N'Làm nóng chảo rộng với 25 ml dầu ăn, cho tỏi vào phi khoảng 20–30 giây đến khi thơm, chưa chuyển nâu.'),
(N'Rau muống xào tỏi', 3, N'Cho rau muống vào, tăng lửa và đảo liên tục. Thêm tối đa 40 ml nước nếu chảo khô, giúp cọng rau chín đều.'),
(N'Rau muống xào tỏi', 4, N'Xào tổng cộng khoảng 4–5 phút, thêm nước mắm và hạt nêm nếu dùng. Khi rau chín còn giòn, tắt bếp và dọn ngay.'),
(N'Cơm chiên trứng', 1, N'Lấy cơm đã bảo quản lạnh ra, xới tơi. Cà rốt cắt hạt lựu nhỏ, tỏi băm và hành lá thái nhỏ nếu dùng; đập trứng, đánh đều.'),
(N'Cơm chiên trứng', 2, N'Làm nóng nửa lượng dầu, cho trứng vào đảo đến khi đông thành miếng nhỏ rồi trút ra bát sạch.'),
(N'Cơm chiên trứng', 3, N'Cho phần dầu còn lại vào chảo, phi tỏi nếu dùng. Thêm cà rốt nếu dùng, xào 2–3 phút rồi cho cơm vào đảo 4–5 phút đến khi cơm nóng đều.'),
(N'Cơm chiên trứng', 4, N'Thêm trứng và nước tương nếu dùng, đảo thêm 2–3 phút cho cơm nóng bốc hơi toàn bộ và trứng chín hoàn toàn. Thêm hành lá, tiêu nếu dùng và ăn ngay.'),
(N'Gà kho gừng', 1, N'Gà làm sạch, thấm khô, chặt miếng vừa ăn. Gừng cạo vỏ, thái sợi; hành tím băm nếu dùng. Ướp gà với nước mắm, đường và tiêu nếu dùng trong 10 phút.'),
(N'Gà kho gừng', 2, N'Làm nóng dầu trong nồi, cho gừng và hành tím nếu dùng vào đảo thơm. Thêm gà và đảo 5 phút cho săn.'),
(N'Gà kho gừng', 3, N'Thêm 250 ml nước, đun sôi, hạ lửa vừa và kho có nắp khoảng 20 phút, trở gà một lần để thấm vị.'),
(N'Gà kho gừng', 4, N'Mở nắp, kho thêm 5 phút cho sốt sánh. Kiểm tra phần thịt dày nhất chín hoàn toàn, nhiệt độ tâm đạt 74°C nếu có nhiệt kế; tắt bếp và dùng nóng.'),
(N'Cá chiên nước mắm', 1, N'Phi lê cá kiểm tra bỏ xương, thấm thật khô và cắt miếng vừa ăn. Băm tỏi, ớt nếu dùng; hòa nước mắm với 40 ml nước và 15 g đường.'),
(N'Cá chiên nước mắm', 2, N'Làm nóng 60 ml dầu trong chảo, cho cá vào chiên lửa vừa 5–6 phút mỗi mặt, tùy độ dày, đến khi vàng và thịt chín đục, dễ tách thớ. Gắp ra đĩa.'),
(N'Cá chiên nước mắm', 3, N'Chắt bớt dầu, giữ khoảng 5 ml trong chảo. Phi tỏi và ớt nếu dùng rồi đổ hỗn hợp nước mắm vào, đun 1–2 phút cho hơi sánh.'),
(N'Cá chiên nước mắm', 4, N'Cho cá vào sốt, trở nhẹ hai mặt trong 1–2 phút cho bám đều. Tắt bếp, dùng nóng với cơm.'),
(N'Thịt bò xào hành tây', 1, N'Thịt bò thấm khô, thái mỏng ngang thớ. Hành tây cắt múi mỏng; tỏi băm, hành lá cắt khúc nếu dùng. Ướp bò với nước tương và tiêu nếu dùng trong 10 phút.'),
(N'Thịt bò xào hành tây', 2, N'Làm nóng nửa lượng dầu, phi nửa lượng tỏi nếu dùng. Xào thịt bò ở lửa lớn 2–3 phút đến khi thịt chín đều rồi trút ra đĩa sạch.'),
(N'Thịt bò xào hành tây', 3, N'Thêm phần dầu và tỏi còn lại nếu dùng vào chảo. Cho hành tây vào xào 2 phút để vừa trong và vẫn giòn.'),
(N'Thịt bò xào hành tây', 4, N'Cho thịt bò và nước thịt trở lại chảo, đảo thêm 1 phút cho nóng đều. Thêm hành lá nếu dùng, tắt bếp và dùng ngay.'),
(N'Su su xào cà rốt', 1, N'Su su gọt vỏ, bỏ hạt; cà rốt gọt vỏ. Rửa sạch, thái sợi đều nhau; tỏi băm, hành lá thái nhỏ nếu dùng.'),
(N'Su su xào cà rốt', 2, N'Làm nóng dầu, phi tỏi nếu dùng khoảng 20 giây. Cho cà rốt vào đảo 2 phút.'),
(N'Su su xào cà rốt', 3, N'Thêm su su, xào lửa vừa lớn 4–5 phút. Cho tối đa 40 ml nước nếu chảo khô, đảo để rau chín đều.'),
(N'Su su xào cà rốt', 4, N'Thêm hạt nêm và hành lá nếu dùng, đảo 1 phút. Khi rau chín còn giòn, tắt bếp và dọn ra đĩa.'),
(N'Cá kho tộ', 1, N'Cá basa làm sạch, cắt khúc và thấm khô. Hành tím băm nếu dùng. Ướp cá với nước mắm, nước màu, đường, tiêu và hành tím nếu dùng trong 15 phút.'),
(N'Cá kho tộ', 2, N'Xếp cá vào nồi đất phù hợp bếp hoặc nồi đáy dày, cho nước ướp vào. Đun lửa vừa 3 phút rồi thêm 300 ml nước nóng.'),
(N'Cá kho tộ', 3, N'Đun sôi rồi hạ lửa nhỏ, kho khoảng 25 phút; thỉnh thoảng nghiêng nồi rưới nước kho lên cá, tránh đảo mạnh.'),
(N'Cá kho tộ', 4, N'Kho mở nắp thêm 5–7 phút đến khi sốt sánh và cá chín đục, dễ tách thớ. Thêm hành lá và ớt nếu dùng rồi tắt bếp.'),
(N'Canh rau ngót thịt băm', 1, N'Nhặt lá rau ngót, rửa kỹ, vò nhẹ và để ráo. Hành tím băm nếu dùng.'),
(N'Canh rau ngót thịt băm', 2, N'Đun sôi 1.000 ml nước với hành tím nếu dùng. Cho thịt heo xay vào, khuấy tơi và nấu khoảng 5 phút, hớt bọt.'),
(N'Canh rau ngót thịt băm', 3, N'Thêm rau ngót, nấu sôi nhẹ 5–7 phút đến khi rau mềm và thịt chín hoàn toàn. Cho nước mắm, muối nếu dùng.'),
(N'Canh rau ngót thịt băm', 4, N'Đun thêm 1 phút, kiểm tra rau mềm vừa ăn rồi tắt bếp. Múc ra bát, dùng nóng cùng cơm.'),
(N'Cháo gà', 1, N'Vo gạo, để ráo. Gà làm sạch, thấm khô; gừng thái lát. Hành tím đập dập, hành lá và rau mùi thái nhỏ nếu dùng.'),
(N'Cháo gà', 2, N'Cho gà, gừng, hành tím nếu dùng và 2.200 ml nước vào nồi, đun sôi, hớt bọt rồi nấu nhỏ lửa 25–30 phút. Kiểm tra thịt gà chín hoàn toàn, tâm đạt 74°C nếu có nhiệt kế, gắp ra để nguội bớt rồi xé thịt, bỏ xương.'),
(N'Cháo gà', 3, N'Trong lúc xé gà, cho gạo vào nước luộc và nấu nhỏ lửa 20–25 phút, khuấy sát đáy để tránh khê. Thêm chút nước nóng nếu cháo quá đặc.'),
(N'Cháo gà', 4, N'Cho gà xé trở lại nồi, thêm nước mắm và muối nếu dùng, đun sôi nhẹ 3 phút. Múc cháo, thêm hành lá, rau mùi và tiêu nếu dùng, ăn nóng.'),
(N'Đậu hũ sốt cà chua', 1, N'Đậu hũ thấm khô, cắt miếng. Cà chua rửa sạch, thái nhỏ; hành tím băm, hành lá thái nhỏ nếu dùng.'),
(N'Đậu hũ sốt cà chua', 2, N'Làm nóng 40 ml dầu, chiên đậu hũ ở lửa vừa khoảng 7–8 phút, trở mặt cho vàng đều rồi gắp ra.'),
(N'Đậu hũ sốt cà chua', 3, N'Giữ khoảng 10 ml dầu trong chảo, phi hành tím nếu dùng. Thêm cà chua, xào 4 phút cho mềm; thêm 100 ml nước, nước tương và đường nếu dùng.'),
(N'Đậu hũ sốt cà chua', 4, N'Cho đậu hũ vào sốt, rim lửa nhỏ 5–6 phút, trở nhẹ để thấm đều. Thêm hành lá nếu dùng rồi tắt bếp.'),
(N'Đậu hũ chiên sả', 1, N'Đậu hũ thấm thật khô, cắt miếng dày 1,5 cm. Sả lấy phần non băm nhỏ; tỏi và ớt băm nếu dùng.'),
(N'Đậu hũ chiên sả', 2, N'Làm nóng dầu ở lửa vừa, chiên đậu hũ 8–10 phút, trở mặt cho vàng đều rồi gắp ra để ráo.'),
(N'Đậu hũ chiên sả', 3, N'Giữ khoảng 10 ml dầu trong chảo, cho sả và tỏi nếu dùng vào đảo lửa nhỏ 2–3 phút đến khi thơm, không để cháy.'),
(N'Đậu hũ chiên sả', 4, N'Cho đậu hũ trở lại, thêm muối và ớt nếu dùng, đảo nhẹ 1–2 phút cho sả bám đều. Tắt bếp và dùng nóng.'),
(N'Bắp cải luộc', 1, N'Bắp cải bỏ lá già và lõi cứng, rửa sạch, cắt miếng vừa ăn rồi để ráo.'),
(N'Bắp cải luộc', 2, N'Đun sôi 1.500 ml nước trong nồi rộng, thêm muối nếu dùng.'),
(N'Bắp cải luộc', 3, N'Cho bắp cải vào, nhấn ngập nước, luộc lửa vừa 4–6 phút đến khi lá mềm và phần cuống vừa chín.'),
(N'Bắp cải luộc', 4, N'Vớt rau ngay ra rổ sạch cho ráo rồi xếp đĩa. Dùng nước mắm làm nước chấm nếu muốn.'),
(N'Trứng luộc', 1, N'Kiểm tra vỏ trứng nguyên vẹn, nhẹ tay đặt trứng vào nồi sạch một lớp.'),
(N'Trứng luộc', 2, N'Thêm khoảng 1.000 ml nước cho ngập trứng 2 cm; đun đến sôi nhẹ, tránh sôi mạnh làm nứt vỏ.'),
(N'Trứng luộc', 3, N'Khi nước sôi, hạ lửa và luộc thêm 10–12 phút để lòng trắng và lòng đỏ chín hoàn toàn.'),
(N'Trứng luộc', 4, N'Vớt trứng, để nguội bớt rồi bóc vỏ, cắt đôi. Trộn muối và tiêu để chấm nếu dùng.'),
(N'Cá hấp gừng', 1, N'Cá kiểm tra bỏ xương, thấm khô. Gừng thái sợi; hành lá cắt khúc, hành tím thái lát, ớt thái nhỏ nếu dùng.'),
(N'Cá hấp gừng', 2, N'Xếp một nửa gừng và hành vào đĩa chịu nhiệt; đặt cá lên, rưới nước tương, thêm gừng còn lại, tiêu và ớt nếu dùng. Ướp 10 phút.'),
(N'Cá hấp gừng', 3, N'Đun sôi 1.200 ml nước dưới xửng, đặt đĩa cá lên trên, đậy nắp và hấp 15–20 phút tùy độ dày cá; giữ nước dưới xửng không cạn.'),
(N'Cá hấp gừng', 4, N'Kiểm tra phần cá dày nhất chín đục, dễ tách thớ, không còn trong ở giữa. Lấy đĩa ra cẩn thận và dùng nóng cùng nước hấp cá.');

/* Kiem tra tinh day du cua tap seed truoc khi bat dau ghi du lieu. */
IF (SELECT COUNT(*) FROM @Categories) <> 8
   OR (SELECT COUNT(*) FROM @Ingredients) <> 64
   OR (SELECT COUNT(*) FROM @Recipes) <> 20
   OR (SELECT COUNT(*) FROM @RecipeIngredients) <> 148
   OR (SELECT COUNT(*) FROM @CookingSteps) <> 80
    THROW 51021, N'Tập seed không đạt số lượng đã công bố.', 1;

IF EXISTS (SELECT 1 FROM @Recipes AS r WHERE NOT EXISTS
    (SELECT 1 FROM @Categories AS c WHERE c.CategoryName = r.CategoryName))
   OR EXISTS (SELECT 1 FROM @RecipeIngredients AS ri WHERE
    NOT EXISTS (SELECT 1 FROM @Recipes AS r WHERE r.RecipeName = ri.RecipeName)
    OR NOT EXISTS (SELECT 1 FROM @Ingredients AS i WHERE i.IngredientName = ri.IngredientName)
    OR ri.Quantity <= 0 OR LEN(LTRIM(RTRIM(ri.Unit))) = 0)
   OR EXISTS (SELECT 1 FROM @CookingSteps AS s WHERE NOT EXISTS
    (SELECT 1 FROM @Recipes AS r WHERE r.RecipeName = s.RecipeName))
   OR EXISTS (SELECT 1 FROM @Recipes AS r WHERE NOT EXISTS
    (SELECT 1 FROM @RecipeIngredients AS ri WHERE ri.RecipeName = r.RecipeName AND ri.IsRequired = 1))
   OR EXISTS (SELECT 1 FROM @Recipes AS r LEFT JOIN @CookingSteps AS s ON s.RecipeName = r.RecipeName
    GROUP BY r.RecipeName HAVING COUNT(s.StepNumber) <> 4 OR MIN(s.StepNumber) <> 1 OR MAX(s.StepNumber) <> 4)
    THROW 51022, N'Tập seed có tham chiếu, định lượng hoặc bước nấu không hợp lệ.', 1;

DECLARE @InsertedRecipes TABLE (
    RecipeID INT NOT NULL PRIMARY KEY,
    CategoryID INT NOT NULL,
    RecipeName NVARCHAR(200) COLLATE Vietnamese_100_CI_AS NOT NULL
);
DECLARE @InsertedCategories INT = 0, @InsertedIngredients INT = 0;
DECLARE @InsertedRecipeIngredients INT = 0, @InsertedCookingSteps INT = 0;

BEGIN TRY
    BEGIN TRANSACTION;

    /* Cung tai nguyen khoa voi schema.sql de tranh hai script chay dong thoi. */
    DECLARE @LockResult INT;
    EXEC @LockResult = sys.sp_getapplock
        @Resource = N'SmartCookDB.SchemaAndSeed',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 15000;
    IF @LockResult < 0
        THROW 51023, N'Không lấy được khóa khởi tạo SmartCookDB. Hãy thử lại sau.', 1;

    INSERT INTO dbo.Categories (CategoryName, Description, ImageUrl)
    SELECT c.CategoryName, c.Description, NULL
    FROM @Categories AS c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Categories AS existing WITH (UPDLOCK, HOLDLOCK)
        WHERE existing.CategoryName = c.CategoryName);
    SET @InsertedCategories = @@ROWCOUNT;

    INSERT INTO dbo.Ingredients (IngredientName, IngredientCategory, DefaultUnit, ImageUrl)
    SELECT i.IngredientName, i.IngredientCategory, i.DefaultUnit, NULL
    FROM @Ingredients AS i
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Ingredients AS existing WITH (UPDLOCK, HOLDLOCK)
        WHERE existing.IngredientName = i.IngredientName);
    SET @InsertedIngredients = @@ROWCOUNT;

    INSERT INTO dbo.Recipes
        (CategoryID, RecipeName, Description, ImageUrl, PrepTime, CookTime, Servings, Difficulty, CreatedBy)
    OUTPUT inserted.RecipeID, inserted.CategoryID, inserted.RecipeName
        INTO @InsertedRecipes (RecipeID, CategoryID, RecipeName)
    SELECT c.CategoryID, r.RecipeName, r.Description, NULL,
        r.PrepTime, r.CookTime, r.Servings, r.Difficulty, NULL
    FROM @Recipes AS r
    INNER JOIN dbo.Categories AS c ON c.CategoryName = r.CategoryName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Recipes AS existing WITH (UPDLOCK, HOLDLOCK)
        WHERE existing.CategoryID = c.CategoryID AND existing.RecipeName = r.RecipeName);

    INSERT INTO dbo.RecipeIngredients (RecipeID, IngredientID, Quantity, Unit, IsRequired, Notes)
    SELECT r.RecipeID, i.IngredientID, ri.Quantity, ri.Unit, ri.IsRequired, ri.Notes
    FROM @RecipeIngredients AS ri
    INNER JOIN @InsertedRecipes AS r ON r.RecipeName = ri.RecipeName
    INNER JOIN dbo.Ingredients AS i ON i.IngredientName = ri.IngredientName;
    SET @InsertedRecipeIngredients = @@ROWCOUNT;

    INSERT INTO dbo.CookingSteps (RecipeID, StepNumber, Instruction, ImageUrl)
    SELECT r.RecipeID, s.StepNumber, s.Instruction, NULL
    FROM @CookingSteps AS s
    INNER JOIN @InsertedRecipes AS r ON r.RecipeName = s.RecipeName;
    SET @InsertedCookingSteps = @@ROWCOUNT;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* Bao cao khong thay doi du lieu: lan chay thu hai phai them moi 0 dong. */
SELECT @InsertedCategories AS InsertedCategories,
       @InsertedIngredients AS InsertedIngredients,
       (SELECT COUNT(*) FROM @InsertedRecipes) AS InsertedRecipes,
       @InsertedRecipeIngredients AS InsertedRecipeIngredients,
       @InsertedCookingSteps AS InsertedCookingSteps;

SELECT (SELECT COUNT(*) FROM dbo.Categories) AS TotalCategories,
       (SELECT COUNT(*) FROM dbo.Ingredients) AS TotalIngredients,
       (SELECT COUNT(*) FROM dbo.Recipes) AS TotalRecipes,
       (SELECT COUNT(*) FROM dbo.RecipeIngredients) AS TotalRecipeIngredients,
       (SELECT COUNT(*) FROM dbo.CookingSteps) AS TotalCookingSteps;
GO
