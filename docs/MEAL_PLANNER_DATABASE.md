# Thiết kế dữ liệu Meal Planner

## Phạm vi và trạng thái

Migration [001_weekly_meal_planner.sql](../database/migrations/001_weekly_meal_planner.sql) bổ sung đúng **hai bảng** vào schema nền. Không sửa `database/schema.sql` hoặc seed món, không xóa/chuyển dữ liệu `UserIngredients`, Favorites hay Reviews. Máy mới chạy **schema → migration → seed → verify** theo [hướng dẫn database](../database/README.md).

Trước migration, lần rà soát metadata ngày **27/10/2026** xác nhận đúng `SmartCookDB`, SQL Server `15.0.2000.5`, 10 bảng `dbo`, chưa có hai bảng mới. Quyền `CREATE TABLE`, `ALTER dbo` và `REFERENCES` tới Users/Recipes đã được kiểm tra. Baseline thực tế có `Users=1`, `Favorites=1`; không suy số tài khoản/dữ liệu thật từ bộ seed 0 dòng.

**Migration đã thực sự được áp dụng ngày 27/10/2026**: lần chạy thành công thứ nhất chuyển số bảng từ 10 lên 12, lần chạy thành công thứ hai giữ 12 bảng để kiểm chứng idempotent; cả hai bảng mới đều 0 dòng tại checkpoint đó. Lỗi so sánh collation trong metadata ở lần thử trước đã được sửa bằng `COLLATE DATABASE_DEFAULT`, không đổi collation hoặc dữ liệu nghiệp vụ. Lượt tiếp tục ngày 28/10 chỉ xác minh cấu trúc hiện có bằng truy vấn đọc; không chạy lại migration khi các bảng/ràng buộc đã đúng. Kết quả integrity và kiểm thử tiếp theo nằm trong [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md).

Schema SmartCook hiện có **12 bảng** và **15 FK**, tính cả hai bảng cùng ba FK mới. Nếu database có bảng ngoài dự án, số bảng `dbo` thực tế có thể lớn hơn 12; `verify.sql` trả riêng hai số này.

## MealPlans

| Cột | Kiểu | Quy tắc |
| --- | --- | --- |
| `MealPlanID` | `INT IDENTITY(1,1)` | PK `PK_MealPlans`, không NULL |
| `UserID` | `INT` | FK `FK_MealPlans_Users` → `Users.UserID`, không NULL |
| `WeekStartDate` | `DATE` | Thứ Hai, không NULL |
| `CreatedAt` | `DATETIME2(0)` | UTC, mặc định `SYSUTCDATETIME()` |
| `UpdatedAt` | `DATETIME2(0)` | UTC, mặc định `SYSUTCDATETIME()`, không nhỏ hơn `CreatedAt` |

`UQ_MealPlans_UserID_WeekStartDate (UserID, WeekStartDate)` bảo đảm một người có tối đa một lịch cho mỗi tuần. Index do UNIQUE tạo đồng thời phục vụ truy vấn lịch cá nhân. Không cần index `UserID` lặp lại cùng tiền tố.

`CK_MealPlans_WeekStartDate` dùng `DATEDIFF(DAY, DATEFROMPARTS(1,1,1), WeekStartDate) % 7 = 0`. Ngày 01/01/0001 là thứ Hai; biểu thức không phụ thuộc `SET DATEFIRST`, ngôn ngữ phiên SQL hay timezone. Tuần tối đa bắt đầu **20/12/9999**, kết thúc **26/12/9999**. Những ngày 27–31/12/9999 không tạo được một tuần đủ 7 ngày trong kiểu DATE nên không thuộc miền dữ liệu hỗ trợ. Backend phải áp dụng cùng miền ngày và kiểm tra thứ Hai trước truy vấn.

Lịch rỗng có thể tồn tại sau khi xóa món cuối cùng. GET tuần chưa tồn tại trả lịch rỗng, không chèn sẵn lịch. `UpdatedAt` không có trigger; repository cập nhật trong cùng transaction khi thay đổi item.

## MealPlanItems

| Cột | Kiểu | Quy tắc |
| --- | --- | --- |
| `MealPlanItemID` | `INT IDENTITY(1,1)` | PK `PK_MealPlanItems`, không NULL |
| `MealPlanID` | `INT` | FK `FK_MealPlanItems_MealPlans` → `MealPlans.MealPlanID` |
| `RecipeID` | `INT` | FK `FK_MealPlanItems_Recipes` → `Recipes.RecipeID` |
| `MealDate` | `DATE` | Không NULL, tối đa `9999-12-26`; phải thuộc tuần của lịch ở Backend |
| `MealType` | `NVARCHAR(20)` | Đúng `Breakfast`, `Lunch` hoặc `Dinner`, không NULL |
| `Servings` | `INT` | 1–20, không NULL; khẩu phần riêng cho lần nấu |
| `SortOrder` | `INT` | Không âm, mặc định 0; khi bằng nhau sắp tiếp theo ID |
| `CreatedAt` | `DATETIME2(0)` | UTC, mặc định `SYSUTCDATETIME()` |
| `UpdatedAt` | `DATETIME2(0)` | UTC, mặc định `SYSUTCDATETIME()`, không nhỏ hơn `CreatedAt` |

