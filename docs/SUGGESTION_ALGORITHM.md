# Thuật toán gợi ý món ăn — Bước 4

Endpoint `POST /api/recipes/suggest` tìm món trong Microsoft SQL Server `SmartCookDB` bằng những **loại** nguyên liệu người dùng chọn. Thuật toán không suy luận từ tên món và không dùng dữ liệu giả trong phản hồi. Bộ seed hiện có 20 món, 64 nguyên liệu và 148 thành phần công thức; API làm việc trên dữ liệu thực tế đang có, kể cả khi các số lượng này thay đổi.

## Nguồn dữ liệu và phạm vi

| Bảng | Vai trò |
| --- | --- |
| `Ingredients` | Kiểm tra ID nguyên liệu đầu vào tồn tại; lấy tên nguyên liệu. |
| `Recipes` | Tên, mô tả, ảnh, thời gian, độ khó và khẩu phần gốc của món. |
| `RecipeIngredients` | Quan hệ món/nguyên liệu, định lượng, đơn vị, `IsRequired` và ghi chú. |
| `Categories` | Tên danh mục món ăn. |

Khóa chính ghép `(RecipeID, IngredientID)` của `RecipeIngredients` đảm bảo mỗi loại nguyên liệu xuất hiện tối đa một lần trong một món. Vì vậy phép đếm đếm số loại, không phải tổng gram, ml hoặc số quả. `IsRequired = 1` là bắt buộc; `IsRequired = 0` là tùy chọn. Nhóm `IngredientCategory`, tên nguyên liệu, tên món và ghi chú không thay thế cờ này. Dầu ăn, nước hoặc nước mắm vẫn được tính nếu dòng công thức đánh dấu bắt buộc.

Luồng gợi ý chỉ đọc dữ liệu, không thêm lịch sử tìm kiếm, lưu nguyên liệu của người dùng, sửa công thức hoặc thay đổi schema. Connection pool `mssql/msnodesqlv8` và cấu hình SQL Server hiện tại được dùng lại. Frontend và sáu API `GET` của Bước 3 giữ nguyên hợp đồng.

## 1. Kiểm tra và chuẩn hóa đầu vào

Body chỉ nhận `ingredientIds`, `servings`, `page`, `limit`; thuộc tính khác bị từ chối. Tất cả đầu vào số là JSON number nguyên, không ép chuỗi, boolean hoặc `null` thành số.

- `ingredientIds` bắt buộc, từ 1 đến 100 phần tử trước loại trùng; mỗi ID từ 1 đến 2147483647.
- Loại ID trùng, giữ thứ tự lần xuất hiện đầu. Chọn một loại nhiều lần không tăng điểm.
- Kiểm tra toàn bộ ID đã loại trùng tồn tại trong `Ingredients`; có ID không tồn tại thì trả `400`, không âm thầm bỏ ID sai.
- `servings` tùy chọn, từ 1 đến 20. Không gửi thì không đổi định lượng và phản hồi có `requestedServings: null`.
- `page` mặc định 1, tối đa 100000; `limit` mặc định 12, tối đa 50. Các giá trị tối thiểu đều là 1.

Body thiếu/rỗng/sai kiểu, mảng nguyên liệu rỗng, ID âm/phân số/quá lớn, quá 100 phần tử, trường lạ và các giá trị ngoài giới hạn trả `400` với thông báo tiếng Việt. Middleware chung giới hạn body JSON ở `100kb` (`413` khi vượt quá).

## 2. Tính tỷ lệ phù hợp

Gọi `A` là tập ID nguyên liệu người dùng đã chọn sau loại trùng, `R` là tập ID bắt buộc của món:

```text
totalRequiredCount   = |R|
matchedRequiredCount = |R ∩ A|
missingRequiredCount = |R| − |R ∩ A|

matchPercentage = round(100 × matchedRequiredCount / totalRequiredCount)
```

Kết quả là số nguyên, ví dụ `2 / 3` thành `67`, `1 / 2` thành `50`. Điểm dựa trên số loại bắt buộc, mỗi loại có trọng số bằng nhau. Nguyên liệu tùy chọn không xuất hiện trong tử số hoặc mẫu số. Có thêm hành lá hoặc tiêu tùy chọn không giúp món từ 50% lên 100%.

Phép làm tròn nửa lên với các số đếm không âm dùng `floor((200 × matchedRequiredCount + totalRequiredCount) / (2 × totalRequiredCount))` trong cả SQL và helper JavaScript. SQL dùng phép chia số nguyên với `BIGINT`; JavaScript dùng `Math.floor`. Công thức tránh nhiễu ở ngưỡng `.5`, ví dụ `29 / 200` phải cho 15%, và giữ điểm xếp hạng SQL nhất quán với điểm trong phản hồi.

Hai trường hợp bị loại trước khi trả kết quả:

