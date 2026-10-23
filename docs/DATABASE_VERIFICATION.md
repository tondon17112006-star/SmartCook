# Báo cáo Bước 2 — SQL Server

Ngày kiểm tra: **16/10/2026**, giờ Việt Nam. Workspace: `C:\Users\MyPC\Desktop\SmartCook`.

## Môi trường và trạng thái ban đầu

- Dịch vụ `MSSQLSERVER` đang chạy; `SQLBrowser` đang dừng. Kết nối instance mặc định không cần thay đổi các dịch vụ này.
- SQL Server **2019**, phiên bản **15.0.2000.5**, Enterprise Evaluation Edition (64-bit).
- Kết nối bằng **Windows Integrated Security**, server `lpc:localhost`, transport được truy vấn xác nhận là **Shared memory**. Không đoán SQL login/password, không tạo tài khoản hoặc `.env` thật.
- `SmartCookDB` đã tồn tại trước khi chạy script, có **0 bảng người dùng**. Giữ nguyên database và collation `SQL_Latin1_General_CP1_CI_AS`; không chạy `CREATE DATABASE` trên máy này vì không cần thiết.
- Các cột văn bản khai báo collation tường minh theo thiết kế. So sánh metadata trong guard đã dùng `COLLATE DATABASE_DEFAULT` để hỗ trợ catalog collation khác database collation.

`sqlcmd` không kết nối được vì thiếu **Microsoft ODBC Driver 17**. Lần thử .NET yêu cầu TLS báo chứng chỉ chưa được tin cậy. Không cài driver hoặc sửa chứng chỉ/cấu hình SQL Server; thay vào đó dùng kết nối shared memory cục bộ bằng tiện ích `database/Invoke-SqlScript.ps1`. `Encrypt=False` chỉ được dùng cho các tên local shared-memory cố định; tiện ích kiểm tra transport trước khi chạy SQL. Kết nối khác yêu cầu mã hóa và chứng chỉ đáng tin cậy.

## Đã thực thi thành công

```powershell
.\database\Invoke-SqlScript.ps1 -Script schema.sql
.\database\Invoke-SqlScript.ps1 -Script seed.sql
.\database\Invoke-SqlScript.ps1 -Script verify.sql
```

Các lệnh chạy trực tiếp trên SQL Server, không phải kết quả giả lập hoặc chỉ kiểm tra tĩnh. SSMS không được điều khiển trong phiên kiểm tra; script dùng T-SQL và `GO` chuẩn để có thể mở/chạy toàn bộ trong SSMS theo [hướng dẫn](../database/README.md).

### Cấu trúc thực tế

| Thành phần | Số lượng |
| --- | ---: |
| Bảng `dbo` | 10 |
| Cột | 60 |
| PRIMARY KEY | 10 |
| UNIQUE constraint | 7 |
| FOREIGN KEY | 12 |
| CHECK constraint | 32 |
| DEFAULT constraint | 8 |
| Index bổ sung | 8 |
| Tổng index kể cả PK/UNIQUE | 25 |
| FK bị tắt, chưa trusted hoặc có cascade delete | 0 |

Mọi FK đều enabled/trusted, `ON DELETE NO ACTION`, `ON UPDATE NO ACTION`. CHECK cũng enabled/trusted. `schema.sql` chạy lại đã xác nhận kiểu/cỡ/nullability/collation/identity, PK/UNIQUE, FK, DEFAULT và index tương thích với thiết kế. Guard CHECK kiểm tra tên và trạng thái, không so toàn bộ biểu thức của một CHECK đã bị sửa bên ngoài.

### Dữ liệu thực tế

| Bảng | Số dòng sau seed | Số dòng thêm khi chạy lại |
| --- | ---: | ---: |
| Categories | 8 | 0 |
| Ingredients | 64 | 0 |
| Recipes | 20 | 0 |
| RecipeIngredients | 148 | 0 |
| CookingSteps | 80 | 0 |
| Users | 0 | 0 |
| Favorites | 0 | 0 |
| Reviews | 0 | 0 |
| UserIngredients | 0 | 0 |
| SearchHistory | 0 | 0 |

