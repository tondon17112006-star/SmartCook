# API SmartCook — bao gồm Meal Planner

Backend mặc định: `http://127.0.0.1:5000`. Các endpoint trả JSON, truy vấn Microsoft SQL Server `SmartCookDB`; auth đăng ký/cập nhật hồ sơ ghi vào Users. Riêng `/api/health` hoạt động độc lập với database. Sáu endpoint `GET` của Bước 3 giữ nguyên; Bước 4 bổ sung `POST /api/recipes/suggest`, Bước 8 bổ sung auth và kiểm tra quyền Admin.

API món ăn gồm **7 endpoint**; phần xác thực bổ sung 7 endpoint. Các phần sau mô tả Favorites, Reviews, Pantry tương thích, Admin và 5 endpoint Meal Planner. Mọi dữ liệu lịch/shopping thuộc tài khoản trong session, không phải UserID do client chọn.

| Endpoint | Chức năng |
| --- | --- |
| `/api/health` | Kiểm tra tiến trình API. |
| `/api/health/db` | Kiểm tra kết nối và truy vấn SQL Server. |
| `/api/categories` | Toàn bộ danh mục món ăn. |
| `/api/ingredients` | Tìm kiếm, lọc và phân trang nguyên liệu. |
| `/api/recipes` | Tìm kiếm, lọc, sắp xếp và phân trang món ăn. |
| `/api/recipes/:id` | Chi tiết món ăn, danh mục, định lượng và bước nấu. |
| `POST /api/recipes/suggest` | Gợi ý theo nguyên liệu bắt buộc, xếp hạng, phân trang và đổi định lượng theo khẩu phần. |

Sáu dòng đầu dùng HTTP `GET`. Endpoint gợi ý dùng `POST` để nhận bộ lọc và chỉ đọc SQL Server; không cần đăng nhập/CSRF. Các thao tác ghi tài khoản ở phần auth có chính sách riêng.

## Quy ước chung

- Tên thuộc tính dùng `camelCase`; ID, thời gian, số lượng và metadata phân trang là JSON number. `isRequired` là JSON boolean.
- Thời gian tính bằng phút; `totalTime = prepTime + cookTime`.
- `imageUrl`, các mô tả và ghi chú có thể là `null`. Ảnh của bộ seed hiện tại là `null`.
- Mỗi query parameter chỉ được truyền một giá trị. Ví dụ `?page=1&page=2` trả `400`.
- Các số nguyên trong path/query của API `GET` phải có dạng chữ số thập phân dương, không có dấu, khoảng trắng, số 0 đầu, phần thập phân hoặc số mũ. `1` hợp lệ; `01`, `1.0`, `1e2` và `0` không hợp lệ. JSON body của API `POST` dùng JSON number nguyên, không nhận chuỗi số; xem validation riêng bên dưới.
- Chuỗi được cắt khoảng trắng hai đầu và chuẩn hóa Unicode NFC trước khi kiểm tra độ dài. Tìm kiếm chuỗi trống tương đương không lọc.
- Tìm kiếm theo tên dùng phép tìm chuỗi con. Các cột tên dùng collation `Vietnamese_100_CI_AS`: không phân biệt hoa/thường, **có phân biệt dấu**. Không có tìm kiếm bỏ dấu tự động.
- `%`, `_`, `[` và `~` trong từ khóa được xem là ký tự literal, không mở rộng thành wildcard. Ví dụ `search=%` tìm tên có ký tự `%`.
- Giá trị lọc và tìm kiếm được bind qua tham số SQL (`NVARCHAR`, `INT`); kiểu sắp xếp lấy từ whitelist. Nội dung query không được dùng làm câu lệnh SQL.

## GET /api/health

Thành công trả HTTP `200`:

```json
{
  "status": "ok",
  "service": "SmartCook API",
  "timestamp": "2026-10-16T00:00:00.000Z"
}
```

`timestamp` trong ví dụ minh họa định dạng ISO 8601 UTC; phản hồi thực tế dùng thời điểm yêu cầu. Endpoint này không truy vấn SQL Server và vẫn hoạt động khi database không truy cập được.

## GET /api/health/db

Thực hiện `SELECT 1 AS connected` qua connection pool. Thành công trả HTTP `200`, gồm `status: "ok"`, `service: "SmartCook Database"` và `timestamp` UTC. Không trả chuỗi kết nối, thông tin driver hoặc tài khoản.

Lỗi kết nối trả `503`; timeout truy vấn trả `504`; xem quy ước lỗi bên dưới.

## GET /api/categories

Trả HTTP `200` với `{ "data": [...] }`. Không phân trang. Sắp xếp theo tên tăng dần, sau đó `CategoryID` tăng dần.

| Thuộc tính của mỗi phần tử `data` | Kiểu |
| --- | --- |
| `categoryId` | number |
| `categoryName` | string |
| `description` | string hoặc null |
| `imageUrl` | string hoặc null |

## GET /api/ingredients

| Query | Mặc định | Giá trị hợp lệ |
| --- | --- | --- |
| `search` | Không lọc | Tối đa 150 ký tự; tìm trong `IngredientName`. |
| `ingredientCategory` | Không lọc | Tối đa 100 ký tự; khớp tên nhóm nguyên liệu. Chuỗi trống không lọc. |
| `page` | `1` | Số nguyên từ `1` đến `100000`. |
| `limit` | `20` | Số nguyên từ `1` đến `100`. |

`ingredientCategory` là nhãn nhóm nguyên liệu, ví dụ `Trứng`, `Rau củ`, `Thịt`; không phải ID danh mục món ăn. Các bộ lọc kết hợp bằng `AND`. Kết quả sắp xếp tên tăng dần, sau đó `IngredientID` tăng dần.

Trả HTTP `200` với `{ "data": [...], "pagination": {...} }`.

| Thuộc tính của mỗi phần tử `data` | Kiểu |
| --- | --- |
| `ingredientId` | number |
| `ingredientName` | string |
| `ingredientCategory` | string |
| `defaultUnit` | string |
| `imageUrl` | string hoặc null |

## GET /api/recipes