1. `totalRequiredCount = 0`: không có cơ sở đánh giá; không chia cho 0 và không tự gán 100%.
2. `matchedRequiredCount = 0`: không trùng loại bắt buộc nào; kể cả người dùng có nguyên liệu tùy chọn của món.

Chưa có tùy chọn tìm tất cả món hoặc trả món không trùng loại bắt buộc nào. Với công thức có rất nhiều loại bắt buộc, có ít nhất một loại trùng vẫn có thể cho điểm làm tròn 0%; điều kiện lọc dùng số đếm, không dùng điểm đã làm tròn. Truyền `includeAll` bị từ chối như thuộc tính body không hỗ trợ.

## 3. Xếp hạng và phân trang

SQL Server lọc món đủ điều kiện, tính điểm và sắp xếp theo đúng thứ tự:

| Mức ưu tiên | Trường | Chiều |
| --- | --- | --- |
| 1 | `matchPercentage` đã làm tròn | Giảm dần |
| 2 | `missingRequiredCount` | Tăng dần |
| 3 | `totalTime = prepTime + cookTime` | Tăng dần |
| 4 | `recipeId` | Tăng dần |

Hai tỷ lệ thực khác nhau nhưng cùng điểm đã làm tròn được xem là bằng nhau ở tiêu chí thứ nhất. Những tiêu chí tiếp theo xác định thứ tự, không ngầm dùng tỷ lệ chưa làm tròn hoặc tên món. `RecipeID` giúp thứ tự ổn định nếu dữ liệu không đổi. Phép cộng thời gian dùng `BIGINT` trong SQL để tránh tràn tổng hai cột `INT`.

Phân trang diễn ra sau lọc và xếp hạng. `offset = (page − 1) × limit`. `pagination.total` đếm toàn bộ món phù hợp, `totalPages = ceil(total / limit)`. Không có kết quả trả HTTP `200`, `data: []`, `total: 0`, `totalPages: 0`; trang vượt giới hạn vẫn trả `200`, mảng rỗng và giữ tổng số món. Metadata dùng cùng quy ước với API danh sách hiện tại: `hasNextPage = page < totalPages`, `hasPreviousPage = page > 1`.

## 4. Phân nhóm nguyên liệu và trạng thái

Với từng món trong trang kết quả:

| Thuộc tính | Quy tắc |
| --- | --- |
| `matchedIngredients` | Bắt buộc và ID thuộc `A`. |
| `missingIngredients` | Bắt buộc và ID không thuộc `A`. |
| `optionalIngredients` | Tất cả nguyên liệu tùy chọn, dù đã có hoặc chưa có. |

Mỗi phần tử giữ `ingredientId`, `ingredientName`, `quantity`, `unit`, `isRequired`, `notes`, bổ sung `adjustedQuantity` và `isAvailable`. `quantity` luôn là định lượng gốc trong SQL Server. `isAvailable` được xác định từ việc ID có thuộc tập `A` hay không; không suy luận rằng gia vị luôn có sẵn.

`status = "ready"` khi `missingRequiredCount = 0`; ngược lại là `"missing"`. Trạng thái không suy từ điểm đã làm tròn: công thức có rất nhiều loại có thể làm tròn tới 100% trong khi vẫn thiếu một loại. `ready` nghĩa là đủ **loại nguyên liệu bắt buộc**, không chứng minh đủ số lượng thực tế, có đủ nguyên liệu tùy chọn hoặc món đã sẵn sàng để ăn. Request chỉ có ID nên không thể so sánh lượng tồn với lượng cần nấu.

## 5. Đổi định lượng theo khẩu phần

```text
adjustedQuantity = quantity × requestedServings / originalServings
```

`originalServings` là `Recipes.Servings`, được trả nguyên vẹn trong thuộc tính `servings`. `requestedServings` là thuộc tính riêng. Khi không gửi khẩu phần yêu cầu, `requestedServings = null` và `adjustedQuantity = quantity`.

Khi đổi khẩu phần, helper dùng `Number((quantity × requestedServings / originalServings).toPrecision(12))` để giảm nhiễu số thực, giữ 12 chữ số có nghĩa. Không làm tròn cố định hai chữ số thập phân vì một lượng dương nhỏ có thể bị biến thành 0; không tự làm tròn số quả thành số nguyên. `quantity` gốc, `unit`, `notes`, `servings`, `prepTime` và `cookTime` vẫn giữ nguyên. Đổi khẩu phần không làm tăng/giảm phần trăm phù hợp.

Khẩu phần gốc không phải số nguyên dương hữu hạn được xem là dữ liệu không hợp lệ; service trả lỗi `500` an toàn thay vì chia cho 0, sinh `Infinity`/`NaN` hoặc tự thay bằng 1. Giá trị định lượng đã đổi phải là số dương hữu hạn. Các ràng buộc SQL hiện có cũng bảo vệ khẩu phần và định lượng gốc, nhưng helper vẫn kiểm tra để an toàn khi dữ liệu nhận vào không đúng hợp đồng.

