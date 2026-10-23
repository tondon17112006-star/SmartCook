# Báo cáo Bước 4 — Gợi ý món ăn theo nguyên liệu

Kiểm tra ngày **16/10/2026**, giờ Việt Nam, tại `C:\Users\MyPC\Desktop\SmartCook`.

## Kết quả thực hiện

Đã triển khai **POST `/api/recipes/suggest`**, dùng connection pool `mssql/msnodesqlv8` hiện có và dữ liệu thật của SQL Server 2019 `SmartCookDB`. Không tạo lại database, thay schema, seed lại dữ liệu hoặc sửa Frontend. Các API GET cũ giữ nguyên hợp đồng.

SQL Server hiện có 20 món, 64 nguyên liệu và 148 thành phần công thức. Database compatibility level được kiểm tra là **150**, hỗ trợ `OPENJSON`; không thực hiện ALTER cấu hình. Danh sách ID được bind bằng `NVARCHAR(MAX)` chứa JSON, phân trang bằng tham số `INT`. Một trang có kết quả dùng 3 lượt gửi SQL, không tăng theo số món: kiểm tra ID, batch tính tổng/lấy trang, nạp nguyên liệu của cả trang. Trang rỗng bỏ lượt cuối.

Các lựa chọn thiết kế và công thức được giải thích tại [SUGGESTION_ALGORITHM.md](SUGGESTION_ALGORITHM.md); hợp đồng request/response tại [API.md](API.md#post-apirecipessuggest).

## Request và response thực tế

Đã khởi động Backend bằng `npm run dev`, gọi API bằng PowerShell tới `127.0.0.1:5000`. ID được xác nhận từ SQL Server: **64 = Trứng gà, 18 = Dầu ăn, 9 = Cà chua**. Chúng là ID của database hiện tại, không hardcode trong thuật toán.

Request mẫu đã gửi:

```json
{
  "ingredientIds": [64, 18, 9],
  "servings": 4,
  "page": 1,
  "limit": 1
}
```

HTTP **200**. Phần trích từ món đầu trong response thực tế:

```json
{
  "recipeId": 8,
  "recipeName": "Trứng chiên",
  "prepTime": 5,
  "cookTime": 7,
  "totalTime": 12,
  "servings": 2,
  "requestedServings": 4,
  "matchedRequiredCount": 2,
  "totalRequiredCount": 2,
  "missingRequiredCount": 0,
  "matchPercentage": 100,
  "status": "ready"
}
```

Response đầy đủ có `matchedIngredients`, `missingIngredients`, `optionalIngredients` và pagination. [Request JSON](examples/suggestion-request.json) cùng [response JSON đầy đủ](examples/suggestion-response.json) được lưu trực tiếp từ lần gọi HTTP, không phải response mẫu do ứng dụng trả từ file. Pagination của request `limit=1`: `total=13`, `totalPages=13`, có trang tiếp theo. Với cùng nguyên liệu nhưng `limit=12`, đã kiểm tra riêng: trả 12 món, tổng 13, 2 trang.

| Thành phần Trứng chiên | quantity gốc | adjustedQuantity cho 4 khẩu phần | Đơn vị |
| --- | ---: | ---: | --- |
| Trứng gà | 3 | 6 | quả |
| Dầu ăn | 15 | 30 | ml |
| Hành lá tùy chọn | 10 | 20 | g |
| Nước mắm tùy chọn | 5 | 10 | ml |
| Tiêu tùy chọn | 0.5 | 1 | g |

Các kết quả gọi thật khác:

| Nguyên liệu đang có | Món | Điểm / trạng thái | Còn thiếu bắt buộc |
| --- | --- | --- | --- |
| Trứng gà | Trứng chiên | 50%, `missing` | Dầu ăn |
| Trứng gà | Trứng xào cà chua | 33%, `missing` | Cà chua, Dầu ăn |
| Trứng gà, Cà chua | Trứng xào cà chua | 67%, `missing` | Dầu ăn |
| Trứng gà, Cà chua, Dầu ăn | Trứng xào cà chua | 100%, `ready` | Không có |

`ready` chỉ xác nhận đủ **loại nguyên liệu bắt buộc**, không chứng minh người dùng có đủ gram/ml/quả. Tỷ lệ thực tế dựa vào `IsRequired` trong SQL Server, không sửa dữ liệu để khớp một ví dụ minh họa.

## Kiểm thử tự động

Đã chạy sau khi hoàn tất mã nguồn:

```powershell
Set-Location C:\Users\MyPC\Desktop\SmartCook\server
npm test
npm run test:integration
```

| Bộ kiểm thử | Có sẵn từ Bước 3 | Bổ sung Bước 4 | Tổng đạt | Lỗi / bỏ qua |
| --- | ---: | ---: | ---: | --- |
| Unit | 33 | 28 | **61** | 0 / 0 |
| Integration | 62 | 76 | **138** | 0 / 0 |
| Tổng theo node:test | 95 | 104 | **199** | **0 / 0** |

Unit test không cần SQL Server. Integration test sử dụng SQL Server thực tế, tự mở cổng HTTP ngẫu nhiên, đóng server/pool khi kết thúc. Các test gợi ý không tạo bản ghi fixture hoặc thay đổi dữ liệu để đạt kết quả mong muốn.

### Đối chiếu 20 nhóm kiểm tra bắt buộc

| STT | Trường hợp | Phạm vi và kết quả |
| ---: | --- | --- |
| 1 | ingredientIds rỗng | Unit + HTTP thật: 400 |
| 2 | ID âm | Unit + HTTP thật: 400 |
| 3 | ID trùng | Unit + HTTP: loại trùng, điểm và thứ tự không tăng; 100 phần tử trùng được nhận, 101 bị chặn |
| 4 | ID không tồn tại | Kiểm tra SQL thật, cả danh sách sai hoặc trộn đúng/sai: 400 |
| 5 | Sai kiểu | String/boolean/null/object/nested array, body sai và trường lạ: 400 |
| 6 | Một nguyên liệu | Trứng gà → Trứng chiên 50%, thiếu dầu |
| 7 | Nhiều nguyên liệu | Trứng, cà chua, dầu → gợi ý từ nhiều công thức thực tế |
| 8 | Phù hợp 100% | Trứng + dầu: Trứng chiên `ready`; trứng + cà chua + dầu: Trứng xào cà chua `ready` |
| 9 | Phù hợp 50% | Trứng chiên có 1/2 loại bắt buộc |
| 10 | Không trùng loại bắt buộc | Món bị loại dù có trùng nguyên liệu tùy chọn |
| 11 | Không có nguyên liệu bắt buộc | Unit helper loại món, điểm 0, không chia 0 hoặc tự gán ready/100%; SQL CTE cũng loại nhóm này |
| 12 | Nhiều món cùng tỷ lệ | Unit từng mức phân định; integration so thứ tự với bộ tính độc lập từ toàn bộ liên kết SQL hiện có |
| 13 | Thay servings | Kiểm tra 1, 5, 20 khẩu phần bằng HTTP; lượng gốc giữ nguyên, lượng điều chỉnh đúng, không đổi điểm; unit kiểm tra khẩu phần gốc hỏng |
| 14 | Page/limit sai | Số 0, âm, phân số, null, chuỗi, boolean, object, array, vượt giới hạn: 400 |
| 15 | SQL Injection | ID chứa payload SQL bị chặn 400; GET cũ tiếp tục kiểm tra SQL Injection; số dòng/hash không đổi |
| 16 | SQL timeout | Dùng query SQL thật với WAITFOR 3 giây và timeout 1000 ms trong service: 504 an toàn |
| 17 | Database mất khả dụng | Tiến trình riêng trỏ database không tồn tại: POST gợi ý 503, health vẫn 200; không dừng dịch vụ SQL Server của người dùng |
| 18 | Không có kết quả | ID hợp lệ nhưng không được dùng làm loại bắt buộc: 200, data rỗng, total/totalPages=0 |
| 19 | Không đổi dữ liệu | SHA-256 toàn bộ JSON có thứ tự PK và số dòng của cả 10 bảng trước/sau giống hệt |
| 20 | API cũ | Hồi quy đầy đủ bộ Bước 3 và smoke 6 GET endpoint sau các request gợi ý: đạt |

Không tạo công thức “không có nguyên liệu bắt buộc” trong database chỉ để thử trường hợp 11; dữ liệu seed không có trường hợp này nên kiểm tra biên đó ở unit test, kết hợp điều kiện lọc SQL. Test lỗi kết nối không tắt SQL Server hoặc thay đổi cấu hình hệ thống. Không thêm endpoint gây lỗi thử vào ứng dụng thật; timeout được kích hoạt qua dependency trong ứng dụng Express riêng của bài kiểm thử.

### Kiểm tra bổ sung

- Không truyền `servings`: `requestedServings=null`, lượng điều chỉnh bằng lượng gốc.
- Nguyên liệu tùy chọn xuất hiện trong `optionalIngredients` với `isAvailable`; không ảnh hưởng điểm hoặc trạng thái.
- Phân trang sau xếp hạng, không trùng món giữa các trang; trang vượt cuối giữ đúng tổng.
- Tất cả ID/số đếm/định lượng là JSON number; cờ là boolean, gồm dữ liệu native driver có kiểu chuỗi.
- Làm tròn nửa lên thống nhất giữa SQL và JavaScript. Regression `29/200` cho 15%; không dùng phép chia số thực rồi làm tròn khi giá trị có thể lệch ngưỡng 14.5.
- `200/201` có thể làm tròn 100% nhưng vẫn `missing`; `1/1000` làm tròn 0% vẫn đủ điều kiện vì có một loại trùng.
- Định lượng nhỏ vẫn dương, không bị làm tròn cố định về 0; không sinh NaN/Infinity khi dữ liệu khẩu phần không hợp lệ.
- SQL/query/stack/chuỗi kết nối không được đưa vào lỗi HTTP.

## File tạo hoặc sửa

Tạo:

- `server/src/services/suggestion.service.js`: truy vấn SQL, kiểm tra ID, xếp hạng/phân trang và nạp thành phần theo lô.
- `server/src/services/suggestion-matcher.js`: tính điểm, phân nhóm nguyên liệu, điều chỉnh định lượng; hàm thuần có thể kiểm tra độc lập.
- `server/src/utilities/suggestion-validator.js`: validation JSON và giới hạn đầu vào.
- `server/tests/suggestion.unit.test.js`, `server/tests/suggestion.integration.test.js`.
- `docs/SUGGESTION_ALGORITHM.md`, `docs/SUGGESTION_VERIFICATION.md`.
- `docs/examples/suggestion-request.json`, `docs/examples/suggestion-response.json`: kết quả HTTP được lưu để xem lại.

Cập nhật: `server/src/controllers/recipe.controller.js`, `server/src/routes/recipe.routes.js`, `server/package.json`, `docs/API.md`, `README.md`, `PLAN.md`, `docs/architecture.md`.

Không thêm dependency, không đổi cấu hình kết nối/TLS/driver, không sửa thư mục `database` hoặc mã nguồn Frontend. Hash source trước/sau được kiểm tra riêng khi bàn giao. Các log kiểm thử trong `.cache/` được Git bỏ qua.

## Giới hạn còn lại

- Chưa có lượng tồn, chuyển đổi đơn vị, tên đồng nghĩa, nguyên liệu thay thế, hạn dùng hoặc kiểm tra dinh dưỡng/dị ứng.
- Mọi loại bắt buộc có cùng trọng số. Gia vị/nước/dầu tính vào điểm nếu công thức đánh dấu bắt buộc.
- Chỉ nhận tối đa 100 ID mỗi request; chưa hỗ trợ includeAll hoặc cách xếp hạng tùy chọn.
- Điều chỉnh lượng tuyến tính với 12 chữ số có nghĩa; không tự điều chỉnh thời gian hoặc kỹ thuật nấu, không làm tròn số quả cho người nấu.
- Dữ liệu không bị đóng băng giữa các lần phân trang; thay đổi từ tác vụ khác có thể làm kết quả thay đổi.
- Ảnh seed vẫn null, Frontend vẫn trang khởi tạo, chưa có xác thực/Admin. Những cảnh báo phụ thuộc dev và yêu cầu driver production của Bước 3 giữ nguyên; Bước 4 không cài thêm thư viện.

Không còn lỗi trong các kiểm tra đã chạy. Tiến trình `npm run dev` dùng thử đã được dừng; Backend có thể khởi động lại theo README và ví dụ PowerShell trong [API.md](API.md#post-apirecipessuggest).