| Query | Mặc định | Giá trị hợp lệ |
| --- | --- | --- |
| `search` | Không lọc | Tối đa 150 ký tự; tìm trong `RecipeName`. |
| `categoryId` | Không lọc | Số nguyên từ `1` đến `2147483647`. |
| `maxTime` | Không lọc | Số nguyên từ `1` đến `2147483647`; lấy món có tổng thời gian không vượt quá số phút này. |
| `difficulty` | Không lọc | Chính xác `Dễ`, `Trung bình` hoặc `Khó` sau khi chuẩn hóa chuỗi; có phân biệt hoa/thường khi validate. |
| `page` | `1` | Số nguyên từ `1` đến `100000`. |
| `limit` | `20` | Số nguyên từ `1` đến `100`. |
| `sort` | `newest` | Một trong 5 giá trị ở bảng dưới. |

Không truyền `categoryId`, `maxTime`, `difficulty` hoặc `sort` nếu muốn dùng mặc định; truyền chuỗi trống cho các tham số này trả `400`. ID danh mục hợp lệ về định dạng nhưng không có dữ liệu tương ứng trả danh sách rỗng. Các bộ lọc kết hợp bằng `AND`.

| `sort` | Thứ tự |
| --- | --- |
| `newest` | `CreatedAt` giảm dần, `RecipeID` giảm dần. |
| `name_asc` | Tên tăng dần, `RecipeID` tăng dần. |
| `name_desc` | Tên giảm dần, `RecipeID` giảm dần. |
| `time_asc` | Tổng thời gian tăng dần, `RecipeID` tăng dần. |
| `time_desc` | Tổng thời gian giảm dần, `RecipeID` giảm dần. |

ID dùng để phân định khi giá trị sắp xếp bằng nhau. Phép cộng thời gian trong SQL được chuyển sang `BIGINT` để tránh tràn số `INT`.

Trả HTTP `200` với `{ "data": [...], "pagination": {...} }`.

| Thuộc tính của mỗi phần tử `data` | Kiểu / ý nghĩa |
| --- | --- |
| `recipeId` | number |
| `recipeName` | string |
| `description` | string hoặc null |
| `imageUrl` | string hoặc null |
| `prepTime` | number; phút chuẩn bị |
| `cookTime` | number; phút chế biến |
| `totalTime` | number; tổng phút |
| `servings` | number; khẩu phần gốc |
| `difficulty` | string |
| `categoryName` | string |

### Metadata phân trang

`GET /api/ingredients`, `GET /api/recipes` và `POST /api/recipes/suggest` dùng cùng cấu trúc `pagination`. Mặc định/giới hạn `limit` của API gợi ý được quy định riêng:

| Thuộc tính | Ý nghĩa |
| --- | --- |
| `page` | Trang yêu cầu. |
| `limit` | Số phần tử tối đa mỗi trang. |
| `total` | Tổng số dòng khớp bộ lọc, trước phân trang. |
| `totalPages` | `Math.ceil(total / limit)`; bằng `0` khi không có kết quả. |
| `hasNextPage` | `page < totalPages`. |
| `hasPreviousPage` | `page > 1`. |

Trang vượt số trang hiện có vẫn trả `200`, `data: []` và giữ nguyên tổng số kết quả khớp bộ lọc. Khi không có kết quả ở trang mặc định, phản hồi là:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## GET /api/recipes/:id

`id` phải là số nguyên từ `1` đến `2147483647`. ID không hợp lệ trả `400`; đúng định dạng nhưng món không tồn tại trả `404` với `{ "message": "Không tìm thấy món ăn." }`.

Thành công trả HTTP `200` với `{ "data": {...} }`. `data` có đầy đủ các thuộc tính món ăn trong API danh sách, cộng thêm:

| Thuộc tính | Nội dung |
| --- | --- |
| `category` | Object: `categoryId` (number), `categoryName` (string), `description` và `imageUrl` (string hoặc null). |
| `ingredients` | Mảng nguyên liệu và định lượng; sắp xếp tên tăng dần, sau đó `ingredientId` tăng dần. |
| `steps` | Mảng bước nấu, sắp xếp `stepNumber` tăng dần. |

Mỗi phần tử `ingredients` gồm:

| Thuộc tính | Kiểu / ý nghĩa |
| --- | --- |
| `ingredientId` | number |
| `ingredientName` | string |
| `ingredientCategory` | string |
| `defaultUnit` | string; đơn vị mặc định của nguyên liệu |
| `imageUrl` | string hoặc null |
| `quantity` | number; định lượng theo khẩu phần gốc của món |
| `unit` | string; đơn vị thực tế trong công thức |
| `isRequired` | boolean; nguyên liệu bắt buộc hay tùy chọn |
| `notes` | string hoặc null |

Mỗi phần tử `steps` gồm `stepId` (number), `stepNumber` (number), `instruction` (string), `imageUrl` (string hoặc null).

API chi tiết `GET /api/recipes/:id` trả định lượng gốc từ SQL Server. Đổi khẩu phần được hỗ trợ riêng ở API gợi ý, chưa quy đổi giữa các đơn vị. Phản hồi không bao gồm dữ liệu tài khoản, mật khẩu hoặc hash mật khẩu.

## POST /api/recipes/suggest

Gửi `Content-Type: application/json`. Body phải là object JSON, chỉ gồm các thuộc tính trong bảng sau:

| Thuộc tính | Bắt buộc / mặc định | Giá trị hợp lệ |
| --- | --- | --- |
| `ingredientIds` | Bắt buộc | Mảng từ 1 đến 100 phần tử trước khi loại trùng; mỗi phần tử là JSON number nguyên từ `1` đến `2147483647`, phải tồn tại trong `dbo.Ingredients`. |
| `servings` | Không bắt buộc; không đổi khẩu phần khi bỏ qua | JSON number nguyên từ `1` đến `20`. |
| `page` | `1` | JSON number nguyên từ `1` đến `100000`. |
| `limit` | `12` | JSON number nguyên từ `1` đến `50`. |

Ví dụ đã gọi trên SQL Server hiện tại: Trứng gà có ID `64`, Dầu ăn `18`, Cà chua `9`. Khi dữ liệu thay đổi, lấy lại ID từ `GET /api/ingredients` theo hướng dẫn PowerShell ở cuối tài liệu:

```json
{
  "ingredientIds": [64, 18, 9],
  "servings": 4,
  "page": 1,
  "limit": 12
}
```

