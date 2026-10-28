# Kế hoạch phát triển SmartCook

## Giai đoạn 1 — Khởi tạo môi trường

- Dùng trực tiếp workspace hiện tại, tạo Git repository riêng.
- Kiểm tra Node.js/npm, khởi tạo React + Vite và Express.
- Cài thư viện Frontend, Backend và nodemon tương thích.
- Tổ chức mã nguồn theo cấu trúc đã thống nhất.
- Cấu hình Tailwind, React Router, Axios, CORS và biến môi trường mẫu.
- Tạo trang SmartCook tiếng Việt và `GET /api/health` không phụ thuộc SQL Server.
- Hoàn thành README, `.gitignore`, build Frontend và kiểm tra Backend thực tế.

**Điều kiện hoàn thành:** Frontend build thành công; `npm run dev` chạy được ở cả hai thư mục; health trả HTTP 200 trực tiếp và qua proxy. Kết quả được ghi trong `docs/verification.md`.

## Giai đoạn 2 — Thiết kế dữ liệu Microsoft SQL Server

**Đã hoàn thành phần thiết kế và dữ liệu Bước 2:** `schema.sql`, `seed.sql`, `verify.sql`, tài liệu thiết kế và ERD; đã thực thi trên SQL Server 2019, kiểm tra ràng buộc và chạy lại không trùng dữ liệu. Chi tiết tại `docs/DATABASE_VERIFICATION.md`.

- Thống nhất thực thể: tài khoản, vai trò, danh mục, nguyên liệu, món ăn, thành phần/định lượng, bước nấu, yêu thích, đánh giá và nguyên liệu của người dùng.
- Thiết kế khóa, ràng buộc, đơn vị định lượng, index và quy tắc dữ liệu.
- Viết script tạo bảng, dữ liệu mẫu và hướng dẫn thực thi trong `database/`.
- Kiểm tra kết nối SQL Server và truy vấn dữ liệu trực tiếp. Trong Bước 2, dùng Windows Authentication để chạy script; chưa đưa kết nối database vào luồng API.
- Connection pool `mssql`, cấu hình môi trường và truy vấn tham số được thực hiện khi bắt đầu Backend nghiệp vụ, theo phạm vi bước tiếp theo do người dùng yêu cầu.

**Điều kiện hoàn thành Bước 2:** tạo và truy vấn được dữ liệu đầy đủ trên SQL Server, ràng buộc hoạt động, script chạy lại không trùng hoặc ghi đè dữ liệu. Không thay bằng hệ quản trị khác.

## Bước 3 — Backend đọc dữ liệu SQL Server

**Đã hoàn thành theo phạm vi Bước 3 được yêu cầu:** Windows Authentication qua `mssql/msnodesqlv8`, connection pool, script `check:db`, API danh mục/nguyên liệu/danh sách/chi tiết món ăn, validation và xử lý lỗi an toàn. SQL Server thực tế và bộ kiểm thử 33 unit + 62 integration đều đạt. Xem `docs/API.md` và `docs/BACKEND_VERIFICATION.md`.

- Giữ nguyên `/api/health`, bổ sung `/api/health/db`.
- Tìm kiếm Unicode, lọc, sắp xếp whitelist, phân trang giới hạn và truy vấn tham số.
- Phạm vi Bước 3 chưa chỉnh Frontend, chưa có thuật toán gợi ý, tài khoản hoặc Admin; thuật toán Backend được bổ sung trong Bước 4 bên dưới.

## Bước 4 — Backend gợi ý món theo nguyên liệu

**Đã hoàn thành:** `POST /api/recipes/suggest` đọc SQL Server thật, validate/loại ID trùng, tính điểm chỉ nguyên liệu bắt buộc, xếp hạng ổn định và phân trang. Trả nguyên liệu đã có/còn thiếu/tùy chọn cùng định lượng gốc và định lượng theo khẩu phần yêu cầu. Giữ nguyên Frontend, schema, dữ liệu và API cũ.

