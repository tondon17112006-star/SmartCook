# Kiểm chứng Meal Planner và Shopping List

Ngày kiểm chứng: **28/10/2026**. Workspace `C:\Users\MyPC\Desktop\SmartCook`, nhánh `feature/weekly-meal-planner`. Đây là lượt tiếp tục từ checkpoint; không khởi tạo lại, đổi nhánh, commit hoặc push.

## Checkpoint và phạm vi

- MP-01/MP-02 đã hoàn thành trước lượt này. Migration `001_weekly_meal_planner.sql` đã áp dụng ngày 27/10/2026; **không chạy lại** trong lượt kiểm chứng này.
- Source Backend, lịch tuần, Shopping List, tích hợp RecipeDetail/Cooking Mode và các test mới đã tồn tại. Lượt này kiểm tra và sửa phần còn dở, chạy hồi quy và hoàn thiện tài liệu.
- SmartCookDB có 12 bảng, bao gồm `MealPlans` và `MealPlanItems`. Baseline có 20 Recipes, 1 Users, 1 Favorites và 0 UserIngredients; không coi toàn bộ dữ liệu cá nhân là rỗng.
- Không thay `.env`, JWT/HMAC secret, seed, dữ liệu món ăn hoặc tạo/nâng quyền Admin thật. Tài khoản SQL trong fixture đều có Role User; vai trò Admin thử nghiệm chỉ được chiếu trên DTO trong tiến trình test.

## Kết quả hiện tại

| Kiểm tra | Kết quả xác minh lượt này |
| --- | --- |
| Frontend lint | **Đạt**, exit 0, không có lỗi |
| Frontend build | **Đạt**, Vite 8.3.4; entry 463.05 kB, gzip 133.82 kB |
| Frontend unit/DOM | **212 đạt, 0 thất bại, 0 bỏ qua**, gồm 24 bài Meal Planner |
| Frontend integration | **14 đạt, 0 thất bại, 0 bỏ qua**; gồm App → Axios → Express → SQL thật, 27.59 giây |
| Backend unit/HTTP | **190 đạt, 0 thất bại, 0 bỏ qua** |
| Backend integration, gồm Meal Planner SQL | **215 đạt, 0 thất bại, 0 bỏ qua**, 23.04 giây; gồm 18 bài Meal Planner và 8 bài integrity |
| SQL integrity và so sánh hash sau test | **Đạt**; 12 bảng/15 FK, 20 Recipes; hash/count/cột của 10 bảng cũ khớp baseline |
| `npm run check:db` | **Đạt**; SmartCookDB, 20 recipes, Shared memory, encrypted TRUE |
| Browser mới ở 375/768/1024/1440px | **Not Tested**; Computer Use dừng khi không xác định được URL Chrome để thực thi policy |

Tổng **631 bài đạt, 0 thất bại, 0 cancelled, 0 bỏ qua** ở các bộ chạy cuối. 18 bài Meal Planner SQL và 8 bài integrity là tập con của 215, không cộng thêm vào tổng. 24 bài Meal Planner unit/DOM là tập con của 212; 29 bài Meal Planner unit/HTTP là tập con của 190. Không dùng kết quả lịch sử Bước 11/12 để đánh dấu Passed cho chức năng mới.

| Giai đoạn | Trạng thái cuối |
| --- | --- |
| MP-04 | Hoàn thành chức năng lịch tuần và kiểm thử tự động; responsive trực quan còn checklist bên dưới |
| MP-05 | Hoàn thành Shopping List Backend/Frontend và đối chiếu số lượng SQL thật |
| MP-06 | Hoàn thành Navbar, redirect/legacy Pantry, RecipeDetail/Favorites picker/Cooking Mode và hồi quy |
| MP-07 | Hoàn tất hồi quy tự động, SQL integrity/hash và tài liệu; nghiệm thu browser và stress nhiều kết nối chưa thực hiện |

Chưa phát hiện lỗi chức năng còn gây thất bại trong các bộ chạy cuối. Việc chưa kiểm thử trực quan không được suy ra là Passed từ DOM test.

## Dữ liệu sau toàn bộ kiểm thử

