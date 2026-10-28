# Cơ sở dữ liệu SmartCookDB — Microsoft SQL Server

Script dùng T-SQL cho **SQL Server 2016 trở lên**; đã thực thi và kiểm tra trên SQL Server 2019 tại máy phát triển. Không cần khởi tạo lại Frontend hoặc Backend.

## Các file và thứ tự chạy

| File | Mục đích |
| --- | --- |
| `schema.sql` | Tạo database nếu chưa có, tạo 10 bảng còn thiếu, khóa, CHECK, DEFAULT và index; kiểm tra schema hiện có |
| `migrations/001_weekly_meal_planner.sql` | Bổ sung 2 bảng `MealPlans`, `MealPlanItems`, khóa và index; kiểm tra hợp đồng cấu trúc trước/sau, không sửa 10 bảng cũ |
| `seed.sql` | Bổ sung 8 danh mục, 64 nguyên liệu, 20 món, 148 thành phần và 80 bước nấu; giữ nguyên dữ liệu có sẵn |
| `verify.sql` | Chỉ đọc: yêu cầu đủ 12 bảng SmartCook sau migration, kiểm tra ràng buộc và dữ liệu lịch, liệt kê công thức |
| `Invoke-SqlScript.ps1` | Tiện ích Windows Authentication qua .NET, dùng được khi `sqlcmd` thiếu driver |

`schema.sql` được giữ nguyên làm schema nền. **Máy mới phải chạy schema → migration 001 → seed → verify**; chỉ chạy schema nền không đủ cho Meal Planner. Máy đã có dữ liệu chỉ cần backup/kiểm tra rồi chạy migration 001 và verify, không cần chạy lại seed.

Xem [thiết kế dữ liệu](../docs/DATABASE_DESIGN.md), [thiết kế Meal Planner](../docs/MEAL_PLANNER_DATABASE.md), [ERD Mermaid](../docs/ERD.md) và [báo cáo kiểm tra thực tế](../docs/DATABASE_VERIFICATION.md). Kết quả thực thi Meal Planner được ghi riêng trong `docs/MEAL_PLANNER_VERIFICATION.md`; việc tồn tại file migration không chứng minh migration đã chạy.

## Chạy bằng SQL Server Management Studio (SSMS)

1. Mở SSMS, chọn **Database Engine**. Với instance mặc định đã phát hiện trên máy hiện tại, dùng Server name `localhost`, Authentication **Windows Authentication**, rồi Connect. Không cần nhập mật khẩu SQL cho phương thức này. Nếu dùng máy/instance khác, nhập đúng tên và tài khoản được quản trị viên cung cấp.
2. Mở `database/schema.sql` bằng **File → Open → File**. Chọn đúng kết nối, chạy **toàn bộ file** bằng Execute hoặc `F5`. Không cần bật SQLCMD Mode. Script tự chuyển `master` để kiểm tra/tạo `SmartCookDB`, sau đó chuyển vào database đích để tạo bảng.
3. Sau bước backup và rà soát quyền bên dưới, mở và Execute toàn bộ `database/migrations/001_weekly_meal_planner.sql`. Với máy mới, chạy sau schema; với database đã có dữ liệu, không tạo lại schema hoặc reset database.
4. Chỉ khi schema/migration thành công và cần dữ liệu mẫu trên máy mới, mở và Execute toàn bộ `database/seed.sql`. Migration không yêu cầu seed lại dữ liệu sẵn có.
5. Mở và Execute `database/verify.sql`. Kiểm tra số lượng bản ghi, **12 bảng dự án**, PK/UNIQUE, **15 FK**, index, ngày lịch thuộc tuần, thống kê công thức và bước nấu. Script cũng trả số bảng `dbo` thực tế; database có thể có đối tượng ngoài dự án.
6. Refresh **Databases → SmartCookDB → Tables**. Sau migration, có thêm `dbo.MealPlans`, `dbo.MealPlanItems` ngoài 10 bảng nền; không có bảng Pantry nào bị xóa.