- Điểm làm tròn nửa lên; xử lý công thức không có nguyên liệu bắt buộc và không có loại trùng.
- `ready` phản ánh đủ loại bắt buộc; không suy luận đủ số lượng thực tế.
- Truy vấn tham số JSON/OPENJSON, kiểm tra ID và nạp nguyên liệu theo lô, tránh N+1.
- Đã bổ sung 28 unit + 76 integration test; tổng hồi quy hiện tại **61 unit + 138 integration đạt**. Hash nội dung và số dòng cả 10 bảng giữ nguyên.
- Tài liệu: `docs/SUGGESTION_ALGORITHM.md`, `docs/SUGGESTION_VERIFICATION.md`, phần POST trong `docs/API.md`.

## Bước 5 — Giao diện khám phá công thức

**Đã triển khai:** hệ thống màu/typography, Navbar sticky/mobile, Footer, Home lấy danh mục/công thức thật, danh sách tìm/lọc/sắp xếp/phân trang theo URL, trang chi tiết đọc dữ liệu thật, trang thông báo chức năng tương lai và 404. Có skeleton, lỗi/thử lại, rỗng và fallback ảnh trung tính.

- Không thay đổi Backend, SQL Server hoặc thuật toán gợi ý.
- Lint sạch, 7 unit test bộ lọc và production build đạt; kiểm tra API/proxy và render React được ghi trong `docs/FRONTEND_VERIFICATION.md`.
- Đã cấu hình và rà soát CSS responsive cho 375/768/1024/1440px. **Chưa xác nhận trực quan/thao tác browser** do môi trường không cung cấp trình duyệt; cần thực hiện checklist trong báo cáo khi có browser.
- Tài liệu thiết kế: `docs/FRONTEND_DESIGN.md`. Bước 5 kết thúc trong phạm vi giao diện nền tảng, chưa triển khai Bước 6.

## Bước 6 — Chọn nguyên liệu và kết quả gợi ý

**Đã triển khai và kiểm tra:** IngredientFinder/Suggestions, nhóm từ catalog API đầy đủ, chọn/bỏ/chip/xóa tất cả, khẩu phần 1–20, Context/sessionStorage và đối chiếu ID khi khôi phục. POST gợi ý thật, tỷ lệ/ready/missing, adjustedQuantity, tùy chọn, phân trang và liên kết công thức; không thay đổi Backend/database.

- Danh sách “Tất cả” dùng pagination API; lọc trạng thái chỉ khi đã tải đủ toàn bộ tập kết quả. Giới hạn tải để lọc 500 món; cần API filter riêng nếu phát triển quy mô lớn.
- Hủy request cũ, token tránh dữ liệu cũ, reset page khi đổi lựa chọn/khẩu phần, loading/error/retry/empty bằng tiếng Việt.
- Lint sạch, build đạt, **50 unit/DOM + 8 integration Frontend đạt**. Luồng DOM React với Backend/SQL Server thật xác nhận 13 món (2 ready/11 missing), đổi khẩu phần, phân trang, filter toàn bộ, chi tiết, reload và hồi quy Home/Recipes.
- Chưa kiểm thử trực quan/chuột/bàn phím thật tại 375/768/1024/1440px vì browser không khả dụng; jsdom không xác nhận layout.
- Tài liệu: `docs/INGREDIENT_FINDER.md`, `docs/SUGGESTIONS_FRONTEND_VERIFICATION.md`.

## Bước 7 — Trang hướng dẫn món ăn và Cooking Mode

**Đã triển khai:** mở rộng RecipeDetail hiện có với thông tin món, khẩu phần ±1–20, định lượng từ số gốc, checklist nguyên liệu/bước, tiến độ và chế độ xem một bước. Lưu phiên riêng theo RecipeID, khôi phục/đối chiếu ID, reset riêng món, giữ khẩu phần từ Suggestions đúng một lần theo lượt điều hướng. Món liên quan dùng API thật, ưu tiên cùng danh mục và loại món hiện tại.

- Giữ nguyên Backend, schema, seed và SQL Server; không thêm tài khoản/yêu thích/Admin.
- Hiển thị rõ thiếu nguyên liệu/bước, ID sai/404, API lỗi/thử lại, fallback ảnh và khẩu phần gốc không hợp lệ. Không tạo timer từng bước từ tổng phút.
- Lint/build đạt, **84 unit/DOM + 10 integration Frontend đạt**. Hồi quy Backend **61 unit + 138 integration đạt**, `check:db` xác nhận 20 món/kết nối mã hóa; API trả đủ 80 bước theo thứ tự.
- Chưa kiểm thử trực quan/chuột/bàn phím browser ở 375/768/1024/1440px vì browser không khả dụng; đã kiểm tra DOM/focus mô phỏng và luồng API/SQL Server thật.
- Tài liệu: `docs/RECIPE_DETAIL.md`, `docs/COOKING_MODE.md`, `docs/RECIPE_DETAIL_VERIFICATION.md`.