Đã chạy lại `node .cache/meal-planner-verify.mjs after` sau khi fixture của cả hai ứng dụng đóng. Script so với `.cache/meal-planner-before.json` đã có, không ghi đè baseline. Dữ liệu từng bảng được sắp theo khóa rồi SHA-256 toàn bộ JSON (gồm NULL); kiểm tra thêm hash metadata cột của 10 bảng cũ.

| Bảng | Số dòng trước → sau |
| --- | --- |
| Users | 1 → 1 |
| Categories | 8 → 8 |
| Ingredients | 64 → 64 |
| Recipes | 20 → 20 |
| RecipeIngredients | 148 → 148 |
| CookingSteps | 80 → 80 |
| Favorites | 1 → 1 |
| Reviews | 0 → 0 |
| UserIngredients | 0 → 0 |
| SearchHistory | 0 → 0 |
| MealPlans | 0 sau migration → 0 sau test |
| MealPlanItems | 0 sau migration → 0 sau test |

Tất cả hash/count cũ khớp. Hash `server/.env`, `client/.env`, `database/schema.sql`, `database/seed.sql`, cấu hình/password/session/auth security, Suggestions matcher/service, Pantry repository/service/routes và `MyPantry.jsx` đều giữ nguyên. Không có tài khoản, recipe, category, ingredient, review hoặc lịch fixture còn lại; không tạo/nâng quyền Admin thật. Migration không chạy lại ở lượt này.

Log cục bộ nằm trong `.cache` bị Git bỏ qua: `mp-client-lint.log`, `mp-client-build.log`, `mp-client-unit.log`, `mp-client-integration-final.log`, `mp-server-unit-final.log`, `mp-server-integration-final.log`, `mp-server-db-final.log`. Kết quả snapshot cục bộ tại `meal-planner-after.json`; không đưa nội dung dữ liệu cá nhân hoặc env lên Git. Môi trường đã chạy: Node.js 26.6.0, npm 11.18.0.

## Sửa lỗi và các tệp liên quan

Lỗi còn dở đã xác nhận và sửa: nút **Tuần này** trước đây lấy ngày được state cập nhật mỗi 30 giây, nên có thể về tuần trước ngay sau nửa đêm Việt Nam vào thứ Hai. Handler hiện tính lại `todayInVietnam()` ngay khi bấm; DOM test mô phỏng ranh giới nửa đêm đã đạt. Không thay đổi lịch hoặc timezone trong database.

Luồng SQL UI được mở rộng để thực hiện đăng nhập, bữa sáng, hai món trong bữa trưa, lỗi trùng 409, sửa/ngày/bữa/chuyển tuần, xóa có xác nhận, reload, logout, Pantry tương thích và Cooking Mode. Đã sửa assertion mới dùng sai chuỗi lỗi của API. Một assertion polling so sánh trực tiếp HTMLElement với `null` khiến Node tốn thời gian in cây DOM/React khi dialog đang đóng; đổi sang so sánh `Boolean(dialog())`, giữ nguyên các assertion nội dung và SQL. Test cũng chờ xác thực xong trước thao tác trên RecipeDetail. Không xóa test hoặc tăng timeout để che lỗi.

Lần chạy toàn bộ Frontend integration đầu có 13 đạt/1 thất bại: test Personal vẫn còn hai đoạn yêu cầu Navbar `/pantry` và trang Pantry cũ. Lỗi `EREQINPROG` ở cleanup che assertion lỗi này khi HTTP bị hủy. Đã cập nhật ba lần mount cùng hai đoạn điều hướng sang `/legacy-pantry`, kiểm tra Navbar mới và giữ ngữ cảnh khẩu phần trong App. Toàn bộ assertion Pantry CRUD, expiry, ownership, API, Favorites, Reviews và Suggestions cũ được giữ. Bài Personal chạy riêng lại đạt 1/1; không cần sửa production hoặc fixture để khắc phục kỳ vọng cũ. Kết quả suite đầy đủ cuối nằm ở bảng trên.

Các tệp của chức năng đã có từ checkpoint và được rà soát/hoàn thiện trong đợt thay đổi:

| Nhóm | Tệp |
| --- | --- |
| Frontend mới | `client/src/pages/MealPlanner.jsx`; `components/meal-planner/{AddMealDialog,EditMealDialog,MealFields,WeeklyCalendar,ShoppingList}.jsx`; `components/meal-planner/useMealMutation.js`; `services/mealPlannerService.js`; `utilities/{mealPlanner,mealPlannerDates}.js` |
| Frontend nối vào ứng dụng | `client/src/App.jsx`, `components/Navbar.jsx`, `context/AuthProvider.jsx`, `pages/RecipeDetailPage.jsx` |
| Frontend test | `client/tests/meal-planner.test.js`, `meal-planner-dates.test.js`, `integration/meal-planner.integration.test.js`, `integration/personal.integration.test.js` |
| Backend mới | `server/src/routes/meal-plan.routes.js`, `controllers/meal-plan.controller.js`, `services/{meal-plan.repository,meal-plan.service,shopping-list.service}.js`, `utilities/meal-plan-validation.js` |
| Backend nối vào ứng dụng | `server/src/app.js`, `services/admin.repository.js`, `server/package.json` |
| Backend test | `server/tests/meal-plan.unit.test.js`, `meal-plan.integration.test.js`, `helpers/meal-plan-fixture.js`, `database-integrity.integration.test.js` |
| Database đã có từ MP-02 | `database/migrations/001_weekly_meal_planner.sql`, `verify.sql`, `Invoke-SqlScript.ps1`, `README.md`; không sửa `schema.sql` hoặc `seed.sql` |
| Tài liệu | `README.md`, `PLAN.md`, `docs/API.md`, `DATABASE_DESIGN.md`, `MEAL_PLANNER.md`, `SHOPPING_LIST.md`, `MEAL_PLANNER_DATABASE.md`, báo cáo này và các hướng dẫn cài đặt/demo/tổng quan có liên quan |

`runMealPlanTransaction` có seam dependency injection để unit test xác minh SERIALIZABLE, commit/rollback và retry lỗi deadlock 1205; mặc định runtime vẫn dùng pool/transaction SQL thật. Tên một bài SQL được chỉnh để mô tả đúng JWT hết hạn + logout revocation, không nhận vơ kiểm tra xóa tài khoản trong bài đó.

Working tree còn cả tài liệu Bước 11/12 có sẵn từ trước; danh sách Git thay đổi không đồng nghĩa mọi tệp đều vừa được tạo ở lượt cuối. Không stage/commit `.env`, secret, `.cache`, log hoặc dữ liệu cá nhân.

## Hợp đồng và các kiểm tra chức năng

API yêu cầu phiên đăng nhập, lấy UserID từ phiên và SQL Server, không nhận UserID từ client:

| API | Hành vi |
| --- | --- |
| `GET /api/meal-plans?weekStart=YYYY-MM-DD` | Đọc 7 ngày từ thứ Hai; GET tuần rỗng không tạo bản ghi |
| `GET /api/meal-plans/shopping-list?weekStart=YYYY-MM-DD` | Đọc và tổng hợp nguyên liệu bắt buộc của tuần |
| `POST /api/meal-plans/items` | Thêm món với ngày, bữa và khẩu phần 1–20 |
| `PATCH /api/meal-plans/items/:id` | Sửa khẩu phần/ngày/bữa/thứ tự, gồm chuyển tuần trong transaction |
| `DELETE /api/meal-plans/items/:id` | Xóa mục lịch của chính người dùng, body JSON `{}` |

JWT HttpOnly Cookie, CSRF và Origin checking dùng nguyên cơ chế hiện có. Request thay đổi dữ liệu phải có JSON, CSRF token và Origin hợp lệ. Owner khác trả 404; dữ liệu không hợp lệ 400; trùng công thức trong cùng ngày/bữa 409. Admin không được xóa recipe đang được lịch tham chiếu; không có cascade xóa lịch.

Shopping List tính `Quantity × plannedServings / originalServings`, cộng theo **IngredientID + chuỗi Unit chính xác**. SQL DECIMAL được đọc thành chuỗi, tính bằng phân số BigInt và chỉ làm tròn lên một lần ở tổng cuối đến 6 chữ số thập phân. Kết quả quantity là chuỗi; không quy đổi đơn vị, cộng g với kg, tính nguyên liệu tùy chọn hoặc trừ Pantry. Checkbox “Đã mua” chỉ nằm trong bộ nhớ trang và đặt lại khi đổi tuần/cập nhật lịch/tải lại/đổi phiên.

