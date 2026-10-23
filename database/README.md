# Cơ sở dữ liệu SmartCookDB — Microsoft SQL Server

Script dùng T-SQL cho **SQL Server 2016 trở lên**; đã thực thi và kiểm tra trên SQL Server 2019 tại máy phát triển. Không cần khởi tạo lại Frontend hoặc Backend.

## Các file và thứ tự chạy

| File | Mục đích |
| --- | --- |
| `schema.sql` | Tạo database nếu chưa có, tạo 10 bảng còn thiếu, khóa, CHECK, DEFAULT và index; kiểm tra schema hiện có |
| `seed.sql` | Bổ sung 8 danh mục, 64 nguyên liệu, 20 món, 148 thành phần và 80 bước nấu; giữ nguyên dữ liệu có sẵn |
| `verify.sql` | Chỉ đọc: đếm dữ liệu, kiểm tra trạng thái ràng buộc, liệt kê công thức và truy vấn đầy đủ một món |
| `Invoke-SqlScript.ps1` | Tiện ích Windows Authentication qua .NET, dùng được khi `sqlcmd` thiếu driver |

Xem [thiết kế dữ liệu](../docs/DATABASE_DESIGN.md), [ERD Mermaid](../docs/ERD.md) và [báo cáo kiểm tra thực tế](../docs/DATABASE_VERIFICATION.md).

## Chạy bằng SQL Server Management Studio (SSMS)

1. Mở SSMS, chọn **Database Engine**. Với instance mặc định đã phát hiện trên máy hiện tại, dùng Server name `localhost`, Authentication **Windows Authentication**, rồi Connect. Không cần nhập mật khẩu SQL cho phương thức này. Nếu dùng máy/instance khác, nhập đúng tên và tài khoản được quản trị viên cung cấp.
2. Mở `database/schema.sql` bằng **File → Open → File**. Chọn đúng kết nối, chạy **toàn bộ file** bằng Execute hoặc `F5`. Không cần bật SQLCMD Mode. Script tự chuyển `master` để kiểm tra/tạo `SmartCookDB`, sau đó chuyển vào database đích để tạo bảng.
3. Chỉ khi schema chạy thành công, mở và Execute toàn bộ `database/seed.sql`.
4. Mở và Execute `database/verify.sql`. Kiểm tra các tập kết quả: số lượng dữ liệu, PK/UNIQUE, 12 FK, thống kê từng món, nguyên liệu và các bước nấu.
5. Refresh **Databases → SmartCookDB → Tables** trong Object Explorer để thấy 10 bảng `dbo`.

Nếu database chưa tồn tại, tài khoản cần quyền tạo database. Để tạo bảng/index và thêm seed vào database hiện có, cần quyền DDL/DML tương ứng (ví dụ tài khoản quản trị database đã được cấp sẵn). Script không tự cấp quyền, tạo login hoặc thay đổi chế độ xác thực SQL Server.

File SQL dùng UTF-8 với chuỗi Unicode `N'...'`. Nếu SSMS hiển thị tiếng Việt sai, mở lại file với encoding UTF-8 trước khi Execute. Các giá trị thời gian trong bảng lưu UTC.

## Chạy bằng PowerShell khi sqlcmd thiếu driver

Tại máy hiện tại, dịch vụ `MSSQLSERVER` đang chạy nhưng `sqlcmd` báo thiếu **Microsoft ODBC Driver 17**. Đã dùng tiện ích .NET sau để thực thi, không cài hoặc thay driver hệ thống:

```powershell
Set-Location C:\Users\MyPC\Desktop\SmartCook
.\database\Invoke-SqlScript.ps1 -Script schema.sql
.\database\Invoke-SqlScript.ps1 -Script seed.sql
.\database\Invoke-SqlScript.ps1 -Script verify.sql
```

Tiện ích dùng tài khoản Windows hiện tại, server `lpc:localhost`, transport **Shared memory** trên cùng máy. Chỉ kết nối local này dùng `Encrypt=False`, không gửi dữ liệu qua TCP và không bật `TrustServerCertificate`. Với giá trị `-Server` khác, tiện ích yêu cầu mã hóa và chứng chỉ đáng tin cậy. Không thay đổi thiết lập mã hóa/chứng chỉ trên SQL Server. Kết nối TLS thử ban đầu trên máy hiện tại báo chuỗi chứng chỉ chưa được tin cậy; nếu dùng TCP hoặc SSMS với mã hóa bắt buộc, cần cấu hình chứng chỉ tin cậy phù hợp.

