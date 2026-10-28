# Use case SmartCook

## Actors

| Actor | Quyền tổng quát |
| --- | --- |
| Guest | Xem catalog/gợi ý công khai, đăng ký và đăng nhập. |
| User | Toàn bộ quyền Guest cùng dữ liệu cá nhân của chính mình. |
| Admin | User có role Admin thực tế từ SQL; quản trị nội dung/cộng đồng theo API Admin. |

## Danh sách use case

| Mã | Use case | Actor |
| --- | --- | --- |
| UC01 | Khám phá, tìm và lọc công thức | Guest, User, Admin |
| UC02 | Xem chi tiết công thức và Cooking Mode | Guest, User, Admin |
| UC03 | Tìm món từ nguyên liệu đã chọn | Guest, User, Admin |
| UC04 | Đăng ký, đăng nhập, quản lý profile | Guest, User, Admin |
| UC05 | Quản lý Favorites | User, Admin |
| UC06 | Đọc và quản lý review của chính mình | Guest đọc; User/Admin ghi của chính mình |
| UC07 | Pantry tương thích và gợi ý từ Pantry | User, Admin |
| UC08 | Xem dashboard | Admin |
| UC09 | Quản lý recipe, category, ingredient | Admin |
| UC10 | Xem Users và xử lý review cộng đồng | Admin |
| UC11 | Lên lịch nấu ăn 7 ngày, quản lý món/bữa/khẩu phần | User, Admin với lịch riêng |
| UC12 | Xem/sao chép Shopping List bắt buộc của tuần | User, Admin với lịch riêng |

~~~mermaid
flowchart LR
  G[Guest] --> A[UC01 Khám phá công thức]
  G --> B[UC02 Xem chi tiết / Cooking Mode]
  G --> C[UC03 Gợi ý từ nguyên liệu]
  G --> D[UC04 Đăng ký / đăng nhập]
  U[User] --> A
  U --> B
  U --> C
  U --> E[UC05 Favorites]
  U --> F[UC06 Review của mình]
  U --> H[UC07 Pantry]
  U --> MP[UC11 Lịch nấu ăn]
  U --> SL[UC12 Danh sách đi chợ]
  AD[Admin] --> I[UC08 Dashboard]
  AD --> J[UC09 Quản lý catalog]
  AD --> K[UC10 Quản lý reviews / xem Users]
~~~

## UC04 – Đăng nhập

| Mục | Nội dung |
| --- | --- |
| Actor | Guest đã có tài khoản |
| Tiền điều kiện | Backend có JWT_SECRET/PASSWORD_PEPPER hợp lệ; browser cùng origin được phép |
| Luồng chính | Guest mở Login → frontend lấy CSRF → gửi email/password JSON → server kiểm tra rate limit, CSRF/Origin và password → tạo session/JWT HttpOnly cookie → trả DTO user → frontend điều hướng hợp lệ |
| Kết quả | User được xác thực; JWT không nằm trong JSON/Web Storage |
| Ngoại lệ | Input sai 400; sai thông tin 401; CSRF/Origin 403; vượt giới hạn 429; auth chưa cấu hình 503 |

## UC03 – Tìm món từ nguyên liệu

| Mục | Nội dung |
| --- | --- |
| Actor | Guest, User, Admin |
| Tiền điều kiện | Ít nhất một IngredientID hợp lệ được chọn |
| Luồng chính | Chọn nguyên liệu → chọn servings tùy chọn 1–20 → gửi POST suggestions → backend đối chiếu required ingredient → trả ranked results và matched/missing/optional → mở recipe detail nếu muốn |
| Kết quả | Hiển thị phần trăm phù hợp và nguyên liệu thiếu |
| Ngoại lệ | ID/body không hợp lệ hoặc không tồn tại trả 400; database lỗi trả 503/504 |
| Quy tắc | Không suy ra người dùng có đủ định lượng; không quy đổi đơn vị |

## UC02 – Xem chi tiết công thức

| Mục | Nội dung |
| --- | --- |
| Actor | Guest, User, Admin |
| Tiền điều kiện | RecipeID dương, có công thức trong database |
| Luồng chính | Mở route recipe → API trả metadata, ingredients và steps → người dùng đổi servings/checklist → có thể vào Cooking Mode từng bước |
| Kết quả | Nội dung món và trạng thái xem riêng cho recipe được hiển thị |
| Ngoại lệ | ID sai 400; không có món 404; database không sẵn sàng 503 |

## UC05 – Lưu món yêu thích