Nếu database chưa tồn tại, tài khoản cần quyền tạo database. Để tạo bảng/index và thêm seed vào database hiện có, cần quyền DDL/DML tương ứng (ví dụ tài khoản quản trị database đã được cấp sẵn). Script không tự cấp quyền, tạo login hoặc thay đổi chế độ xác thực SQL Server.

File SQL dùng UTF-8 với chuỗi Unicode `N'...'`. Nếu SSMS hiển thị tiếng Việt sai, mở lại file với encoding UTF-8 trước khi Execute. Các giá trị thời gian trong bảng lưu UTC.

## Chạy bằng PowerShell khi sqlcmd thiếu driver

Tại máy hiện tại, dịch vụ `MSSQLSERVER` đang chạy nhưng `sqlcmd` báo thiếu **Microsoft ODBC Driver 17**. Đã dùng tiện ích .NET sau để thực thi, không cài hoặc thay driver hệ thống:

```powershell
Set-Location C:\Users\MyPC\Desktop\SmartCook
.\database\Invoke-SqlScript.ps1 -Script schema.sql
.\database\Invoke-SqlScript.ps1 -Script 'migrations/001_weekly_meal_planner.sql'
.\database\Invoke-SqlScript.ps1 -Script seed.sql
.\database\Invoke-SqlScript.ps1 -Script verify.sql
```

Tiện ích dùng tài khoản Windows hiện tại, server `lpc:localhost`, transport **Shared memory** trên cùng máy. Chỉ kết nối local này dùng `Encrypt=False`, không gửi dữ liệu qua TCP và không bật `TrustServerCertificate`. Với giá trị `-Server` khác, tiện ích yêu cầu mã hóa và chứng chỉ đáng tin cậy. Không thay đổi thiết lập mã hóa/chứng chỉ trên SQL Server. Kết nối TLS thử ban đầu trên máy hiện tại báo chuỗi chứng chỉ chưa được tin cậy; nếu dùng TCP hoặc SSMS với mã hóa bắt buộc, cần cấu hình chứng chỉ tin cậy phù hợp.

Tiện ích chỉ hỗ trợ allowlist cố định `schema.sql`, `seed.sql`, `verify.sql`, `migrations/001_weekly_meal_planner.sql` và `GO` độc lập trên dòng, không phải trình chạy SQLCMD tổng quát. Không nhận đường dẫn tùy ý. Lỗi ở một batch sẽ dừng ngay và đóng kết nối. Không dùng tùy chọn bỏ qua execution policy; nếu máy chặn script, có thể chạy trực tiếp SQL bằng SSMS theo hướng dẫn trên. Với database hiện có, chỉ chạy migration rồi verify sau bước backup/rà soát, bỏ qua schema/seed.

## Backup và kiểm tra trước migration Meal Planner

Đóng các tác vụ thay đổi schema; nên chạy vào lúc ít thao tác ghi. Xác nhận đúng instance/database và quyền bằng truy vấn chỉ đọc:

```sql
USE [SmartCookDB];
SELECT DB_NAME() AS DatabaseName, SERVERPROPERTY('ServerName') AS ServerName,
       HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS CanCreateTable,
       HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER') AS CanAlterDbo,
       HAS_PERMS_BY_NAME('dbo.Users', 'OBJECT', 'REFERENCES') AS CanReferenceUsers,
       HAS_PERMS_BY_NAME('dbo.Recipes', 'OBJECT', 'REFERENCES') AS CanReferenceRecipes,
       HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'BACKUP DATABASE') AS CanBackup;
SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo') ORDER BY name;
```