API loại ID trùng, giữ thứ tự xuất hiện đầu tiên. Mảng 101 phần tử vẫn bị từ chối dù sau loại trùng còn dưới 100 ID. Thiếu body, body là mảng/null, thiếu `ingredientIds`, mảng rỗng, ID không tồn tại, số âm, số thập phân, boolean, object, chuỗi số như `"1"`, giá trị `null` hoặc thuộc tính lạ đều trả `400` với thông báo tiếng Việt. Các tùy chọn chưa hỗ trợ, ví dụ `includeAll` và `sort`, cũng bị từ chối; không tự bỏ qua thuộc tính không được khai báo. Giá trị mặc định chỉ áp dụng khi không gửi thuộc tính đó.

Validation kiểm tra giá trị số sau khi JSON được parse: cách viết `1.0` hoặc `1e0` có cùng giá trị nguyên `1` nên được chấp nhận trong JSON body nếu nằm trong giới hạn. Quy tắc chuỗi chữ số nghiêm ngặt ở path/query của các API `GET` không áp dụng cho cú pháp JSON number.

### So khớp và xếp hạng

Chỉ `RecipeIngredients.IsRequired = 1` được tính điểm:

```text
matchPercentage = round(matchedRequiredCount / totalRequiredCount × 100)
missingRequiredCount = totalRequiredCount − matchedRequiredCount
```

Món có `totalRequiredCount = 0` bị loại để tránh chia cho 0 hoặc gán 100% không có cơ sở. Món có `matchedRequiredCount = 0` cũng bị loại. Nguyên liệu tùy chọn không tăng điểm và không tự được xem là có sẵn. Không có tùy chọn lấy tất cả món ở Bước 4.

Thứ tự cố định: `matchPercentage` đã làm tròn giảm dần → `missingRequiredCount` tăng dần → `totalTime` tăng dần → `recipeId` tăng dần. Phân trang được áp dụng sau lọc và xếp hạng.

### Phản hồi thành công

HTTP `200`, cấu trúc `{ "data": [...], "pagination": {...} }`. `pagination` dùng quy ước chung; `total` đếm tất cả món phù hợp trước phân trang. Không có món phù hợp trả `data: []`, `total: 0`, `totalPages: 0`; trang vượt phạm vi vẫn trả `200` và giữ nguyên tổng số món phù hợp.

Mỗi món giữ các thuộc tính của danh sách `GET /api/recipes`: `recipeId`, `recipeName`, `description`, `imageUrl`, `prepTime`, `cookTime`, `totalTime`, `servings`, `difficulty`, `categoryName`; bổ sung:

| Thuộc tính | Kiểu / ý nghĩa |
| --- | --- |
| `requestedServings` | number hoặc null; khẩu phần yêu cầu, `null` khi không gửi `servings`. `servings` luôn giữ khẩu phần gốc. |
| `matchPercentage` | number nguyên từ 0 đến 100; tỷ lệ số loại nguyên liệu bắt buộc đang có, sau làm tròn. Có ít nhất một loại trùng nhưng số loại bắt buộc rất lớn vẫn có thể làm tròn thành 0%. |
| `matchedRequiredCount` | number; số loại nguyên liệu bắt buộc đã có. |
| `totalRequiredCount` | number; tổng số loại nguyên liệu bắt buộc. |
| `missingRequiredCount` | number; số loại nguyên liệu bắt buộc còn thiếu. |
| `status` | `ready` nếu không thiếu loại bắt buộc nào; `missing` nếu còn thiếu. |
| `matchedIngredients` | Mảng nguyên liệu bắt buộc đã có. |
| `missingIngredients` | Mảng nguyên liệu bắt buộc còn thiếu. |
| `optionalIngredients` | Toàn bộ nguyên liệu tùy chọn; `isAvailable` cho biết từng loại đã được chọn hay chưa. |

Mỗi phần tử của ba mảng nguyên liệu có:

| Thuộc tính | Kiểu / ý nghĩa |
| --- | --- |
| `ingredientId` | number |
| `ingredientName` | string |
| `quantity` | number; định lượng gốc trong SQL Server, không ghi đè bằng định lượng đã đổi. |
| `adjustedQuantity` | number; `quantity × requestedServings / servings`; bằng `quantity` khi không yêu cầu đổi khẩu phần. |
| `unit` | string; đơn vị gốc của thành phần công thức. |
| `isRequired` | boolean; `true` với hai mảng bắt buộc, `false` với mảng tùy chọn. |
| `isAvailable` | boolean; ID nguyên liệu có trong danh sách người dùng gửi lên hay không. |
| `notes` | string hoặc null; ghi chú gốc. |

Trong từng mảng, nguyên liệu được sắp xếp theo tên tăng dần, sau đó ID tăng dần, theo collation SQL Server hiện tại.

`ready` chỉ xác nhận đủ **loại** nguyên liệu bắt buộc. Trạng thái dựa trên số loại còn thiếu, không suy ra từ tỷ lệ đã làm tròn: công thức có rất nhiều loại có thể đạt điểm làm tròn 100% trong khi vẫn thiếu loại bắt buộc. API không nhận số lượng trong kho nên không xác nhận đủ khối lượng/số quả thực tế. Khẩu phần gốc phải là số nguyên dương hữu hạn; dữ liệu khẩu phần hỏng trả `500` an toàn thay vì chia cho 0. Khi đổi khẩu phần, định lượng được giới hạn 12 chữ số có nghĩa để giảm nhiễu số thực; không làm tròn cố định hai chữ số thập phân hoặc tự làm tròn số quả thành số nguyên. Thời gian nấu, đơn vị và khẩu phần gốc vẫn giữ nguyên.

### Ví dụ dựa trên dữ liệu seed hiện có

| Món / nguyên liệu người dùng chọn | Bắt buộc đã có / tổng | Tỷ lệ | Trạng thái / thiếu |
| --- | --- | --- | --- |
| Trứng chiên / Trứng gà | 1 / 2 | 50% | `missing`; thiếu Dầu ăn. |
| Trứng xào cà chua / Trứng gà, Cà chua | 2 / 3 | 67% | `missing`; thiếu Dầu ăn. |
| Trứng xào cà chua / Trứng gà, Cà chua, Dầu ăn | 3 / 3 | 100% | `ready`; không thiếu loại bắt buộc. |

