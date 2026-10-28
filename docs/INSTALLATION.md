# Cài đặt SmartCook trên máy phát triển

Tài liệu này dùng cho máy Windows mới. Không sao chép file .env, cookie hoặc secret thật từ máy đang phát triển.

**Workspace hiện tại đã có migration 001 từ ngày 27/10/2026 và đủ 12 bảng.** Nếu tiếp tục trên máy này, giữ nguyên database/cấu hình và bỏ qua bước tạo schema/migration/seed bên dưới; chỉ dùng health, `check:db` hoặc verify để xác minh. Trình tự cài mới trong mục 3 dành cho môi trường chưa được thiết lập.

## 1. Điều kiện trước

- Git.
- Node.js thỏa server engines: 22.12 trở lên. Node 26.6.0 là phiên bản đã dùng khi kiểm chứng.
- SQL Server 2019 (SQL Server 2016+ được schema hỗ trợ) và SQL Server Management Studio.
- ODBC driver x64 hỗ trợ Windows Authentication. Kiểm tra driver phù hợp với giá trị DB_DRIVER trước khi chạy Node.
- Tài khoản Windows chạy Node phải có quyền cần thiết trên SmartCookDB.

## 2. Clone và chuẩn bị dependency

Mở PowerShell:

~~~powershell
git clone https://github.com/tondon17112006-star/SmartCook.git
Set-Location .\SmartCook

Set-Location .\client
npm ci

Set-Location ..\server
npm ci
~~~

Không có package.json ở thư mục gốc; luôn chạy npm trong client hoặc server. Có thể dùng npm install khi chủ động thay đổi dependency, nhưng npm ci là lựa chọn tái lập theo package-lock.json.

## 3. Tạo và kiểm tra database bằng SSMS

1. Mở SQL Server Management Studio và kết nối bằng Windows Authentication tới SQL Server instance của máy.
2. Mở một cửa sổ query mới, rồi chạy theo thứ tự:

~~~sql
-- Mở và Execute từng file theo thứ tự, không dán secret vào script.
-- 1. database/schema.sql
-- 2. database/migrations/001_weekly_meal_planner.sql
-- 3. database/seed.sql
-- 4. database/verify.sql
~~~

3. Schema tự tạo SmartCookDB nếu database chưa tồn tại. Nếu database đã tồn tại, script kiểm tra hợp đồng metadata và dừng khi không tương thích thay vì tự migration hoặc xóa dữ liệu.
4. Seed thêm dữ liệu chưa có theo khóa tự nhiên. Không sử dụng seed để sửa một công thức đã có.
5. Migration 001 bổ sung `MealPlans` và `MealPlanItems`, không sửa/xóa bảng cũ hoặc chuyển dữ liệu Pantry. Schema nền vẫn gồm 10 bảng; máy mới phải chạy thêm migration để có đủ **12 bảng**. Migration có transaction, kiểm tra hợp đồng trước/sau và chạy lại an toàn khi cấu trúc đúng. Nếu đang dùng database đã có hai bảng hợp lệ, chỉ xác minh metadata/verify; không cần áp dụng lại migration.
6. Verify chỉ đọc dữ liệu/cấu trúc. Kết quả bình thường cho bộ seed mới là 8 Categories, 64 Ingredients, 20 Recipes, 148 RecipeIngredients và 80 CookingSteps; MealPlans/MealPlanItems rỗng vì không seed lịch. Số Users/Favorites/Pantry trên database có sẵn phụ thuộc dữ liệu của chủ dự án, không được xóa để khớp số seed.

Xem [database/README.md](../database/README.md) để biết thêm giới hạn SQL và cách dùng Invoke-SqlScript.ps1. Không chạy DROP, TRUNCATE hoặc reset database để xử lý lỗi cài đặt.

Trước khi áp dụng vào database chưa có Meal Planner, thực hiện sao lưu theo hướng dẫn COPY_ONLY trong tài liệu database và kiểm tra quyền CREATE TABLE, ALTER dbo, REFERENCES Users/Recipes. Nếu metadata xung đột hoặc migration bị gián đoạn, giữ nguyên dữ liệu, kiểm tra trạng thái và hợp đồng bảng mới; không DROP bảng để chạy lại. Chi tiết tại [MEAL_PLANNER_DATABASE.md](MEAL_PLANNER_DATABASE.md).

## 4. Tạo cấu hình local

Từ thư mục gốc dự án:

