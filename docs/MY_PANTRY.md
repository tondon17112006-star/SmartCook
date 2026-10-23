# Tủ nguyên liệu cá nhân — Bước 9

`/pantry` có ProtectedRoute, lấy dữ liệu cá nhân từ `dbo.UserIngredients` theo UserID phiên. Bảng đã có UNIQUE(UserID,IngredientID), không cần migration, không xóa/gộp dữ liệu cũ.

| API | Kết quả |
| --- | --- |
| GET `/api/pantry?page=1&limit=100` | `{data,pagination}`, chỉ tủ của mình; tên nguyên liệu rồi ID tăng dần |
| POST `/api/pantry` | 201 `{data:item}`, JSON ingredientId/quantity/unit/expiryDate |
| PATCH `/api/pantry/:id` | 200 `{data:item}`, chỉ quantity/unit/expiryDate |
| DELETE `/api/pantry/:id` | 200 `{message}`, JSON `{}`; chỉ xóa liên kết cá nhân |

Mọi API cần phiên. POST/PATCH/DELETE cần JSON, token CSRF và Origin được phép. UserID không nhận từ client. ID không thuộc mình hoặc không còn tồn tại trả404; trùng nguyên liệu409, trường thừa hoặc dữ liệu sai400. Không có quyền Admin bỏ qua sở hữu trong Bước 9.

DTO: userIngredientId, ingredientId, ingredientName, ingredientCategory, defaultUnit, imageUrl, quantity, unit, expiryDate. Không trả UserID hoặc thông tin tài khoản. GET mặc định100, tối đa100 mỗi trang; client tải hết trang, kiểm tra metadata/ID trùng và giới hạn10.000 dòng. Không trình bày dữ liệu tải thiếu như tủ đầy đủ.

## Số lượng, đơn vị và ngày

- `quantity`: null nếu không nhập; nếu có phải là JSON number dương, tối đa9999999999.99, tối đa2 chữ số thập phân theo DECIMAL(12,2). Không cắt/làm tròn ngầm hoặc nhận chuỗi số từ API.
- `unit`: null hoặc văn bản NFC/trim1–30 ký tự, không ký tự điều khiển/ẩn hoặc dấu `< >`. Phải có đơn vị khi số lượng không null. UI gợi ý đơn vị mặc định của nguyên liệu, người dùng có thể tự nhập; không tự quy đổi số lượng khi đổi đơn vị.
- `expiryDate`: null hoặc ngày Gregorian có thật, dạng YYYY-MM-DD, năm0001–9999; cho phép ngày quá khứ để quản lý hàng hết hạn. Không tự đoán ngày. SQL bind chuỗi rồi CONVERT(DATE), trả CHAR(10), tránh dịch ngày theo timezone của JavaScript.
- PATCH kiểm tra trạng thái kết hợp với dòng hiện có, ví dụ không thể xóa đơn vị khi vẫn giữ số lượng. Có thể xóa đồng thời quantity/unit bằng null.

## Chính sách hạn dùng và tìm món

Lấy ngày lịch tại **Asia/Ho_Chi_Minh**. Hạn trước hôm nay là hết hạn; hôm nay và3 ngày tiếp theo là sắp hết hạn, vẫn được chọn. Nguyên liệu không có ngày được đưa vào danh sách tìm món với thông báo cần tự kiểm tra chất lượng. Không suy đoán hạn, không tự xóa hàng hết hạn.

**Nấu ăn từ tủ nguyên liệu** lấy toàn bộ IngredientID chưa hết hạn, đối chiếu catalog và đưa vào luồng chọn nguyên liệu hiện có. Giữ khẩu phần đã chọn, chuyển `/suggestions` để gọi POST `/api/recipes/suggest`. Nếu rỗng hoặc vượt100 loại, không chuyển một phần danh sách; hiển thị thông báo để người dùng xử lý.

Tủ cá nhân được lưu SQL; chỉ lựa chọn ID/khẩu phần chuyển sang luồng gợi ý tiếp tục dùng sessionStorage cũ. Không dùng localStorage để thay thế SQL. `ready` chỉ xác nhận đủ **loại** nguyên liệu bắt buộc, chưa kiểm tra đủ lượng hoặc đổi đơn vị; không trừ tủ sau khi nấu và không đổi thuật toán Bước4.

UI có tìm nguyên liệu từ catalog thật, thêm/sửa/xóa có xác nhận, số dòng, nhãn hạn dùng, loading/rỗng/lỗi/thử lại và kết quả hành động từ API. Đổi phiên/tài khoản hủy request, xóa state/draft cá nhân trong bộ nhớ. Chi tiết kiểm thử tại [STEP9_VERIFICATION.md](STEP9_VERIFICATION.md).