Trong SQL Server hiện tại, Dầu ăn là nguyên liệu bắt buộc của hai món trên; việc thuộc nhóm `Gia vị` không tự biến nguyên liệu thành tùy chọn. Kết quả luôn đọc `IsRequired`, không hardcode theo tên món hoặc ví dụ minh họa. Khi yêu cầu 4 khẩu phần cho Trứng xào cà chua có khẩu phần gốc 2, `quantity` Trứng gà vẫn là `3`, `adjustedQuantity` là `6`; Cà chua đổi từ `250` thành `500` g và Dầu ăn từ `15` thành `30` ml.

Request mẫu `[64, 18, 9]`, `servings: 4`, `page: 1`, `limit: 12` đã trả **13 món phù hợp**, `totalPages: 2`. Món đầu là **Trứng chiên**, 100%, `ready`, 2/2 loại bắt buộc, không thiếu loại nào; `servings: 2`, `requestedServings: 4`. Trứng gà giữ `quantity: 3` và có `adjustedQuantity: 6`; Dầu ăn giữ `quantity: 15` và có `adjustedQuantity: 30`. Đây là kết quả của dữ liệu hiện tại, không phải quy tắc cố định cho mọi bộ dữ liệu.

Xem [thuật toán và giới hạn](SUGGESTION_ALGORITHM.md) và [kết quả kiểm chứng thực tế](SUGGESTION_VERIFICATION.md).

## Lỗi

Lỗi trả JSON chỉ có thuộc tính `message`, ví dụ:

```json
{ "message": "page phải là số nguyên dương." }
```

| HTTP | Trường hợp |
| --- | --- |
| `400` | ID/query/body không hợp lệ, ID nguyên liệu gợi ý không tồn tại, thuộc tính body lạ, tham số lặp, chuỗi quá dài hoặc JSON không hợp lệ. |
| `403` | Header `Origin` không nằm trong danh sách CORS được phép. |
| `404` | Món ăn không tồn tại hoặc đường dẫn không được định nghĩa. |
| `413` | JSON body vượt giới hạn `100kb` của middleware. |
| `500` | Lỗi nội bộ hoặc lỗi truy vấn SQL không thuộc nhóm kết nối/timeout. |
| `503` | Không kết nối hoặc không truy cập được database. |
| `504` | Kết nối/truy vấn vượt thời gian cho phép; gồm native ODBC SQLSTATE `HYT00`/`HYT01` và mã `ETIMEOUT`. |

Lỗi SQL và lỗi ngoài dự kiến được thay bằng thông báo tiếng Việt an toàn. Phản hồi không chứa stack trace, câu SQL hoặc chuỗi kết nối. Log lỗi máy chủ chỉ ghi thông báo cố định, HTTP status và mã phân loại cố định. Không có endpoint tạo lỗi thử nghiệm trong API ứng dụng.

## Gọi thử bằng PowerShell

Khởi động Backend theo [README](../README.md), rồi mở terminal khác:

```powershell
$baseUrl = 'http://127.0.0.1:5000/api'
Invoke-RestMethod "$baseUrl/health"
Invoke-RestMethod "$baseUrl/health/db"
(Invoke-RestMethod "$baseUrl/categories").data
(Invoke-RestMethod "$baseUrl/ingredients?page=1&limit=5").data

# Encode từ khóa tiếng Việt trước khi ghép URL.
$keyword = [Uri]::EscapeDataString('trứng')
$ingredients = Invoke-RestMethod "$baseUrl/ingredients?search=$keyword"
$ingredients | ConvertTo-Json -Depth 5

$recipes = Invoke-RestMethod "$baseUrl/recipes?search=$keyword&page=1&limit=5&sort=time_asc"
$recipes | ConvertTo-Json -Depth 5

$difficulty = [Uri]::EscapeDataString('Dễ')
Invoke-RestMethod "$baseUrl/recipes?maxTime=30&difficulty=$difficulty&limit=100"

# Dùng ID thực tế từ API thay vì giả định quan hệ danh mục hoặc nguyên liệu.
$categories = Invoke-RestMethod "$baseUrl/categories"
if ($categories.data.Count -gt 0) {
  $categoryId = $categories.data[0].categoryId
  Invoke-RestMethod "$baseUrl/recipes?categoryId=$categoryId"
}

if ($recipes.data.Count -gt 0) {
  $recipeId = $recipes.data[0].recipeId
  Invoke-RestMethod "$baseUrl/recipes/$recipeId" | ConvertTo-Json -Depth 8
}
```

Kiểm tra dữ liệu sai bằng `Invoke-RestMethod "$baseUrl/recipes?page=0"`: PowerShell báo HTTP `400`, API trả thông báo validation. Kết quả số dòng và ID phụ thuộc dữ liệu đang có trong SQL Server; không phải dữ liệu giả lập trong Backend.

### Gọi API gợi ý bằng PowerShell

Ví dụ lấy ID theo đúng tên từ API; không giả định ID seed cố định. Trong Windows PowerShell 5.1, gửi JSON dưới dạng byte UTF-8 để bảo toàn tiếng Việt nếu body sau này có chuỗi:

```powershell
$baseUrl = 'http://127.0.0.1:5000/api'
$ingredientNames = @('Trứng gà', 'Cà chua', 'Dầu ăn')
$ingredientIds = @(
  foreach ($name in $ingredientNames) {
    $search = [Uri]::EscapeDataString($name)
    $response = Invoke-RestMethod "$baseUrl/ingredients?search=$search&limit=100"
    $ingredient = @($response.data | Where-Object { $_.ingredientName -eq $name })
    if ($ingredient.Count -ne 1) {
      throw "Không tìm thấy đúng một nguyên liệu: $name"
    }
    [int]$ingredient[0].ingredientId
  }
)

$body = @{
  ingredientIds = $ingredientIds
  servings = 4
  page = 1
  limit = 12
} | ConvertTo-Json -Depth 4

$suggestions = Invoke-RestMethod -Method Post -Uri "$baseUrl/recipes/suggest" `
  -ContentType 'application/json; charset=utf-8' `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))

$suggestions | ConvertTo-Json -Depth 8
$suggestions.data | Select-Object recipeId, recipeName, matchPercentage, status, missingRequiredCount
```

Để thử trường hợp còn thiếu nguyên liệu, bỏ `Dầu ăn` khỏi `$ingredientNames` rồi chạy lại phần lấy ID và gửi request: Trứng xào cà chua còn 67%. Bỏ thuộc tính `servings` nếu muốn giữ nguyên định lượng. Đổi `page`/`limit` trong JSON body để thử phân trang; không đưa chúng vào query string của API gợi ý.