Migration không tạo login hay tự cấp quyền. Nếu quyền cần thiết bằng `0`/`NULL`, dừng và nhờ người quản trị cấp đúng quyền theo chính sách. Giữ bản chụp số lượng và SHA-256 nội dung 10 bảng cũ trước/sau trong môi trường kiểm thử. Không in `PasswordHash`, email hoặc dữ liệu cá nhân vào báo cáo.

Trước khi áp dụng trên dữ liệu cần bảo toàn, người vận hành tạo backup tại **đường dẫn đã được phê duyệt trên máy SQL Server**, có quyền ghi cho dịch vụ SQL Server. Thay đường dẫn ví dụ bằng đường dẫn thật và tên file mới; không dùng `INIT` để ghi đè backup cũ:

```sql
BACKUP DATABASE [SmartCookDB]
TO DISK = N'D:\SQLBackups\SmartCookDB_before_meal_planner_YYYYMMDD_HHMMSS.bak'
WITH COPY_ONLY, CHECKSUM, STATS = 10;
RESTORE VERIFYONLY
FROM DISK = N'D:\SQLBackups\SmartCookDB_before_meal_planner_YYYYMMDD_HHMMSS.bak'
WITH CHECKSUM;
```

Đây là hướng dẫn, không phải xác nhận đã backup. `COPY_ONLY` giữ chuỗi backup thông thường; `VERIFYONLY` không khôi phục hay sửa database và không thay cho diễn tập restore trên môi trường riêng. Không tự restore đè database đang dùng. Backup chứa dữ liệu nhạy cảm, lưu ở nơi có quyền truy cập phù hợp và không đưa vào Git (`*.bak`/`*.trn` đã được ignore).

## Migration chạy lại hoặc bị gián đoạn

- Script chỉ tạo hai bảng còn thiếu và index của bảng vừa tạo. Không DML, `DROP`, `TRUNCATE`, sửa bảng cũ, seed lịch hoặc chuyển đổi `UserIngredients`.
- Một transaction chứa việc tạo bảng/index và kiểm tra lại; `XACT_ABORT` + `TRY/CATCH` rollback khi có lỗi. Dùng application lock cùng schema/seed để tránh hai script thiết lập chạy chồng nhau.
- Kiểm tra hiện trạng **trước khi tạo** và **trước commit**: cột/kiểu/độ dài/nullability/identity/collation; PK, UNIQUE, FK `NO ACTION` trusted/enabled; CHECK và DEFAULT theo biểu thức; hai index cần thiết; không có trigger/ràng buộc ngoài thiết kế trên hai bảng mới.
- Nếu ngắt kết nối trước commit, SQL Server rollback transaction của kết nối. Mở lại kết nối, kiểm tra trạng thái bảng và chạy lại toàn bộ file. Không xóa bảng để “làm sạch”.
- Nếu một lần thiết lập thủ công trước đây chỉ có `MealPlans` hợp lệ, chạy lại chỉ bổ sung `MealPlanItems`. Nếu bảng hiện có thiếu cột/khóa/index hoặc khác hợp đồng, script **dừng và giữ nguyên**, không tự sửa để ép thành công. Cần rà soát một migration riêng trước khi tiếp tục.
- Chạy lại khi cả hai bảng đúng hợp đồng không tạo bản ghi hoặc đổi dữ liệu. Không có rollback phá hủy bằng cách xóa hai bảng đã dùng. Khi cần tạm ngừng chức năng, giữ dữ liệu và tắt/khôi phục phần ứng dụng theo kế hoạch đã được duyệt.
- Sau mỗi lần thực thi, chạy `verify.sql`, kiểm tra 20 món mẫu còn nguyên và hash/count của dữ liệu cũ. Fixture CRUD phải nằm trong transaction rollback hoặc database kiểm thử riêng; không tạo lịch mẫu cho tài khoản thật.

## Giữ nguyên dữ liệu khi chạy lại