~~~powershell
if (-not (Test-Path -LiteralPath .\client\.env)) {
  Copy-Item .\client\.env.example .\client\.env
}
if (-not (Test-Path -LiteralPath .\server\.env)) {
  Copy-Item .\server\.env.example .\server\.env
}
~~~

Chỉ sao chép khi file chưa tồn tại để không ghi đè cấu hình cá nhân.

Trong server/.env, cấu hình SQL theo chính máy:

- DB_AUTH=windows để dùng Windows Authentication.
- DB_SERVER chọn server/instance hợp lệ; lpc:localhost trong example chỉ là cấu hình local, không phải tên instance bắt buộc.
- DB_PORT để trống với shared memory; dùng host/port thực tế khi kết nối TCP.
- DB_DRIVER phải khớp driver ODBC đã cài.
- DB_NAME=SmartCookDB nếu dùng database chuẩn.
- CLIENT_ORIGIN phải đúng URL frontend local.

Tạo hai khóa xác thực cục bộ:

~~~powershell
Set-Location .\server
npm run setup:auth
~~~

Lệnh chỉ tạo JWT_SECRET và PASSWORD_PEPPER nếu thiếu/placeholder, không in secret. Giữ PASSWORD_PEPPER ổn định; thay hoặc mất pepper làm mật khẩu cũ không xác thực được. Không đưa server/.env vào Git.

## 5. Chạy ứng dụng

Dùng hai cửa sổ PowerShell.

~~~powershell
# Cửa sổ 1: backend
Set-Location C:\duong-dan\SmartCook\server
npm run dev
~~~

~~~powershell
# Cửa sổ 2: frontend
Set-Location C:\duong-dan\SmartCook\client
npm run dev
~~~

Mở http://127.0.0.1:5173. Backend mặc định ở http://127.0.0.1:5000.

## 6. Health check

~~~powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
Invoke-RestMethod http://127.0.0.1:5000/api/health/db

Set-Location C:\duong-dan\SmartCook\server
npm run check:db
~~~

Health trả trạng thái của process Express và không xác nhận SQL. Chỉ health/db hoặc check:db mới mở connection tới SQL Server.

## 7. Kiểm thử sau cài đặt

~~~powershell
# client
Set-Location C:\duong-dan\SmartCook\client
npm run lint
npm run build
npm test
npm run test:integration

# server
Set-Location C:\duong-dan\SmartCook\server
npm test
npm run test:integration
npm run check:db
~~~

Các integration test dùng SQL Server và fixture rollback; không chạy chúng nếu SmartCookDB chứa dữ liệu mà bạn không được phép để test. Chạy suite client/server lần lượt, với Backend local chạy cho các bài frontend public. Đọc [TEST_SUMMARY.md](TEST_SUMMARY.md) cho kết quả bàn giao lịch sử và [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md) cho thay đổi Meal Planner trước khi kết luận phạm vi đã được nghiệm thu.

## 8. Sự cố thường gặp

| Vấn đề | Hướng xử lý |
| --- | --- |
| Cannot connect SQL Server | Xác nhận SQL service/instance, Windows account, DB_SERVER, DB_PORT, DB_DRIVER và DB_ENCRYPT; chạy npm run check:db để nhận thông báo an toàn. |
| Auth 503 | Chạy npm run setup:auth trong server sau khi tạo .env; kiểm tra hai khóa khác nhau và không còn placeholder. |
| 403 Origin/CSRF | Dùng đúng URL trong CLIENT_ORIGIN, gọi GET /api/auth/csrf trước mutation, gửi Content-Type application/json và X-CSRF-Token. |
| Cookie không hoạt động ở production | Cần HTTPS thật, origin HTTPS chính xác và AUTH_COOKIE_SECURE=true. HTTP local không xác minh hành vi cookie production. |
| Dependency lỗi | Dùng Node đúng engines và npm ci. Không dùng npm audit fix --force hoặc nâng major version chỉ để làm audit xanh. |

## 9. Production và Admin

Tài liệu này chỉ hướng dẫn môi trường phát triển. Trước production cần HTTPS, TLS/ODBC phù hợp, secret manager, sao lưu/khôi phục, logging/monitoring và session store dùng chung cho nhiều instance.

Không có Admin mặc định. Khi có ủy quyền rõ ràng, xem [AUTHORIZATION.md](AUTHORIZATION.md) để dùng công cụ cấp quyền có xác nhận; không dùng account thường để giả lập quyền Admin.
d