## Bước 8 — Đăng ký, đăng nhập và phân quyền User/Admin

**Đã hoàn thành trong phạm vi Bước 8, tái kiểm chứng ngày 19/10/2026.** Lần rà soát cuối tiếp tục từ checkpoint đã đầy đủ auth và tài liệu, không viết lại chức năng. Lịch sử lần triển khai trước từ bốn tệp nền được giữ trong `docs/AUTH_VERIFICATION.md`. Giữ kiến trúc JWT 15 phút/HttpOnly Cookie, phiên trong bộ nhớ và HMAC+bcrypt. Không migration Users, không đổi schema/seed hoặc tạo Admin.

- Backend: đăng ký User, đăng nhập/đăng xuất, me, profile whitelist, CSRF+Origin/JSON, giới hạn thử đăng nhập/đăng ký, repository SQL tham số, authenticateJWT và authorizeRoles kiểm tra vai trò từ SQL mỗi request.
- Frontend: AuthContext/Provider/useAuth, bootstrap me, guard loading/unknown/retry, ProtectedRoute/AdminRoute, Navbar, Login/Register/Profile và trang xác minh quyền Admin. Không lưu JWT/mật khẩu trong Web Storage; không xóa pantry/cooking khi logout.
- Công cụ tạo khóa cục bộ idempotent và CLI cấp Admin có xác nhận tương tác; CLI cấp quyền không được thực thi trong đợt này.
- Đã chạy lại: Frontend lint/build, 114 unit/DOM + 11 integration; Backend 88 unit + 144 integration và check:db đều đạt. HTTP/SQL auth transaction rollback và hồi quy món ăn/gợi ý đạt; hash/số dòng cả 10 bảng không đổi, Users0. Kết quả và phần chưa kiểm chứng tại `docs/AUTH_VERIFICATION.md`.
- Giới hạn đã chọn: backend restart kết thúc phiên, không refresh/remember me, chưa có kho phiên chia sẻ nhiều instance. Browser trực quan/HTTPS và Admin thật cần kiểm chứng riêng, không tự nâng quyền để thử.

## Bước 9 — Favorites, Reviews và My Pantry

**Hoàn thành trong phạm vi lập trình và kiểm thử tự động ngày 22/10/2026.** Frontend lint/build, 158 unit/DOM + 12 integration; Backend 127 unit + 160 integration và check:db đều đạt. Cả 10 bảng giữ nguyên hash/số dòng sau rollback. Chưa kiểm thử trực quan tại các kích thước màn hình do không có browser kết nối.

- Giữ phần Favorites/Reviews đã lưu trước gián đoạn; nối và hoàn thiện Pantry Backend, Frontend và luồng Suggestions từ tủ cá nhân.
- Favorites: SQL theo UserID phiên, chống trùng, trái tim dùng state chung, trang riêng có phân trang/xác nhận bỏ lưu.
- Reviews: đọc công khai, summary toàn bộ món, một đánh giá/người/món, sửa/xóa chỉ chủ sở hữu, bình luận render văn bản và form có trạng thái lỗi/pending.
- Pantry: CRUD riêng trong UserIngredients, số lượng/đơn vị/ngày có validation, hạn theo ngày Việt Nam, loại hàng hết hạn khi tìm món và giữ khẩu phần. Không đổi thuật toán, không quy đổi đơn vị hay tự trừ tủ.
- Schema đã có cả ba composite UNIQUE, không migration và không sửa dữ liệu món. JWT/Cookie/CSRF/Origin và quyền sở hữu dùng hệ thống Bước 8; không tạo Admin.
- Kiểm thử toàn bộ Bước 1–8 cùng unit/DOM/HTTP/SQL mới; kết quả cuối và giới hạn tại `docs/STEP9_VERIFICATION.md`. Chưa chuyển Bước 10.