`UQ_MealPlanItems_Plan_Date_Type_Recipe (MealPlanID, MealDate, MealType, RecipeID)` chặn một công thức bị thêm hai lần vào cùng bữa/ngày/lịch, vẫn cho nhiều món trong bữa và lặp món ở bữa/ngày khác. MealType được kiểm tra bằng `Latin1_General_100_BIN2` và `DATALENGTH` nên `lunch`, `Lunch ` không hợp lệ dù collation cột là `Vietnamese_100_CI_AS`.

Các CHECK mới: `CK_MealPlanItems_MealDate`, `CK_MealPlanItems_MealType`, `CK_MealPlanItems_Servings`, `CK_MealPlanItems_SortOrder`, `CK_MealPlanItems_Timestamps`; MealPlans có `CK_MealPlans_WeekStartDate`, `CK_MealPlans_Timestamps`.

| Index | Key | INCLUDE / mục đích |
| --- | --- | --- |
| `IX_MealPlanItems_Plan_Date_Type` | `MealPlanID, MealDate, MealType, SortOrder, MealPlanItemID` | `RecipeID, Servings`; tải lịch theo thứ tự ổn định |
| `IX_MealPlanItems_RecipeID` | `RecipeID, MealPlanID` | Kiểm tra tham chiếu khi Admin xóa công thức, hỗ trợ FK |

Mỗi item chỉ lưu khóa công thức, ngày/bữa/khẩu phần/thứ tự và timestamp. Tên món, ảnh, thời gian, khẩu phần gốc, định lượng lấy từ bảng công thức hiện tại. Không có bảng Recipes thứ hai hay bản sao nguyên liệu trong lịch.

## Bất biến thuộc Backend và transaction

FK/CHECK một bảng không đối chiếu `MealDate` với ngày đầu tuần nằm ở bảng khác. Không dùng trigger/UDF hoặc CHECK không đáng tin cậy để che hạn chế đó. Backend xác định thứ Hai từ ngày lịch, tạo/tìm lịch thuộc **UserID từ session**, kiểm tra ngày thuộc tuần và ghi item trong cùng transaction.

POST/PATCH phải bảo vệ race khi hai request tạo cùng tuần; UNIQUE là hàng rào cuối cùng bên cạnh khóa transaction. Khi chuyển sang tuần khác, item phải liên kết với lịch đích của chính người dùng trong cùng transaction. UNIQUE conflict là lỗi nghiệp vụ `409`; lỗi giữa thao tác phải rollback toàn bộ. GET/UPDATE/DELETE có truy vấn giới hạn sở hữu, không tin UserID do client gửi. Không có quyền đọc chéo của Admin trong API lịch cá nhân.

`verify.sql` còn kiểm tra chéo mọi item bằng `DATEDIFF(DAY, WeekStartDate, MealDate) BETWEEN 0 AND 6`; phát hiện dữ liệu sai sẽ THROW, không sửa/xóa bản ghi. Không sửa trực tiếp bảng mới ngoài repository nếu chưa tự bảo đảm bất biến này.

## Xóa và tương thích

Cả ba FK mới đều **ON DELETE NO ACTION / ON UPDATE NO ACTION**. Xóa item không xóa Recipes, Favorites hoặc Reviews. Không xóa lịch đang có item; không xóa User/Recipe đang được tham chiếu. Admin phải trả thông báo nghiệp vụ rõ ràng khi công thức đang dùng trong lịch, FK bảo vệ khi có race. Không bật CASCADE DELETE.

`UserIngredients` và `/api/pantry` vẫn được giữ nguyên. Ẩn Pantry khỏi điều hướng không chuyển dữ liệu sang MealPlans. Shopping List lấy `RecipeIngredients.Quantity × MealPlanItems.Servings / Recipes.Servings`, không trừ Pantry; không cần thêm bảng mua hàng hoặc checkbox đã mua vào database trong phạm vi này.

## An toàn migration và kiểm tra

Xem hướng dẫn [backup COPY_ONLY, kiểm tra quyền, chạy lại và phục hồi khi bị gián đoạn](../database/README.md). Migration lấy cùng application lock với schema/seed và dùng một transaction `TRY/CATCH`, `XACT_ABORT`. Trước khi tạo và trước commit, kiểm tra metadata trên bảng mới: cột, khóa, FK NO ACTION trusted/enabled, CHECK/DEFAULT cùng biểu thức và index bắt buộc. Nếu hiện trạng không tương thích, dừng; không tự ALTER/DROP để sửa. Bảng thiếu chỉ được bổ sung khi các bảng mới đã tồn tại đều đúng hợp đồng.

Kiểm thử SQL dùng fixture trong transaction rollback hoặc database riêng. Cần xác minh PK/FK/UNIQUE/CHECK, DATEFIRST độc lập, ngày biên, rollback CRUD, quyền sở hữu, race tạo tuần và chặn xóa recipe được lịch tham chiếu. Không tạo Admin hoặc lịch mẫu cho tài khoản thật. So sánh hash/count cả 10 bảng nền trước/sau và xác nhận không còn item/lịch thử. File này mô tả thiết kế; chỉ báo cáo Passed cho kiểm tra thực sự đã chạy trong tài liệu verification.