## Xác thực và phân quyền — Bước 8

| Endpoint | Yêu cầu | Thành công |
| --- | --- | --- |
| GET `/api/auth/csrf` | Cookie nếu đã có; Origin phải được phép khi gửi | 200 `{csrfToken}` và HttpOnly nonce cookie |
| POST `/api/auth/register` | JSON fullName/email/password + Origin + CSRF | 201 `{data: user}`; luôn User, không tự login |
| POST `/api/auth/login` | JSON email/password + Origin + CSRF | 200 `{data: user}` và JWT HttpOnly Cookie |
| POST `/api/auth/logout` | JSON `{}` + Origin + CSRF | 200 `{message}`; thu hồi phiên, xóa cookie |
| GET `/api/auth/me` | Cookie phiên đang hoạt động | 200 `{data: user}` |
| PATCH `/api/auth/profile` | Cookie + Origin + CSRF; chỉ fullName/phone | 200 `{data: user}` |
| GET `/api/admin/check` | Cookie và vai trò Admin thực tế từ SQL | 200 `{message}` |

`user` có `userId` number, `fullName`, `email`, `phone` nullable, `avatar` nullable, `role` User/Admin, `createdAt` ISO UTC. Không trả passwordHash, JWT hay pepper. Prefix auth/admin đặt no-store trước CORS/JSON parser, bao gồm lỗi Origin, JSON và thiếu cấu hình. Role lấy từ SQL Server ở từng request bảo vệ, không lấy từ payload client/JWT.

Register nhận đúng ba trường bắt buộc, login đúng hai trường. Họ tên 2–150 UTF-16 units, chuẩn hóa NFC/khoảng trắng; email ASCII thông dụng, lowercase/trim, tối đa 255. Mật khẩu 12–1024 Unicode code point, tối đa 4096 byte UTF-8, không NUL; **không trim hoặc normalize mật khẩu**. PATCH cần ít nhất một fullName/phone; phone null/rỗng để xóa hoặc 7–20 ký tự theo định dạng điện thoại hỗ trợ. Trường thừa (kể cả role, userId, email hoặc avatar khi PATCH) trả 400. Xem chi tiết [AUTHENTICATION.md](AUTHENTICATION.md).

Trước mỗi mutation, gọi GET csrf cùng cookie jar; gửi token trả về qua `X-CSRF-Token`, cookie nonce, `Origin` trong CLIENT_ORIGIN và `Content-Type: application/json`. Logout cũng gửi `{}`. Login xoay CSRF, vì vậy lấy lại token sau khi login. Axios frontend tự thực hiện, bật withCredentials; không dùng Bearer token hoặc localStorage.

| Mã | Trường hợp |
| --- | --- |
| 400 | Body/field không hợp lệ, JSON sai, mật khẩu ngắn, Content-Type sai |
| 401 | Sai email/mật khẩu (thông báo chung), thiếu/sai/hết hạn JWT, phiên đã thu hồi/restart, tài khoản không còn |
| 403 | Origin/CSRF sai hoặc thiếu; User truy cập API Admin |
| 409 | Email đã tồn tại, thông báo không chứa lỗi SQL |
| 429 | Login >10 lần/15 phút/IP, register >5 lần/giờ/IP; có Retry-After |
| 503/504 | Auth thiếu cấu hình, dịch vụ đầy, SQL không sẵn sàng/quá thời gian; không lộ cấu hình/truy vấn |

Thứ tự kiểm tra có ý nghĩa: request PATCH không có Origin/CSRF có thể bị 403 trước xác thực. GET me/admin không có phiên trả 401. Cookie-only đã hết JWT hoặc logout không còn quyền truy cập. CSRF nonce/tokens không sống qua Backend restart.

Ví dụ PowerShell gọi theo đúng chính sách (mật khẩu nhập tương tác, không có secret mẫu):

```powershell
$baseUrl = 'http://127.0.0.1:5000/api'
$origin = 'http://127.0.0.1:5173'
$email = Read-Host 'Email tài khoản đã đăng ký'
$securePassword = Read-Host 'Mật khẩu' -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
$csrf = Invoke-RestMethod "$baseUrl/auth/csrf" -SessionVariable authSession -Headers @{ Origin=$origin }
$loginBody = @{ email=$email; password=$plainPassword } | ConvertTo-Json -Compress
try {
  $signedIn = Invoke-RestMethod "$baseUrl/auth/login" -Method Post -WebSession $authSession `
    -Headers @{ Origin=$origin; 'X-CSRF-Token'=$csrf.csrfToken } `
    -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($loginBody))
  $signedIn.data
} finally { $plainPassword=$null; $loginBody=$null; $securePassword=$null }
Invoke-RestMethod "$baseUrl/auth/me" -WebSession $authSession
$csrf = Invoke-RestMethod "$baseUrl/auth/csrf" -WebSession $authSession -Headers @{ Origin=$origin }
Invoke-RestMethod "$baseUrl/auth/logout" -Method Post -WebSession $authSession `
  -Headers @{ Origin=$origin; 'X-CSRF-Token'=$csrf.csrfToken } -ContentType 'application/json' -Body '{}'