## Phần tương lai — Mở rộng tài khoản

- Khôi phục/đổi mật khẩu, xác minh email và các chính sách phiên nâng cao khi có yêu cầu.

## Bước 10 — Admin Dashboard

**Hoàn thành phần lập trình và kiểm thử tự động ngày23/10/2026.** Tiếp tục source đã có, không viết lại Bước1–9. Toàn bộ repository vẫn untracked, chưa commit; diff rỗng không phản ánh đầy đủ công việc.

- 10A: AdminLayout độc lập, sidebar/drawer/breadcrumb/tài khoản, guards Guest/User, hủy request theo phiên và xử lý401 toàn bộ API Admin. Lỗi đăng xuất được hiện ngay trong drawer mobile và cho phép thử lại.
- 10B: Dashboard SQL thật với6 KPI và top5 yêu thích/đánh giá/mới thêm; số0 và danh sách rỗng được xử lý.
- 10C: CRUD món/công thức đầy đủ, validation và transaction nguyên liệu/bước nấu. Kiểm chứng lỗi SQL sau insert con rollback cả thêm/sửa; scalar PATCH giữ StepID. Món mới đọc được ở API công khai/gợi ý. Chặn xóa có Favorites/Reviews409.
- 10D/10E: CRUD danh mục/nguyên liệu, tìm/lọc/phân trang, chống tên trùng và xóa có kiểm tra tham chiếu. Không sửa định lượng công thức khi đổi đơn vị mặc định.
- 10F: Users chỉ đọc/tìm/xem chi tiết; Reviews lọc/xóa có xác nhận bằng quyền Admin. Không thêm API đổi quyền hoặc xóa tài khoản.
- 10G: Frontend lint/build sạch,186 unit/DOM +13 integration đạt; Backend150 unit/HTTP +189 integration đạt. Tổng538 bài,0 thất bại/bỏ qua. Hồi quy Home/Recipes/Suggestions/Cooking Mode/Auth/Favorites/Reviews/Pantry đạt.
- SQL Server mã hóa,20 món mẫu và hash/số dòng10 bảng giữ nguyên qua rollback. Không migration, không đổi secrets/schema, không tạo/nâng quyền Admin hoặc commit/push. Fixture Admin chỉ trên DTO test, Role SQL vẫn User.
- Tài liệu README/API/ADMIN_* và báo cáo `docs/STEP10_VERIFICATION.md` đã chốt. Còn nghiệm thu browser trực quan/responsive/HTTPS, đăng nhập Admin SQL thật khi có tài khoản được phép và kiểm thử tải nhiều kết nối; các phần này không được đánh dấu Passed.

## Bước 11 — Kiểm thử tổng thể

**Hoàn thành trong phạm vi tự động, SQL integrity, light performance và browser smoke read-only ngày 23/10/2026.** Không thực hiện Bước 12.

- Frontend lint/build, 188 unit/DOM và 13 integration đều đạt; Backend 161 unit/HTTP/security và 197 integration đều đạt.
- Database integrity kiểm tra 10 bảng, PK/FK/UNIQUE/CHECK, DBCC, recipe structure, `verify.sql` và một aggregate fixture rollback; mọi snapshot dữ liệu giữ nguyên. `check:db` xác nhận SmartCookDB mã hóa với 20 recipes; không có User/Admin thật hay dữ liệu test còn lại.
- Đã đo tải nhẹ tuần tự, có warm-up và 5 mẫu/endpoint cho health, health/db, catalog, recipes, detail và suggestions; đây không phải load test hay SLA production.
- `npm ls` và audit full/production của Client/Server đều trả 0 advisory ở lần chạy cuối. Browser smoke đã xác nhận không overflow ngang ở 375/768/1024/1440px cho Home, Recipes, Detail và Ingredient Finder; guard Guest đến Favorites/Pantry/Admin chuyển đúng về Login.
- Báo cáo đầy đủ: `docs/STEP11_TEST_REPORT.md`, dependency: `docs/STEP11_DEPENDENCIES.md`, checklist: `docs/STEP11_MANUAL_CHECKLIST.md`. Còn browser write/admin/keyboard đầy đủ, HTTPS thật, production load/multi-instance và tối ưu hero image là giới hạn phải nghiệm thu riêng.