- Không có `DROP DATABASE`, `DROP TABLE`, `TRUNCATE` hoặc câu lệnh ghi đè bản ghi cũ trong schema/seed.
- `schema.sql` giữ database/collation hiện có. Database mới mặc định `Vietnamese_100_CI_AS`; các cột Unicode trong bảng chỉ định collation riêng, Email dùng collation không phân biệt hoa/thường.
- Bảng hiện có phải tương thích với cấu trúc đã thiết kế. Script dừng khi phát hiện cột, khóa hoặc index không tương thích; không tự migration. Với CHECK hiện có, guard kiểm tra tên và trạng thái enabled/trusted, không chứng minh biểu thức chưa từng bị sửa.
- `seed.sql` chỉ thêm danh mục và nguyên liệu còn thiếu theo tên. Công thức có cùng `(CategoryID, RecipeName)` được giữ nguyên, bao gồm mô tả, nguyên liệu và bước nấu. Chỉ công thức vừa thêm mới nhận dữ liệu con từ seed.
- Vì ưu tiên bảo vệ dữ liệu, chạy lại seed **không sửa công thức cũ đang thiếu thành phần/bước nấu**. Những trường hợp đó cần được xem xét riêng, không xóa rồi seed lại.
- Schema và seed dùng transaction, `XACT_ABORT`, `TRY/CATCH` và cùng application lock. Chạy từng file theo thứ tự, ngoài transaction đang mở. `CREATE DATABASE` nếu cần được thực hiện ngoài transaction tạo bảng theo yêu cầu của SQL Server.
- Kết quả lịch sử của schema/seed nền: đã chạy lại, thêm mới **0 dòng**, SHA-256 nội dung cả 10 bảng nền không thay đổi. Đây không phải kết quả kiểm thử migration Meal Planner.

## Kết quả seed nền trong lần kiểm tra lịch sử

| Bảng | Số dòng |
| --- | ---: |
| Categories | 8 |
| Ingredients | 64 |
| Recipes | 20 |
| RecipeIngredients | 148 |
| CookingSteps | 80 |
| Users / Favorites / Reviews / UserIngredients / SearchHistory | 0 mỗi bảng |

Mỗi món có **4 bước liên tiếp**, định lượng theo toàn bộ `Servings`, thời gian chuẩn bị/nấu và độ khó. Thành phần chính hoặc cần thiết được đánh dấu `IsRequired=1`, gia vị/trang trí tùy chọn là `0`; không mặc định coi gia vị là đã có. Ảnh để `NULL`, không dùng đường dẫn ảnh giả. Không seed tài khoản hoặc mật khẩu dùng chung.

Bảng trên mô tả bộ seed và lần xác minh nền trước đây, **không phải snapshot dữ liệu người dùng hiện tại**. Các tài khoản/yêu thích đã được người dùng tạo phải giữ nguyên. Trước migration Meal Planner ngày 27/10/2026, baseline thực tế ghi nhận `Users=1`, `Favorites=1`; không reset về 0. Snapshot đầy đủ và so sánh hash chỉ được ghi bằng số lượng/hash, không kèm dữ liệu cá nhân, trong tài liệu verification tương ứng.

## Biến môi trường Backend

`server/.env.example` đã thống nhất `DB_NAME=SmartCookDB`. Bước 3 đã thêm connection pool Windows Authentication bằng `mssql/msnodesqlv8`; không cần `DB_USER`/`DB_PASSWORD`. Chỉ sao chép mẫu thành `server/.env` nếu chưa có file; không ghi đè cấu hình cá nhân. Chi tiết kết nối local và giới hạn production xem [README gốc](../README.md) và [báo cáo Backend](../docs/BACKEND_VERIFICATION.md).

Các script SSMS/PowerShell **không đọc `.env`**, không cần JWT secret. `/api/health` vẫn hoạt động độc lập với database; các API dữ liệu và `/api/health/db` dùng connection pool. File `.env`, dữ liệu `.mdf`/`.ldf` và backup `.bak`/`.trn` vẫn bị Git bỏ qua.
