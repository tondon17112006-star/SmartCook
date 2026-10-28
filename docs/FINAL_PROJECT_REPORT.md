# Báo cáo hoàn thành dự án SmartCook

## 1. Tên đề tài

SmartCook – website gợi ý món ăn từ nguyên liệu sẵn có.

## 2. Mục tiêu và phạm vi

SmartCook cho phép khám phá công thức, gợi ý món theo nguyên liệu, hướng dẫn Cooking Mode, dữ liệu cá nhân và quản trị catalog/cộng đồng. Sau bàn giao Bước 12, thay đổi lịch nấu ăn 7 ngày và danh sách đi chợ đã hoàn thành chức năng, tích hợp và kiểm thử tự động ngày 28/10/2026. Phạm vi gồm frontend React, Express API và SQL Server SmartCookDB; không bao gồm production deployment. Kết quả Bước 12 ở dưới được giữ như lịch sử; kết quả và giới hạn Meal Planner được ghi riêng ở mục 14.

## 3. Công nghệ và kiến trúc

- React 19/Vite/Tailwind/React Router/Axios ở client.
- Node.js/Express/mssql/msnodesqlv8 ở server.
- SQL Server 2019 với Windows Authentication.
- JWT HttpOnly Cookie, CSRF, Origin/CORS allowlist và role authorization.
- Schema nền10 bảng cộng migration001 tạo MealPlans/MealPlanItems; SmartCookDB hiện12 bảng, services/repositories và transaction cho aggregate write.