## Bước 12 — Hoàn thiện bàn giao đồ án

**Hoàn thành trong phạm vi bàn giao ngày 23/10/2026.** Rà soát source, routes, schema, seed/verify, API/Auth, Git hygiene và bằng chứng Bước 10–11 không phát hiện lỗi runtime/UI/security có căn cứ để thay đổi logic. Giữ nguyên frontend/backend/auth/schema/seed/dependencies; chỉ chuẩn hóa tài liệu bàn giao và chạy lại kiểm thử cuối.

- Tạo tài liệu: INSTALLATION.md, PROJECT_OVERVIEW.md, REQUIREMENTS.md, SYSTEM_ARCHITECTURE.md, USE_CASE.md, API_DOCUMENTATION.md, TEST_SUMMARY.md, DEMO_SCRIPT.md, GITHUB_WORKFLOW.md, FINAL_PROJECT_REPORT.md; cập nhật README và DATABASE_DESIGN.md.
- Frontend lint/build pass; unit/DOM **188/188** và integration **13/13** pass.
- Backend unit/HTTP/security **161/161** và integration **197/197** pass. Database integrity **8/8** là một phần của integration; check:db xác nhận SmartCookDB, 20 recipes, Shared memory, encrypted TRUE.
- npm ls và audit full/production ở Client/Server đều exit 0, **0 advisory**. Không dùng audit fix, không đổi package hoặc lockfile.
- Browser smoke read-only Bước 11 là evidence trực quan hiện có. Browser write/admin/keyboard/screen reader/HTTPS/load production không được đánh dấu Passed và phải nghiệm thu riêng.
- Không commit/push/chuyển branch, không tạo/nâng quyền Admin, không sửa .env thật hoặc xóa/reset database. Git hiện còn các thay đổi Bước 11 và Bước 12 chưa commit để chủ dự án review.

## Phần tương lai — Hoàn thiện và triển khai

- Kiểm thử nghiệp vụ, phân quyền, tính định lượng và thuật toán gợi ý.
- Rà soát bảo mật, hiệu năng truy vấn và khả năng truy cập trên thiết bị di động.
- Cấu hình production, HTTPS, CORS, reverse proxy và quản lý secrets.
- Tài liệu vận hành, sao lưu/khôi phục SQL Server và dữ liệu thử nghiệm.
- Nghiệm thu đầy đủ theo ba nhóm Khách, Người dùng và Admin.

Bước1–12 hoàn thành phần lập trình, kiểm thử và bàn giao theo phạm vi tương ứng, với giới hạn nghiệm thu ghi trong báo cáo. Chưa triển khai production.

## Thay đổi sau bàn giao — Meal Planner và Shopping List

Chốt phần lập trình, tích hợp và kiểm thử tự động ngày **28/10/2026**, tiếp tục trên nhánh `feature/weekly-meal-planner`. Giữ nguyên các thay đổi/tài liệu có sẵn; không commit, push hoặc tự chuyển nhánh. Số test trong các mục Bước 1–12 ở trên là lịch sử; kết quả thay đổi mới được ghi riêng dưới đây và tại [MEAL_PLANNER_VERIFICATION.md](docs/MEAL_PLANNER_VERIFICATION.md).