```

Không in cookie/token, không đưa mật khẩu vào URL/log/lịch sử lệnh. Cấp quyền Admin chỉ bằng công cụ cục bộ có xác nhận khi được phép, xem [AUTHORIZATION.md](AUTHORIZATION.md). API CRUD Admin được mô tả ở phần Bước10 bên dưới.

## Dữ liệu cá nhân và Reviews — Bước 9

Giữ JWT HttpOnly Cookie 15 phút, registry phiên, CSRF và Origin Bước 8. Mọi mutation bên dưới phải gửi `Content-Type: application/json`, cookie, `Origin` được phép và `X-CSRF-Token` lấy từ GET csrf. DELETE cũng gửi `{}`. UserID luôn từ `req.user`, không nhận để chọn người khác qua body/query. API cá nhân xác thực trước CSRF: Guest401; phiên hợp lệ nhưng thiếu/sai CSRF/Origin403. ID sai/body thừa400, bản ghi của người khác404, trùng409. Response cá nhân no-store.

### Favorites

| Endpoint | Nội dung |
| --- | --- |
| GET `/api/favorites?page=1&limit=20` | `{data,pagination}`, món mới lưu trước, phân trang tối đa100 |
| GET `/api/favorites/ids` | `{data:[recipeId,...]}` của tài khoản, không phân trang |
| POST `/api/favorites` | `{recipeId}` là JSON SQL INT number, 201 `{data:{favoriteId,recipeId,createdAt}}` |
| DELETE `/api/favorites/:recipeId` | `{}`, 200 `{message}`, không có liên kết của mình404 |

Card trong danh sách có favoriteId/createdAt và recipeId/recipeName/description/imageUrl/prepTime/cookTime/totalTime/servings/difficulty/categoryName. Không thay đổi Recipes gốc. UNIQUE(UserID,RecipeID) giữ một liên kết mỗi người/món. Chi tiết tại [FAVORITES.md](FAVORITES.md).

### Reviews

| Endpoint | Nội dung |
| --- | --- |
| GET `/api/recipes/:id/reviews?page=1&limit=20` | Công khai; `{data,pagination,summary:{averageRating,reviewCount}}`, tối đa100/trang |
| GET `/api/recipes/:id/reviews/mine` | Có phiên, `{data:review hoặc null}` cho chính tài khoản |
| POST `/api/recipes/:id/reviews` | JSON `{rating,comment?}`, 201 `{data:review}` |
| PATCH `/api/reviews/:reviewId` | JSON có ít nhất rating hoặc comment, 200 `{data:review}`, chỉ chủ sở hữu |
| DELETE `/api/reviews/:reviewId` | JSON `{}`, 200 `{message}`, chỉ chủ sở hữu |

Review gồm reviewId/recipeId/userId/fullName/rating/comment/createdAt, không email/phone/PasswordHash. Rating là JSON integer1–5. Comment tùy chọn/null, NFC/trim, trắng thànhnull, tối đa2.000 UTF-16 units, loại ký tự điều khiển ngoài tab/xuống dòng; React render văn bản, không HTML. Mỗi người/món một đánh giá theo UNIQUE đã có; trùng409. Danh sách CreatedAt DESC, ReviewID DESC; summary tính tất cả đánh giá của món, làm tròn2 chữ số, rỗng trả0/0. Chi tiết tại [REVIEWS.md](REVIEWS.md).

### Pantry

| Endpoint | Nội dung |
| --- | --- |
| GET `/api/pantry?page=1&limit=100` | `{data,pagination}`, mặc định/tối đa100, chỉ tài khoản hiện tại |
| POST `/api/pantry` | JSON ingredientId bắt buộc, quantity/unit/expiryDate tùy chọn; 201 `{data:item}` |
| PATCH `/api/pantry/:id` | JSON có ít nhất quantity/unit/expiryDate, không đổi ingredientId; 200 `{data:item}` |
| DELETE `/api/pantry/:id` | JSON `{}`, 200 `{message}`, không xóa Ingredients dùng chung |

Item gồm userIngredientId/ingredientId/ingredientName/ingredientCategory/defaultUnit/imageUrl/quantity/unit/expiryDate. Số lượng null hoặc number dương, tối đa9999999999.99, không quá2 số thập phân. Unit null hoặc NFC/trim1–30 ký tự hợp lệ, bắt buộc khi quantity không null. PATCH kiểm tra cả trạng thái ghép với dòng hiện có. Ngày null hoặc YYYY-MM-DD Gregorian năm0001–9999, có thể quá khứ; trả chuỗi ngày không gắn timezone. UNIQUE(UserID,IngredientID) ngăn trùng.

Ví dụ body (lấy IngredientID thật từ catalog trước khi gửi):

```json
{"ingredientId":64,"quantity":6,"unit":"quả","expiryDate":null}
```

Chọn món dùng ngày Việt Nam: hết hạn là trước hôm nay, hôm nay/3 ngày tới là sắp hết hạn, chưa có hạn vẫn có thể dùng tìm món với thông báo. Client chỉ chuyển ID hợp lệ chưa hết hạn và giữ khẩu phần sang API gợi ý hiện có, không đổi thuật toán hay quy đổi/trừ số lượng. Chi tiết tại [MY_PANTRY.md](MY_PANTRY.md).

Không cần migration: cả ba UNIQUE đã được kiểm tra trên SQL Server. Bộ kiểm thử sử dụng transaction rollback và hai User ngẫu nhiên, không tạo Admin hoặc để lại dữ liệu thử; xem [STEP9_VERIFICATION.md](STEP9_VERIFICATION.md).

## Quản trị — Bước 10

Tất cả endpoint sau cần JWT/session hợp lệ **và Role Admin đọc từ SQL ở mỗi request**, response no-store. Guest401; User403. POST/PATCH/DELETE dùng JSON, cookie, CSRF và Origin như auth; DELETE gửi `{}`. Trường không được hỗ trợ trả400. Không có API nâng quyền hoặc xóa User.

| Endpoint | Phản hồi / body |
| --- | --- |
| GET `/api/admin/check` | 200 `{message}`, giữ tương thích Bước8 |
| GET `/api/admin/dashboard` | 200 `{data:{totals,mostFavorited,mostReviewed,newestRecipes}}` |
| GET `/api/admin/recipes` | 200 `{data,pagination}`; search/categoryId/sort/page/limit |
| GET `/api/admin/recipes/:id` | 200 `{data:recipe}` đầy đủ ingredients/steps; không thấy404 |
| POST `/api/admin/recipes` | 201 `{data:recipe}`, body công thức đầy đủ |
| PATCH `/api/admin/recipes/:id` | 200 `{data:recipe}`, body một phần hoặc đầy đủ |
| DELETE `/api/admin/recipes/:id` | 200 `{message}`, có Favorites/Reviews/MealPlanItems trả409 |
| GET `/api/admin/categories` | 200 `{data,pagination}`; search/page/limit, có recipeCount |
| POST `/api/admin/categories` | 201 `{data:category}`; `{categoryName,description?,imageUrl?}` |
| PATCH `/api/admin/categories/:id` | 200 `{data:category}`; ít nhất một trường trên |
| DELETE `/api/admin/categories/:id` | 200 `{message}`, có Recipes409 |
| GET `/api/admin/ingredients` | 200 `{data,pagination}`; search/ingredientCategory/page/limit |
| POST `/api/admin/ingredients` | 201 `{data:ingredient}`; `{ingredientName,ingredientCategory,defaultUnit,imageUrl?}` |
| PATCH `/api/admin/ingredients/:id` | 200 `{data:ingredient}`; ít nhất một trường trên |
| DELETE `/api/admin/ingredients/:id` | 200 `{message}`, có RecipeIngredients/UserIngredients409 |
| GET `/api/admin/users` | 200 `{data,pagination}`; search tên/email, role User/Admin, page/limit |
| GET `/api/admin/users/:id` | 200 `{data:user}` với hồ sơ cơ bản; không thấy404 |
| GET `/api/admin/reviews` | 200 `{data,pagination}`; search/recipeId/rating/page/limit |
| DELETE `/api/admin/reviews/:id` | 200 `{message}`, Admin được xóa review người khác, không thấy404 |

Các list mặc định page1/limit20, tối đa100/trang, page tối đa100000. `sort` recipes whitelist: `newest`, `name_asc`, `name_desc`, `time_asc`, `time_desc`; không nội suy SQL từ query. Search tối đa150 ký tự; wildcard LIKE được escape và bind parameters. IngredientCategory tối đa100, rating integer1–5, các ID SQL INT dương. Bộ lọc thừa hoặc giá trị nhiều phần trả400.

Dashboard totals có recipeCount/ingredientCount/categoryCount/userCount/reviewCount/favoriteCount, tính bằng COUNT_BIG; số0 khi bảng rỗng. Hai danh sách top có recipeId/recipeName/count, món mới có recipeId/recipeName/createdAt; mỗi danh sách tối đa5. Xem [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md).

Recipe gồm recipeId/recipeName/categoryId/categoryName/description/imageUrl/prepTime/cookTime/totalTime/servings/difficulty/createdAt/updatedAt và detail có ingredients/steps. POST nhận tên1–200, categoryId, thời gianINT không âm tổng>0, servingsINT>0, difficulty đúng `Dễ`, `Trung bình`, `Khó`. Mảng ingredients1–200 dòng `{ingredientId,quantity,unit,isRequired,notes?}`: không trùngID, ít nhất một required, quantity dương tối đa2 chữ số thập phân. Mảng steps1–100 `{stepNumber,instruction,imageUrl?}`: liên tiếp từ1, instruction1–10000 ký tự. PATCH thay mảng khi gửi; các trường/mảng không gửi được giữ lại và kiểm tra trạng thái ghép. CreatedBy lấy từ session; CreatedAt/UpdatedAt do SQL. Xem [ADMIN_RECIPES.md](ADMIN_RECIPES.md) về transaction, ảnh và giới hạn trường.

Category có categoryId/categoryName/description/imageUrl; GET list và POST có thêm recipeCount, PATCH trả các trường cơ bản và giao diện tải lại list để nhận số đếm mới. Ingredient có ingredientId/ingredientName/ingredientCategory/defaultUnit/imageUrl; GET list và POST có thêm recipeCount/pantryCount, PATCH trả các trường cơ bản. Tên danh mục/nguyên liệu1–150, mô tả danh mục nullable tối đa500, nhóm nguyên liệu1–100, unit1–30. Tên trùng theo collation SQL trả409, không phân biệt bằng cách lách chữ hoa/thường. Sửa đơn vị mặc định không sửa định lượng công thức. URL ảnh nullable, tối đa500, chỉ http(s) không credentials hoặc root-relative an toàn; không upload.

User DTO chỉ có userId/fullName/email/phone/avatar/role/createdAt, không PasswordHash/JWT/pepper. Review có reviewId/recipeId/recipeName/userId/fullName/rating/comment/createdAt; comment hiển thị văn bản. Xóa Admin review không xóa Recipes. API review User cũ vẫn áp dụng quyền sở hữu.

ID/body/query sai400; thiếu đối tượng404; trùng hoặc đang được tham chiếu409; Origin/CSRF/User403; session401; lỗi SQL nội bộ không lộ truy vấn. Request JSON vẫn giới hạn100kb chung của Express. Không CASCADE hoặc dữ liệu mẫu trong luồng production. Bước10 không cần migration; Meal Planner mới dùng migration001 bổ sung như phần bên dưới. Kết quả lịch sử Bước10 và giới hạn fixture tại [STEP10_VERIFICATION.md](STEP10_VERIFICATION.md).

## Meal Planner và Shopping List

Nhóm `/api/meal-plans` dùng cùng JWT HttpOnly Cookie, session store, middleware xác thực, CSRF và Origin hiện có. User và Admin chỉ thao tác **lịch riêng của mình**; Admin không có API đọc chéo lịch người khác. UserID lấy từ `req.user.userId`, không nhận qua body/query. Response riêng có `Cache-Control: private, no-store`.

| Endpoint | Request | Phản hồi thành công |
| --- | --- | --- |
| GET `/api/meal-plans?weekStart=YYYY-MM-DD` | `weekStart` bắt buộc, đúng thứ Hai | 200 `{data:{mealPlanId,weekStart,weekEnd,days,summary}}` |
| GET `/api/meal-plans/shopping-list?weekStart=YYYY-MM-DD` | Cùng quy tắc tuần | 200 `{data:{weekStart,weekEnd,items}}` |
| POST `/api/meal-plans/items` | JSON `{recipeId,mealDate,mealType,servings,sortOrder?}` | 201 `{data:item}` |
| PATCH `/api/meal-plans/items/:id` | JSON có ít nhất `mealDate`, `mealType`, `servings` hoặc `sortOrder` | 200 `{data:item}` |
| DELETE `/api/meal-plans/items/:id` | JSON `{}` | 200 `{message}` |

GET không tạo lịch. Tuần chưa có dữ liệu trả `mealPlanId: null`, đủ 7 ngày và 3 mảng bữa rỗng/ngày; summary bằng 0. Một lịch rỗng đã tồn tại sau xóa món cuối vẫn có MealPlanID và trả cùng cấu trúc ngày. Không có lịch mẫu tự động hoặc ghi vào localStorage thay SQL.

### Ngày, bữa, định danh và khẩu phần

- Ngày phải là chuỗi Gregory chính xác `YYYY-MM-DD`, không timestamp. Backend tính ngày lịch độc lập timezone; nút Tuần này/Hôm nay phía client dùng `Asia/Ho_Chi_Minh`.
- `weekStart` phải là thứ Hai; tuần kết thúc Chủ nhật. Miền hỗ trợ gồm các tuần đầy đủ từ `0001-01-01` tới tuần bắt đầu `9999-12-20`, ngày cuối `9999-12-26`.
- `mealType` đúng `Breakfast`, `Lunch`, `Dinner`, có phân biệt hoa/thường; UI lần lượt hiển thị Sáng, Trưa, Tối.
- `recipeId` là JSON SQL INT dương và phải tồn tại; `servings` là JSON integer 1–20. `sortOrder` là JSON integer 0–2147483647, mặc định 0 khi thêm; UI hiện không có kéo thả/thay thứ tự trực tiếp.
- ID trên path là số nguyên dương dạng thập phân như convention chung. PATCH không đổi RecipeID; muốn chọn công thức khác thì thêm mục mới/xóa mục cũ có xác nhận.
- Chỉ nhận các trường đã nêu. Query mutation phải rỗng; GET chỉ nhận một `weekStart`. UserID/role/MealPlanID hoặc trường lạ bị400, không dùng để chọn chủ sở hữu.

POST xác định thứ Hai từ `mealDate`, tạo MealPlans nếu chưa có và thêm item trong một transaction. Một bữa có nhiều món; UNIQUE `(MealPlanID, MealDate, MealType, RecipeID)` ngăn trùng cùng món trong cùng bữa/ngày. Cùng RecipeID vẫn có thể nằm ở ngày hoặc bữa khác.

PATCH có thể chuyển item sang tuần khác: repository tìm/tạo lịch đích thuộc cùng User và cập nhật MealPlanID trong cùng transaction. Chủ sở hữu được khóa theo thứ tự nhất quán; production dùng SERIALIZABLE, UPDLOCK/HOLDLOCK và UNIQUE làm hàng rào race. Deadlock SQL1205 được retry toàn transaction tối đa hai lần rồi trả lỗi nghiệp vụ409. Lỗi giữa chừng rollback, không để lại lịch đích/item ghi dở. DELETE chỉ xóa MealPlanItem và cập nhật timestamp lịch, không xóa Recipes hoặc dữ liệu cá nhân khác.

### DTO lịch

`days` có 7 phần tử theo thứ tự thứ Hai–Chủ nhật:

```text
{date, meals:{Breakfast:[item,...], Lunch:[item,...], Dinner:[item,...]}}
```

`summary` gồm `itemCount` (số lần lên món), `mealCount` (bữa có ít nhất một món), `dayCount` (ngày có món), `ingredientCount` (IngredientID bắt buộc khác nhau trong tuần).

Mỗi item có `mealPlanItemId`, `mealPlanId`, `recipeId`, `recipeName`, `imageUrl`, `mealDate`, `mealType`, `servings`, `originalServings`, `prepTime`, `cookTime`, `totalTime`, `sortOrder`. ID/thời gian/khẩu phần/thứ tự là JSON number; ngày là chuỗi DATE, ảnh nullable. Metadata công thức được join từ Recipes hiện tại, không sao chép vào MealPlanItems. Thứ tự: ngày, Breakfast/Lunch/Dinner, SortOrder, MealPlanItemID.

### DTO và phép tính Shopping List

Mỗi dòng `items` có `ingredientId`, `ingredientName`, `ingredientCategory`, `unit`, `totalQuantity`, `recipeCount`, `plannedItemCount`, `recipes:[{recipeId,recipeName}]`. `totalQuantity` là **chuỗi decimal**, không phải JSON number; giữ chuỗi khi hiển thị để tránh mất chính xác tổng lớn.

Mỗi mục đóng góp `RecipeIngredients.Quantity × PlannedServings / Recipes.Servings`. SQL DECIMAL được đọc thành text, Backend cộng các phân số bằng BigInt rồi làm tròn **lên** ở tối đa 6 chữ số thập phân cho kết quả dương. Chỉ gộp khi IngredientID và Unit đúng chuỗi cùng nhau; không quy đổi g/kg, ml/l, số quả/khối lượng hoặc tự đồng nhất hoa/thường của đơn vị. Cùng món ở nhiều ngày được cộng đủ số lần. `recipeCount` đếm RecipeID khác nhau, `plannedItemCount` đếm mục lịch sử dụng nguyên liệu đó; `recipes` là các món khác nhau liên quan.

Chỉ tính `IsRequired = 1`; optional không nằm trong tổng mặc định. Không trừ `UserIngredients`, không khẳng định có đủ lượng tại nhà, không sửa công thức gốc. Checkbox Đã mua thuộc state tạm frontend và không có endpoint ghi trạng thái mua trong phạm vi này. Chi tiết tại [SHOPPING_LIST.md](SHOPPING_LIST.md).

### Lỗi và tương thích

| Mã | Tình huống |
| --- | --- |
| 400 | Ngày/tuần/bữa/khẩu phần/ID sai, trường thừa, mutation query, JSON/Content-Type không hợp lệ, dữ liệu FK vừa đổi |
| 401 | Guest, JWT sai/hết hạn, phiên đã thu hồi hoặc tài khoản không còn |
| 403 | Origin hoặc CSRF thiếu/sai trong mutation |
| 404 | Recipe không tồn tại khi thêm; item không tồn tại hoặc không thuộc tài khoản khi sửa/xóa |
| 409 | Recipe đã có ở bữa/ngày đích; xung đột concurrent chưa giải quyết sau retry |
| 500/503/504 | Lỗi nội bộ/kết nối/timeout được che bởi error handler chung |

Pantry API `/api/pantry` tiếp tục hoạt động với ownership cũ và bảng UserIngredients giữ nguyên; không có chuyển dữ liệu Pantry sang MealPlans. Giao diện tương thích tại `/legacy-pantry`; `/pantry` redirect replace sang `/meal-planner`, không phải đổi tên hoặc xóa API. Admin DELETE Recipe kiểm tra thêm MealPlanItems và trả409 với thông báo món đang dùng trong lịch. FK mới đều NO ACTION; không CASCADE.

Migration 001 đã được áp dụng trên môi trường dự án ngày 27/10/2026, schema hiện có 12 bảng; không chạy lại trong lượt hoàn thiện ngày 28/10. Hướng dẫn cài mới/nâng cấp tại [MEAL_PLANNER_DATABASE.md](MEAL_PLANNER_DATABASE.md); kết quả test chức năng mới và các giới hạn Not Tested tại [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md). Số Passed ở báo cáo cũ không thay thế kết quả Meal Planner.