- Cả 20 món đều có nguyên liệu bắt buộc, định lượng/đơn vị, thời gian chuẩn bị/nấu, độ khó và 2–4 khẩu phần gốc.
- Mỗi món có đúng **4 bước**, liên tiếp từ 1 đến 4; số món thiếu thành phần chính hoặc bước nấu: **0**.
- Đã truy vấn đầy đủ một công thức qua `Recipes` + `Categories`, danh sách `RecipeIngredients` + `Ingredients` và `CookingSteps` theo thứ tự.
- Kiểm tra riêng “Trứng xào cà chua”: đủ 3 thành phần bắt buộc **Trứng gà, Cà chua, Dầu ăn**, cùng gia vị tùy chọn.
- Ảnh giữ `NULL`; không tạo tài khoản hoặc mật khẩu mẫu.

## Kiểm tra chạy lại và tính toàn vẹn

Sau lần seed đầu, chụp SHA-256 nội dung JSON có thứ tự khóa chính của toàn bộ 10 bảng. Chạy lại `schema.sql`, sau đó `seed.sql`: số dòng thêm mới đều bằng **0**, SHA-256 mỗi bảng **không thay đổi**. Đây là kiểm tra bảo toàn toàn bộ giá trị hiện có, ngoài việc chỉ so số dòng.

Đã thực thi 9 trường hợp dữ liệu sai trên database thật; mỗi trường hợp được bọc transaction và rollback sau kiểm tra:

| Trường hợp | Kết quả |
| --- | --- |
| `Recipes.Servings = 0` | CHECK chặn, SQL error 547 |
| `Recipes.PrepTime = -1` | CHECK chặn, SQL error 547 |
| Độ khó ngoài danh sách | CHECK chặn, SQL error 547 |
| `RecipeIngredients.Quantity = 0` | CHECK chặn, SQL error 547 |
| Đơn vị chỉ có dấu cách | CHECK chặn, SQL error 547 |
| `CookingSteps.StepNumber = 0` | CHECK chặn, SQL error 547 |
| Trùng `(RecipeID, StepNumber)` | UNIQUE chặn, SQL error 2627 |
| Liên kết nguyên liệu không tồn tại | FK chặn, SQL error 547 |
| Trùng `(RecipeID, IngredientID)` | PK chặn, SQL error 2627 |

Các thử nghiệm không để lại bản ghi thử hoặc chỉnh sửa dữ liệu. Kiểm tra cuối vẫn ghi nhận 8/64/20/148/80 dòng tương ứng; `Users` vẫn bằng 0. Không thực hiện xóa database, bảng hoặc dữ liệu cũ.

## Phạm vi và phần còn lại

- Đã hoàn thành Bước 2 trên database hiện có. Nhánh tạo **database mới** được cung cấp trong script và rà soát T-SQL; không tạo thêm một database thử chỉ để kiểm tra nhánh này.
- Chưa sửa lỗi driver `sqlcmd` hoặc chứng chỉ TLS của máy. Hai vấn đề môi trường này không chặn việc thực thi đã hoàn tất qua shared memory; cần cấu hình lại nếu sau này dùng các phương thức kết nối đó.
- Chưa tạo connection pool/API nghiệp vụ, thuật toán gợi ý, đăng nhập, Admin hoặc thay đổi mã nguồn React/Express đang hoạt động. `DB_NAME` trong `.env.example` đã thống nhất thành `SmartCookDB` cho bước Backend sau.
- Ảnh món ăn, dữ liệu tài khoản và quy đổi đơn vị chưa thuộc Bước 2. FK/CHECK không tự đảm bảo mọi công thức nhập sau này có đủ số bước; ứng dụng tương lai phải kiểm tra tính đầy đủ khi lưu.
- Chưa chuyển sang Bước 3.

## File tạo hoặc cập nhật

Tạo: `database/schema.sql`, `database/seed.sql`, `database/verify.sql`, `database/Invoke-SqlScript.ps1`, `docs/DATABASE_DESIGN.md`, `docs/ERD.md`, `docs/DATABASE_VERIFICATION.md`.

Cập nhật: `database/README.md`, `README.md`, `PLAN.md`, `server/.env.example`; thêm liên kết báo cáo Bước 2 vào tài liệu khởi tạo. Không khởi tạo lại React/Node, không tạo workspace lồng nhau, không chỉnh repository cha.