| Giai đoạn | Trạng thái đã xác minh | Giới hạn / bảo toàn |
| --- | --- | --- |
| MP-01 — Rà soát | Đã hoàn thành | Không thực hiện lại từ đầu; đối chiếu source thực tế khi tiếp tục |
| MP-02 — Database | Migration `001_weekly_meal_planner.sql` đã chạy ngày 27/10; đã chạy lại để xác nhận idempotent; SmartCookDB có 12 bảng | Chỉ kiểm tra cấu trúc bằng truy vấn đọc; không chạy lại migration nếu hợp đồng đã đúng |
| MP-03 — Backend | Hoàn thành; đủ 5 API, validation, ownership, chuyển tuần, transaction/retry/rollback; 29 unit/HTTP mới và 18 SQL mới đạt trong bộ chạy cuối | Không chạy lại migration; fixture SQL rollback, không tạo/nâng quyền Admin thật; chưa stress nhiều kết nối SQL độc lập |
| MP-04 — Frontend | Hoàn thành chức năng và kiểm thử tự động: lịch 7 ngày/3 bữa, nhiều món/bữa, tìm recipe/Favorites, dialog CRUD, điều hướng tuần/reload, bảo vệ phiên; luồng App → HTTP → SQL đạt | Layout, responsive, thao tác chuột/bàn phím browser thật vẫn Not Tested |
| MP-05 — Shopping List | Hoàn thành chức năng và kiểm thử tự động; SQL thật đối chiếu nhiều khẩu phần/đơn vị, cùng món nhiều ngày, optional, cập nhật sau CRUD; checkbox/sao chép/fallback có DOM test | Checkbox chỉ lưu trong bộ nhớ; không đổi đơn vị/trừ Pantry; clipboard permission browser thật chưa nghiệm thu |
| MP-06 — Tích hợp | Hoàn thành; Navbar Lịch nấu ăn, `/pantry` redirect replace, `/legacy-pantry` giữ UI cũ; RecipeDetail/Cooking Mode/selector Favorites/rule Admin được kiểm thử qua React → HTTP → SQL | API `/api/pantry`, UserIngredients, Favorites/Reviews và Suggestions giữ nguyên; không di chuyển dữ liệu Pantry |
| MP-07 — Hồi quy/tài liệu | Hoàn thành hồi quy tự động và tài liệu: lint/build đạt; Frontend 212 unit/DOM + 14 integration; Backend 190 unit/HTTP + 215 integration; tổng 631 đạt, 0 thất bại, 0 bỏ qua | Browser 375/768/1024/1440px Not Tested vì Computer Use không xác định được URL Chrome để thực thi policy; checklist và giới hạn ở báo cáo kiểm chứng |

Hai bảng bổ sung là `MealPlans` và `MealPlanItems`, không có lịch seed. Bảng `UserIngredients`, API `/api/pantry`, Favorites, Reviews, Recipes và thuật toán Suggestions được giữ nguyên. Snapshot ban đầu của đợt thay đổi ghi nhận **1 Users, 1 Favorites, 0 UserIngredients, 20 Recipes**; không suy diễn mọi bảng cá nhân đang rỗng từ số liệu seed lịch sử.

Shopping List chỉ tổng hợp nguyên liệu bắt buộc, gộp theo IngredientID và **đơn vị đúng chuỗi**, tính phân số chính xác từ SQL DECIMAL, chỉ làm tròn lên một lần ở tổng cuối tới tối đa 6 chữ số thập phân khi trả chuỗi số. Không quy đổi đơn vị hoặc trừ Pantry. Checkbox đã mua là state tạm, không thay thế dữ liệu lịch trong SQL Server.

`check:db` xác nhận SmartCookDB có 20 món, mã hóa TRUE và Shared memory; 8 database-integrity case và 18 Meal Planner SQL case là một phần của 215 backend integration, không cộng lại vào tổng. Sau toàn bộ test, hash/count và metadata cột 10 bảng cũ khớp baseline; `.env`, schema, seed và các tệp auth/Pantry/Suggestions được bảo vệ trong snapshot giữ nguyên. MealPlans/MealPlanItems vẫn 0 dòng, không còn dữ liệu fixture. Baseline Users1/Favorites1 được giữ nguyên, không thay dữ liệu cá nhân để ép khớp số seed.

Các lỗi được sửa trong lượt hoàn thiện gồm điều hướng Tuần này qua thời điểm nửa đêm Việt Nam, assertion DOM tạo diff React rất lớn làm test chờ kéo dài, và hai kỳ vọng Navbar Pantry cũ trong integration. Không xóa kiểm thử hoặc tăng timeout để che lỗi; bộ chạy cuối đạt toàn bộ.

MP-04/05/06 hoàn thành phần chức năng và tự động; MP-07 hoàn thành hồi quy/tài liệu trong phạm vi đã chạy. Chưa nghiệm thu trực quan/browser write ở 375/768/1024/1440px, production HTTPS/multi-instance hoặc stress race nhiều kết nối SQL độc lập. Không suy các phần này là Passed từ DOM/HTTP/SQL; tiếp tục checklist thủ công trong báo cáo khi có môi trường phù hợp. Không triển khai tính năng khác.