Tiện ích chỉ hỗ trợ ba script dự án và `GO` độc lập trên dòng, không phải trình chạy SQLCMD tổng quát. Lỗi ở một batch sẽ dừng ngay và đóng kết nối. Không dùng tùy chọn bỏ qua execution policy; nếu máy chặn script, có thể chạy trực tiếp SQL bằng SSMS theo hướng dẫn trên.

## Giữ nguyên dữ liệu khi chạy lại

- Không có `DROP DATABASE`, `DROP TABLE`, `TRUNCATE` hoặc câu lệnh ghi đè bản ghi cũ trong schema/seed.
- `schema.sql` giữ database/collation hiện có. Database mới mặc định `Vietnamese_100_CI_AS`; các cột Unicode trong bảng chỉ định collation riêng, Email dùng collation không phân biệt hoa/thường.
- Bảng hiện có phải tương thích với cấu trúc đã thiết kế. Script dừng khi phát hiện cột, khóa hoặc index không tương thích; không tự migration. Với CHECK hiện có, guard kiểm tra tên và trạng thái enabled/trusted, không chứng minh biểu thức chưa từng bị sửa.
- `seed.sql` chỉ thêm danh mục và nguyên liệu còn thiếu theo tên. Công thức có cùng `(CategoryID, RecipeName)` được giữ nguyên, bao gồm mô tả, nguyên liệu và bước nấu. Chỉ công thức vừa thêm mới nhận dữ liệu con từ seed.
- Vì ưu tiên bảo vệ dữ liệu, chạy lại seed **không sửa công thức cũ đang thiếu thành phần/bước nấu**. Những trường hợp đó cần được xem xét riêng, không xóa rồi seed lại.
- Schema và seed dùng transaction, `XACT_ABORT`, `TRY/CATCH` và cùng application lock. Chạy từng file theo thứ tự, ngoài transaction đang mở. `CREATE DATABASE` nếu cần được thực hiện ngoài transaction tạo bảng theo yêu cầu của SQL Server.
- Đã chạy lại cả schema và seed: thêm mới **0 dòng**, SHA-256 nội dung cả 10 bảng không thay đổi.

## Kết quả seed trên database đã kiểm tra

| Bảng | Số dòng |
| --- | ---: |
| Categories | 8 |
| Ingredients | 64 |
| Recipes | 20 |
| RecipeIngredients | 148 |
| CookingSteps | 80 |
| Users / Favorites / Reviews / UserIngredients / SearchHistory | 0 mỗi bảng |

Mỗi món có **4 bước liên tiếp**, định lượng theo toàn bộ `Servings`, thời gian chuẩn bị/nấu và độ khó. Thành phần chính hoặc cần thiết được đánh dấu `IsRequired=1`, gia vị/trang trí tùy chọn là `0`; không mặc định coi gia vị là đã có. Ảnh để `NULL`, không dùng đường dẫn ảnh giả. Không seed tài khoản hoặc mật khẩu dùng chung.

## Biến môi trường Backend

`server/.env.example` đã thống nhất `DB_NAME=SmartCookDB`. Bước 3 đã thêm connection pool Windows Authentication bằng `mssql/msnodesqlv8`; không cần `DB_USER`/`DB_PASSWORD`. Chỉ sao chép mẫu thành `server/.env` nếu chưa có file; không ghi đè cấu hình cá nhân. Chi tiết kết nối local và giới hạn production xem [README gốc](../README.md) và [báo cáo Backend](../docs/BACKEND_VERIFICATION.md).

Các script SSMS/PowerShell **không đọc `.env`**, không cần JWT secret. `/api/health` vẫn hoạt động độc lập với database; các API dữ liệu và `/api/health/db` dùng connection pool. File `.env`, dữ liệu `.mdf`/`.ldf` và backup `.bak`/`.trn` vẫn bị Git bỏ qua.