## 6. Ví dụ theo cờ IsRequired trong seed

Các ví dụ dưới đây được suy ra từ `database/seed.sql`; ID phải lấy qua SQL Server/API vì không cố định theo tên.

| Món | Nguyên liệu bắt buộc | Người dùng chọn | Kết quả |
| --- | --- | --- | --- |
| Trứng chiên | Trứng gà, Dầu ăn | Trứng gà | 1/2 → 50%, `missing`, thiếu Dầu ăn. |
| Trứng xào cà chua | Trứng gà, Cà chua, Dầu ăn | Trứng gà, Cà chua | 2/3 → 67%, `missing`, thiếu Dầu ăn. |
| Trứng xào cà chua | Trứng gà, Cà chua, Dầu ăn | Trứng gà, Cà chua, Dầu ăn | 3/3 → 100%, `ready`. |

Ví dụ minh họa chỉ có Trứng gà và Cà chua đạt 100% chỉ đúng với một công thức đánh dấu hai loại đó là bắt buộc và Dầu ăn tùy chọn. Seed hiện tại đánh dấu Dầu ăn bắt buộc; API tôn trọng dữ liệu này, không sửa seed để khớp ví dụ.

Trứng xào cà chua có khẩu phần gốc 2, thời gian 7 phút chuẩn bị + 8 phút nấu. Yêu cầu 4 khẩu phần giữ `servings: 2`, thêm `requestedServings: 4`, tổng thời gian vẫn là 15 phút:

| Thành phần | quantity gốc | adjustedQuantity | Đơn vị |
| --- | --- | --- | --- |
| Trứng gà | 3 | 6 | quả |
| Cà chua | 250 | 500 | g |
| Dầu ăn | 15 | 30 | ml |

Các nguyên liệu tùy chọn cũng được đổi định lượng bằng cùng công thức.

## 7. Truy vấn SQL và xử lý lỗi

Danh sách ID được serialize thành JSON và bind bằng tham số `NVARCHAR`; SQL Server đọc qua `OPENJSON`, không ghép giá trị ID vào câu SQL. Phân trang bind qua tham số `INT`. Bộ lọc, công thức tính điểm và thứ tự xếp hạng là SQL nội bộ, không nhận biểu thức SQL từ request.

Truy vấn tính điểm trên các dòng bắt buộc và phân trang trong SQL Server; service nạp toàn bộ thành phần của các món trong **trang hiện tại** bằng một lượt theo lô, rồi phân nhóm và tính định lượng trong JavaScript. Không gọi một truy vấn thành phần riêng cho mỗi món và không tải toàn bộ danh sách món/thành phần về Node.js để phân trang. Connection pool dùng lại theo cấu hình hiện có.

Một request hợp lệ có kết quả trong trang dùng ba lượt gửi SQL: kiểm tra ID tồn tại; batch đếm tổng và lấy trang; nạp thành phần cho cả trang. Nếu trang rỗng, bỏ qua lượt nạp thành phần nên chỉ còn hai lượt. Số lượt không tăng theo số món trong trang. Truy vấn dùng `OPENJSON`, yêu cầu compatibility level từ 130; database hiện tại ở mức 150 và không cần thay đổi cấu hình.

Lỗi đầu vào trả `400`; lỗi dữ liệu/truy vấn nội bộ trả `500`; lỗi kết nối SQL Server trả `503`; timeout trả `504`. Middleware chung trả thông báo tiếng Việt an toàn, không đưa câu SQL, thông tin kết nối hoặc stack trace vào response. Endpoint `/api/health` vẫn kiểm tra tiến trình độc lập với database.

## Giới hạn hiện tại

- Điểm phản ánh số loại bắt buộc; chưa cân trọng số theo nguyên liệu chính, khẩu vị hoặc mức quan trọng.
- Chưa nhận lượng tồn, quy đổi đơn vị, kiểm tra đủ gram/ml/quả, hạn dùng hoặc chất lượng nguyên liệu.
- Chưa ghép tên đồng nghĩa, gợi ý nguyên liệu thay thế, kiểm tra dị ứng hoặc yêu cầu dinh dưỡng.
- Chưa tự phân loại gia vị luôn có sẵn; cờ `IsRequired` trong từng công thức là nguồn quyết định.
- Khẩu phần tăng/giảm tuyến tính; chưa tự điều chỉnh thời gian nấu, kích thước dụng cụ hoặc kỹ thuật nấu.
- Chưa lưu nguyên liệu/tìm kiếm theo tài khoản, xác thực hoặc thay đổi Frontend.
- Thứ tự ổn định khi dữ liệu không đổi; nếu có tác vụ khác cập nhật công thức giữa hai request phân trang thì danh sách có thể thay đổi.

Xem [hợp đồng API và lệnh PowerShell](API.md#post-apirecipessuggest) và [báo cáo kiểm thử thực tế](SUGGESTION_VERIFICATION.md).