Xem [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) và [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

## 4. Chức năng đã triển khai

| Nhóm | Nội dung |
| --- | --- |
| Guest | Home, catalog, search/filter/sort/pagination, detail, ingredient finder, suggestions, reviews công khai, auth pages |
| User | Profile, logout, Favorites, review ownership, lịch nấu ăn 7 ngày và Shopping List riêng; Pantry cũ duy trì tương thích |
| Admin | Dashboard, recipes/categories/ingredients CRUD, Users chỉ đọc, reviews list/delete |

## 5. Database và thuật toán gợi ý

Database gồm Users, Categories, Ingredients, Recipes, RecipeIngredients, CookingSteps, Favorites, Reviews, UserIngredients, SearchHistory, MealPlans và MealPlanItems, với PK/FK/UNIQUE/CHECK. Migration đã áp dụng ngày27/10/2026 và chạy lại idempotent, không chuyển Pantry hoặc seed lịch. Seed công thức giữ 8 categories, 64 ingredients, 20 recipes, 148 recipe ingredients và 80 cooking steps; số dữ liệu cá nhân thực tế không lấy từ số seed lịch sử.

Suggestions nhận các IngredientID, xác thực chúng, đếm required ingredients khớp, xếp hạng theo percentage giảm dần, số thiếu tăng dần, thời gian tăng dần và RecipeID. Response minh bạch matched/missing/optional và adjustedQuantity; không suy ra đủ stock quantity hoặc quy đổi đơn vị.

## 6. API

API public gồm health, catalog, recipe, suggestions và public reviews. Auth cung cấp CSRF/register/login/logout/me/profile; cá nhân gồm favorites/reviews/pantry và5 endpoint meal-plans; Admin quản lý dashboard/catalog/users/reviews, đồng thời chặn xóa recipe có MealPlanItems. Hợp đồng hiện hành ở [API.md](API.md), tài liệu bàn giao lịch sử ở [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## 7. Bảo mật

- SQL parameter binding, whitelist sort và escaped LIKE.
- Password HMAC-SHA384 pepper + bcrypt; không trả PasswordHash/JWT/secret.
- JWT 15 phút trong HttpOnly session cookie; CSRF/Origin/JSON bắt buộc cho mutation.
- Role Admin đọc lại từ SQL tại request bảo vệ.
- Không có Admin mặc định, API đổi role hoặc password hardcoded.

## 8. Kiểm thử thực tế

Lượt kiểm thử cuối Bước 12 ngày 23/10/2026: frontend lint/build pass; 188 unit/DOM và 13 integration pass; backend 161 unit/HTTP/security và 197 integration pass. Database integrity gồm 8 case pass nằm trong backend integration; check-db xác nhận SmartCookDB có 20 recipes và encrypted TRUE. Tổng bốn runner frontend/backend là 559 pass, 0 fail, 0 skipped.

Client/server npm ls và bốn npm audit (full + omit=dev cho mỗi app) đều exit 0 với 0 advisory. Kết quả audit là snapshot registry ở thời điểm chạy, không phải chứng nhận tuyệt đối về bảo mật dependency.

Browser smoke read-only đã xác nhận bốn route ở 375/768/1024/1440px không overflow ngang, guard Guest đến Favorites/Pantry/Admin chuyển Login và console không có error/warning. Chi tiết/test limits ở [TEST_SUMMARY.md](TEST_SUMMARY.md).

## 9. Rà soát và thay đổi Bước 12

| Nhóm rà soát | Kết quả |
| --- | --- |
| Hoàn thành | Đọc PLAN/README/Step 10–11/API/Auth/schema/seed/verify/package/route, rà soát Git/hygiene và tạo bộ tài liệu bàn giao. |
| Lỗi xác nhận | Không có lỗi runtime, UI hoặc security có bằng chứng thực tế để sửa trong đợt Bước 12. |
| Tối ưu còn lại | Hero PNG khoảng 2,82 MB, chưa có srcSet/WebP/AVIF; cần đo LCP/CLS trước khi tối ưu có căn cứ. |
| Thiếu tài liệu trước rà soát | Thiếu bộ INSTALLATION, project overview, requirements, architecture, use case, API handoff, test summary, demo, Git workflow và final report; các tài liệu này đã được bổ sung. |
| Chưa trực quan đầy đủ | Browser write/admin/keyboard/screen-reader/HTTPS vẫn Not Tested theo mục 10. |

Không thay đổi logic frontend/backend, auth, schema, seed, dependency hay configuration trong Bước 12. Các thay đổi source trước đó thuộc Bước 11 được giữ nguyên: regression rollback database integrity và bổ sung phép đo health/db.

## 10. Giới hạn còn lại

- Chưa nghiệm thu browser write flows, keyboard/screen reader/contrast đầy đủ, account A/B và Admin SQL thật.
- Chưa xác nhận HTTPS production, Secure/__Host cookie, TLS/reverse proxy, multi-instance session store.
- Chưa load/stress test nhiều user; baseline local không phải SLA.
- Hero PNG chưa tối ưu responsive và chưa có LCP/CLS đo thực.
- Pantry chưa hỗ trợ multi-lot/đổi đơn vị/tự trừ kho.

## 11. Khả năng chạy trên máy khác

Có thể chạy trên máy Windows có Node phù hợp, SQL Server/driver Windows Authentication, quyền database và cấu hình .env riêng. [INSTALLATION.md](INSTALLATION.md) mô tả đầy đủ. Không chuyển .env hoặc secret hiện có sang máy khác.

## 12. Sẵn sàng demo và phát triển tiếp

Dự án sẵn sàng cho demo các luồng public, API và các luồng User/Admin khi có môi trường demo/tài khoản được phép. [DEMO_SCRIPT.md](DEMO_SCRIPT.md) có fallback an toàn. Trước production cần hoàn thành các giới hạn ở mục 10, đặc biệt HTTPS, secret/session infrastructure, backup/restore, observability và browser/load acceptance.

## 13. Trạng thái Bước 12

**Hoàn thành trong phạm vi bàn giao ngày 23/10/2026.** Tài liệu bắt buộc đã có, source được giữ ổn định và lượt kiểm thử cuối đã pass. Đây không phải xác nhận production-ready tuyệt đối: các giới hạn thủ công/HTTPS/load ở mục 10 vẫn cần nghiệm thu trước khi triển khai thật.

## 14. Hoàn thiện Meal Planner — 28/10/2026

MP-01 và MP-02 được giữ nguyên từ checkpoint: migration đã áp dụng ngày 27/10/2026, schema có 12 bảng; không chạy lại trong lượt này. MP-03–MP-06 hoàn thành phần chức năng, tích hợp và tự động; MP-07 hoàn thành hồi quy/tài liệu với giới hạn browser bên dưới. Navbar mở `/meal-planner`, `/pantry` được bảo vệ rồi redirect replace; `/legacy-pantry` giữ giao diện cũ và API `/api/pantry`/UserIngredients nguyên vẹn.

Shopping List dùng Quantity × PlannedServings / Recipes.Servings, phân số BigInt chính xác từ SQL DECIMAL dạng text, gộp IngredientID + đúng Unit và chỉ làm tròn lên một lần ở tổng cuối tới tối đa 6 chữ số; không trừ Pantry hoặc gộp đơn vị chưa quy đổi. Checkmarks chỉ lưu tạm frontend. Dữ liệu lịch là riêng tư theo UserID session, mutation giữ JWT/CSRF/Origin và transaction; không tạo Admin thật.

Kết quả cuối: Frontend lint/build đạt, **212 unit/DOM + 14 integration** đạt; Backend **190 unit/HTTP + 215 integration** đạt. Tổng **631 đạt, 0 thất bại, 0 bỏ qua**. Trong backend integration có 18 Meal Planner SQL và 8 database-integrity case; không cộng hai nhóm này thêm vào tổng. Luồng React → HTTP → SQL thật kiểm tra đăng nhập, nhiều món/bữa, sửa/chuyển tuần/xóa/reload, RecipeDetail/Cooking Mode, Favorites/Pantry tương thích, Navbar/redirect và đăng xuất thu hồi phiên. Fixture dùng outer transaction rollback.

`check:db` xác nhận 20 Recipes, encrypted TRUE, Shared memory. Snapshot sau test giữ nguyên hash/count và metadata cột 10 bảng cũ, `.env`, schema, seed và các tệp auth/Pantry/Suggestions được bảo vệ trong snapshot; MealPlans/MealPlanItems đều 0 dòng, không còn dữ liệu test. Giữ nguyên Users1/Favorites1/UserIngredients0 thực tế; không tạo/nâng quyền Admin, đổi secret, commit/push hoặc đổi nhánh.

**Not Tested:** browser trực quan/thao tác ghi ở 375/768/1024/1440px vì Computer Use dừng khi không xác định được URL Chrome đủ tin cậy; không có ảnh chụp hoặc thao tác UI mới. Fixture concurrent HTTP dùng một kết nối có hàng đợi, không chứng minh stress race nhiều kết nối SQL độc lập. Production HTTPS/multi-instance/load cũng cần nghiệm thu riêng. Bằng chứng read-only Bước 11 không được tái sử dụng để đánh dấu Meal Planner Passed.

Báo cáo chi tiết, lỗi đã sửa và checklist thủ công ở [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md). Hướng dẫn sử dụng/schema tại [MEAL_PLANNER.md](MEAL_PLANNER.md), [SHOPPING_LIST.md](SHOPPING_LIST.md) và [MEAL_PLANNER_DATABASE.md](MEAL_PLANNER_DATABASE.md).
d