Các bài SQL dùng dữ liệu thật trong outer transaction rollback, gồm quyền sở hữu, nhiều món mỗi bữa, chuyển tuần, rollback lỗi thêm/sửa, trùng, input, CSRF/Origin/JWT, tổng Shopping List và chặn xóa recipe. React integration dùng App/Axios/Express/SQL thật; cookie jar của transport test không chứng minh chính sách cookie của Chrome.

## Routing và bảo toàn Pantry

- Navbar chính: **Lịch nấu ăn** → `/meal-planner`.
- `/meal-planner` có ProtectedRoute; Guest về Login trước khi tải dữ liệu riêng.
- `/pantry` có guard rồi redirect `replace` sang `/meal-planner`.
- `/legacy-pantry` giữ giao diện Pantry cũ. Bảng `UserIngredients`, API `/api/pantry` và dữ liệu cũ được giữ nguyên; test Pantry cũ tiếp tục kiểm tra CRUD/API trên route tương thích.
- Chọn từ tất cả công thức hoặc tab Món yêu thích trong dialog. RecipeDetail có nút thêm vào lịch. Liên kết lịch sang chi tiết/Cooking Mode mang khẩu phần đã lên kế hoạch; không sửa định lượng gốc.

## Giới hạn và checklist trình duyệt

Computer Use nhận ra ứng dụng Chrome nhưng không có browser provider; khi chọn cửa sổ trả về, công cụ dừng vì không xác định được URL hiện tại đủ tin cậy. Không có thao tác giao diện hoặc ảnh chụp mới được thực hiện. **DOM/HTTP/SQL không xác nhận bố cục, responsive, clipboard permission hoặc cookie policy của browser thật.** Bằng chứng browser smoke Bước 11 chỉ áp dụng các trang cũ đã ghi ở báo cáo đó.

Khi mở trình duyệt thủ công, kiểm tra lần lượt **375, 768, 1024, 1440px**:

- [ ] Navbar desktop/mobile có Lịch nấu ăn, link đúng, Guest chuyển Login.
- [ ] Tuần có thứ Hai–Chủ nhật, mỗi ngày Sáng/Trưa/Tối; tuần giao tháng/năm đúng, không tràn ngang.
- [ ] Thêm món bằng tìm kiếm/danh mục hoặc Favorites; một bữa có hai món; khẩu phần 1 và 20 hợp lệ.
- [ ] Sửa khẩu phần, ngày, bữa, chuyển tuần; xóa có xác nhận; reload vẫn thấy dữ liệu SQL đúng.
- [ ] Dialog không tràn màn hình, cuộn được, focus và phím Escape/Tab hoạt động, trạng thái pending không gửi trùng.
- [ ] API lỗi không hiện thành công; draft còn để thử lại; trạng thái rỗng/tải/lỗi rõ ràng.
- [ ] Shopping List đổi đúng theo thêm/sửa/xóa/tuần; Đã mua và sao chép có phản hồi thật/fallback.
- [ ] Mở công thức/Cooking Mode đúng khẩu phần; `/ingredients`, `/suggestions` và `/legacy-pantry` còn hoạt động.
- [ ] Logout không còn dữ liệu lịch riêng; phiên hết hạn quay về Login.

Test concurrent HTTP hiện chạy qua fixture một kết nối được tuần tự hóa theo toàn mutation callback. Đã kiểm tra logic khóa/transaction/retry trong unit và SQL fixture, nhưng **chưa stress test race bằng nhiều kết nối SQL độc lập**, chưa kiểm tra production HTTPS/multi-instance hoặc tải lớn. Những giới hạn này không được đánh dấu Passed.

## Cách chạy kiểm tra

Trong `server`: `npm test`, `npm run test:integration`, `npm run check:db`. Trong `client`: `npm run lint`, `npm test`, `npm run build`, `npm run test:integration`. Chạy các SQL suite lần lượt; frontend public integration cần Backend đang chạy tại `http://127.0.0.1:5000`. Không cần chạy lại migration hoặc setup auth trên máy đã cấu hình.

Mở hai terminal, chạy `npm run dev` trong `server` và `client`, truy cập `http://127.0.0.1:5173`, đăng nhập User hợp lệ rồi mở `/meal-planner`. Xem [hướng dẫn lịch](MEAL_PLANNER.md), [Shopping List](SHOPPING_LIST.md), [database](MEAL_PLANNER_DATABASE.md) và [API](API.md).