| Mục | Nội dung |
| --- | --- |
| Actor | User/Admin đã đăng nhập |
| Tiền điều kiện | Phiên JWT còn hiệu lực, CSRF/Origin hợp lệ |
| Luồng chính | Nhấn lưu → frontend lấy CSRF → POST recipeId → backend lấy UserID từ session, kiểm tra recipe và tạo liên kết → cập nhật state |
| Kết quả | Một Favorite duy nhất cho cặp User/Recipe |
| Ngoại lệ | Guest 401; CSRF/Origin 403; recipe sai 400/404; trùng 409 |

## UC07 – Quản lý Pantry

Use case này được giữ để tương thích ở `/legacy-pantry` và API `/api/pantry`. Navbar hiện dẫn tới Meal Planner; `/pantry` redirect replace sang `/meal-planner` sau kiểm thử luồng lịch mới. Không chuyển hoặc xóa dữ liệu UserIngredients khi thay liên kết điều hướng.

| Mục | Nội dung |
| --- | --- |
| Actor | User/Admin đã đăng nhập |
| Tiền điều kiện | Phiên hợp lệ |
| Luồng chính | Thêm/sửa/xóa Ingredient của mình, kèm quantity/unit/expiryDate tùy chọn → backend kiểm tra ownership/validation → dữ liệu hiển thị lại → có thể chuyển các ID chưa hết hạn sang Suggestions |
| Kết quả | Pantry riêng theo UserID, không ảnh hưởng catalog dùng chung |
| Ngoại lệ | Guest 401; lỗi body 400; duplicate ingredient 409; mục không thuộc user 404 |

## UC09 – Admin thêm hoặc sửa công thức

| Mục | Nội dung |
| --- | --- |
| Actor | Admin đã được cấp quyền |
| Tiền điều kiện | Role Admin trong SQL, session/CSRF/Origin hợp lệ; category/ingredient tồn tại |
| Luồng chính | Mở Admin Recipe Form → nhập metadata, 1–200 nguyên liệu với ít nhất một required và 1–100 bước liên tiếp → gửi POST/PATCH → server validate/transaction → trả recipe aggregate |
| Kết quả | Công thức, RecipeIngredients và CookingSteps cùng thành công hoặc cùng rollback |
| Ngoại lệ | Guest 401; User 403; input 400; trùng/tham chiếu 409; lỗi SQL an toàn 5xx |

Không có Admin mặc định. Khi chưa được phép, không tạo/nâng quyền chỉ để demo use case này.

## UC11 — Lên lịch nấu ăn

| Mục | Nội dung |
| --- | --- |
| Actor | User/Admin đã đăng nhập, chỉ lịch của chính mình |
| Tiền điều kiện | Migration001 đã áp dụng; phiên hợp lệ; recipe tồn tại |
| Luồng chính | Mở `/meal-planner` → chọn tuần → chọn ngày/bữa → tìm recipe hoặc chọn Favorites → nhập khẩu phần1–20 → lưu → SQL transaction tạo/tìm lịch và thêm item → tải lại lịch/Shopping List |
| Chỉnh sửa | Đổi khẩu phần, ngày, bữa; chuyển tuần liên kết đúng lịch đích trong transaction; xóa item có xác nhận |
| Kết quả | Lịch 7 ngày/3 bữa lưu SQL theo UserID session; GET không tạo lịch chưa tồn tại; reload đọc lại dữ liệu |
| Ngoại lệ | Guest401, CSRF/Origin403, dữ liệu400, recipe/item không tồn tại hoặc item của người khác404, trùng món cùng bữa/ngày409 |
| Giữ nguyên | Recipes, Favorites, Reviews, Pantry và tiến độ Cooking Mode; Admin không có quyền xem lịch User khác |

## UC12 — Chuẩn bị danh sách đi chợ

| Mục | Nội dung |
| --- | --- |
| Actor | Chủ lịch đã đăng nhập |
| Luồng chính | Chọn tuần → Backend đọc các mục lịch và required RecipeIngredients → tính theo từng PlannedServings/Recipes.Servings → gộp cùng IngredientID + đúng Unit → hiển thị tổng và món liên quan |
| Kết quả | `totalQuantity` chuỗi decimal làm tròn lên tối đa6 chữ số, không làm giảm lượng cần mua |
| Tương tác | Checkbox Đã mua trong bộ nhớ; Sao chép danh sách qua Clipboard API hoặc ô chọn nội dung thủ công |
| Giới hạn | Không quy đổi đơn vị, không cộng optional vào required, không trừ Pantry; checkmarks đặt lại khi đổi tuần/ghi lịch/reload/đổi phiên |
| Ngoại lệ | Phiên hết hạn yêu cầu đăng nhập lại; lỗi API có retry; danh sách rỗng khi chưa có món, không dùng tổng cũ để giả thành công |
d