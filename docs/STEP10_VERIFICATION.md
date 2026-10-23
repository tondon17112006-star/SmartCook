# Kiểm chứng Bước 10 — Admin Dashboard

**Hoàn thành phần lập trình và kiểm thử tự động, xác nhận ngày 23/10/2026.** Tổng 538 bài đạt, 0 thất bại, 0 bỏ qua. Chưa nghiệm thu trực quan bằng browser, HTTPS hoặc đăng nhập Admin SQL thật; giới hạn này được giữ riêng ở cuối báo cáo. Chưa triển khai Bước 11.

## Trạng thái khi tiếp tục

Source tại checkpoint đã có Backend Admin, Frontend Core, quản lý công thức, layout/sidebar/routes và fixture SQL rollback. Không khởi tạo lại hoặc viết lại các phần đó. Lượt tiếp tục cuối rà soát toàn bộ phần quản trị, chạy lại các lệnh bị ngắt, sửa lỗi thông báo đăng xuất trong drawer mobile và hoàn tất tài liệu.

Git repository riêng vẫn chưa có commit: mọi file dự án là untracked. Đã kiểm tra `git status`, `git diff` và danh sách untracked; diff rỗng không được dùng để suy ra không có thay đổi. Không commit/push hoặc thay repository cha.

## Kết quả thực tế

Các lệnh cuối chạy trên source hiện tại, integration SQL chạy tuần tự để tránh các fixture tranh khóa nhau. Node.js 26.6.0, npm 11.18.0; dùng đúng dependencies và lockfile sẵn có, không cài thêm thư viện hoặc đổi công nghệ.

| Phạm vi | Lệnh | Kết quả |
| --- | --- | --- |
| Frontend lint | `cd client; npm run lint` | Sạch, không cảnh báo |
| Frontend build | `npm run build` | Thành công, không cảnh báo bundle; trang Admin tải riêng bằng React.lazy |
| Frontend unit/DOM | `npm test` | 186/186 đạt |
| Frontend integration | `npm run test:integration` | 13/13 đạt |
| Backend unit/HTTP | `cd server; npm test` | 150/150 đạt |
| Backend integration | `npm run test:integration` | 189/189 đạt |
| Kết nối SQL | `npm run check:db` | SmartCookDB, 20 món, Shared memory, encrypted TRUE |

Tổng 186 + 13 + 150 + 189 = **538**; không bài thất bại, bị hủy hoặc bỏ qua. Nhóm Admin Backend gồm 23 unit/HTTP và 29 SQL integration (đã nằm trong các tổng trên); Admin Frontend có 16 core DOM, 11 recipe DOM và một luồng integration xuyên suốt. Các bài auth hiện có cũng được cập nhật và chạy lại.

Đã khởi động `npm run dev` ở cả hai ứng dụng. Kiểm tra trực tiếp cổng 5000 và proxy 5173: health, health/db, categories, ingredients và recipes trả 200; Guest gọi các nhóm Admin trả 401 với no-store. Tám đường dẫn SPA quản trị trả HTML hợp lệ; việc render và tương tác React được xác minh riêng bằng jsdom, không suy ra từ HTML shell.

## Các chức năng đã xác minh

| Phần | Kiểm chứng |
| --- | --- |
| 10A — Layout/quyền | AdminLayout ngoài MainLayout, sidebar/menu/breadcrumb, drawer, thu gọn, Guest đến Login, User 403, fixture Admin được phép; 401 ở mọi API Admin hết phiên UI; đổi trang/phiên hủy request cũ |
| 10B — Dashboard | Sáu số đếm SQL, Users/Reviews rỗng trả 0, top 5 Favorites/Reviews có đếm và thứ tự hòa điểm đối chiếu SQL; món mới đúng CreatedAt/ID |
| 10C — Công thức | List, tìm tên, lọc danh mục, cả 5 sort whitelist, page 2/trang ngoài phạm vi; thêm/sửa nguyên liệu, định lượng, bước nấu; không trùng nguyên liệu, có nguyên liệu bắt buộc/bước nấu; kiểm tra số/URL; bỏ qua trường readonly khi gửi |
| 10C — Transaction | Gây RAISERROR SQL thực tế khi insert CookingSteps sau ghi cha/con; cả POST và PATCH rollback toàn bộ, bản cũ còn nguyên. PATCH thông tin đơn giữ StepID. Món mới có trong dịch vụ công khai và Suggestions với định lượng theo khẩu phần |
| 10C — Xóa | Favorites hoặc Reviews chặn 409; bỏ liên kết rồi xóa chỉ món fixture và các dòng con của nó; không CASCADE |
| 10D — Danh mục | Tạo/sửa/tìm/phân trang, số món, tên trùng khi POST/PATCH trả 409, không xóa danh mục đang có món |
| 10E — Nguyên liệu | CRUD/tìm/lọc nhóm, tên trùng, chặn xóa khi RecipeIngredients hoặc UserIngredients tham chiếu; đổi defaultUnit không đổi Quantity/Unit công thức |
| 10F — Users | List/search/role filter/chi tiết chỉ đọc; DTO không PasswordHash, JWT, secret; không nút/API đổi quyền, reset hoặc xóa tài khoản |
| 10F — Reviews | Tìm/lọc món/sao, phân trang, nội dung render văn bản, xóa có xác nhận; User không dùng được API xóa Admin; Recipes giữ nguyên |
| Bảo mật | JWT hết hạn/thu hồi, role đọc lại mỗi request, CSRF/Origin/JSON, body role/actor thừa bị từ chối, SQL Injection và wildcard LIKE literal, phân trang/ID sai, no-store |
| Hồi quy | Home/Recipes/Suggestions, Cooking Mode/checklist/khẩu phần/khôi phục, đăng ký/login/profile/logout/guards, Favorites, Reviews User và Pantry đều chạy lại đạt |

Luồng integration Admin chạy App thật, Axios qua HTTP tới các router/service thật và SQL Server trong transaction: Dashboard → tạo danh mục/nguyên liệu → tạo/sửa công thức → xóa review có xác nhận → xem Users → xóa công thức/dữ liệu fixture → logout → Guest/User guards. Các unit/DOM bổ sung loading, error/retry, empty, pending, hủy/xác nhận xóa, bản nháp khi lỗi và hủy request ở bước lấy CSRF.

## Những lỗi đã xử lý

- Kiểm thử auth cũ giả định Navbar công khai còn nằm ở trang Admin 403. Admin đã tách layout, nên test trở về Profile trước khi thử Navbar logout; trang 403 có vùng main riêng. Không xóa test hoặc thay chính sách quyền.
- Assertion so sánh cả DOM node khi chờ null khiến Node phải inspect cây lớn; chuyển sang so sánh boolean/thuộc tính nhỏ. Điền trường được giới hạn trong dialog để không nhầm ô lọc cùng tên. Các HTTP oracle trong test được đặt trong React act khi có reload đang chạy. Không tăng timeout để che lỗi.
- Form công thức focus trường lỗi bằng tên thay vì chờ aria-invalid xuất hiện; chỉ gửi allowlist, không gửi StepID và các cột readonly.
- Logout thất bại khi drawer mobile mở: lỗi nay nằm ngay trong dialog, phiên vẫn được giữ, nút được bật lại để thử. Bài DOM mới kiểm tra 503, trạng thái pending, lỗi nhìn thấy trong drawer và retry thành công.

Không còn lỗi được phát hiện trong các kiểm tra đã chạy.

## SQL Server và dữ liệu

Đối chiếu SHA-256 của JSON từng bảng, có thứ tự theo khóa và bao gồm giá trị null, trước/sau cả đợt Bước 10 và lần tiếp tục cuối. Tất cả hash và số dòng bằng nhau:

| Bảng | Trước | Sau |
| --- | ---: | ---: |
| Users | 0 | 0 |
| Categories | 8 | 8 |
| Ingredients | 64 | 64 |
| Recipes | 20 | 20 |
| RecipeIngredients | 148 | 148 |
| CookingSteps | 80 | 80 |
| Favorites | 0 | 0 |
| Reviews | 0 | 0 |
| UserIngredients | 0 | 0 |
| SearchHistory | 0 | 0 |

Không món, danh mục, nguyên liệu, tài khoản hoặc đánh giá fixture tồn đọng. Không sửa 20 món mẫu; không chạy migration, DROP/TRUNCATE, reset dữ liệu, reseed IDENTITY hoặc cấp quyền Admin. IDENTITY có thể tăng sau rollback theo cơ chế SQL Server; hash kiểm tra nội dung các dòng, không khẳng định bộ đếm identity không đổi.

Fixture đăng ký/login User thật; SQL Role luôn User. Chỉ repository trong test chiếu Admin lên DTO của actor được chọn. Không có override role trong runtime hoặc .env. JWT/cookie/registry/CSRF/Origin vẫn hoạt động; các tính năng quản trị đọc/ghi SQL thật. Mọi ghi nằm trong outer transaction; savepoint kiểm tra rollback lỗi con, cuối cùng outer rollback và kiểm tra địa chỉ fixture không còn.

Hash các file `.env`, schema/seed/verify, config JWT, HMAC/bcrypt, auth middleware, thuật toán matcher và hai lockfile không đổi so với baseline. Git bỏ qua .env, cache, logs, node_modules và dist. Không ghi secret vào báo cáo/Git.

## File tạo/sửa trong toàn bộ Bước 10

Đối chiếu snapshot trước Bước 10: **34 file mới, 15 file sửa, 0 file xóa**, không tính build/log/cache bị bỏ qua. Trong lần tiếp tục cuối, source nghiệp vụ đã có đủ; chỉ sửa thêm AdminLayout/test core về lỗi mobile và chốt tài liệu.

| Loại | File |
| --- | --- |
| Tạo — layout/service | `client/src/layouts/AdminLayout.jsx`, `client/src/services/adminService.js` |
| Tạo — component Admin | `client/src/components/admin/`: `AdminCatalog.jsx`, `AdminDialog.jsx`, `AdminFormField.jsx`, `AdminSidebar.jsx`, `ConfirmDialog.jsx`, `DataTable.jsx`, `adminNavigation.js`, `adminValidation.js`, `useAdminData.js`, `useAdminMutation.js` |
| Tạo — trang Admin | `client/src/pages/admin/`: `AdminDashboard.jsx`, `AdminRecipes.jsx`, `AdminRecipeForm.jsx`, `AdminCategories.jsx`, `AdminIngredients.jsx`, `AdminUsers.jsx`, `AdminReviews.jsx`, `adminRecipeOptions.js` |
| Tạo — test Frontend | `client/tests/admin-core.test.js`, `admin-recipes.test.js`, `integration/admin.integration.test.js` |
| Tạo — Backend | `server/src/controllers/admin.controller.js`, `server/src/services/admin.repository.js`, `admin.service.js`, `server/src/utilities/admin-validation.js` |
| Tạo — test Backend | `server/tests/admin.unit.test.js`, `admin.integration.test.js`, `helpers/admin-fixture.js` |
| Tạo — tài liệu | `docs/ADMIN_DASHBOARD.md`, `ADMIN_RECIPES.md`, `ADMIN_SECURITY.md`, `STEP10_VERIFICATION.md` |
| Sửa — Frontend | `client/src/App.jsx`, `components/AdminRoute.jsx`, `context/AuthProvider.jsx`; `client/tests/auth-core.test.js`, `auth.test.js`, `integration/auth.integration.test.js` |
| Sửa — Backend | `server/package.json`, `src/routes/admin.routes.js`, `src/services/recipe.service.js`, `tests/helpers/personal-fixture.js` |
| Sửa — tài liệu | `README.md`, `PLAN.md`, `docs/API.md`, `AUTHENTICATION.md`, `AUTHORIZATION.md` |

`recipe.service.js` chỉ thêm tùy chọn connection cho fixture để dịch vụ công khai đọc được dữ liệu test chưa commit; mặc định production vẫn getPool. Personal fixture thêm hook DTO chỉ ở mã test. Không đổi thuật toán gợi ý hoặc hệ thống auth.

## Chạy lại và kiểm tra bằng browser

Tại server: `npm run dev`. Tại client: `npm run dev`. SQL Server cần chạy; giữ cùng hostname `127.0.0.1` để dùng cookie và Origin đúng. Mở `http://127.0.0.1:5173/admin`. Guest được chuyển Login, User thấy 403. Đường dẫn sửa đúng là `/admin/recipes/:id/edit` với ID thật.

Không có Admin mặc định. Khi người quản lý đã cho phép, người vận hành dùng tài khoản đã đăng ký và CLI tương tác `npm run admin:promote -- email-da-duoc-phe-duyet`, xác nhận đúng `CAP ADMIN <email>`. CLI này **không được chạy trong đợt lập trình/kiểm thử**. Sau khi được phép cấp quyền, đăng nhập/tải lại rồi mở Dashboard. Xem [ADMIN_SECURITY.md](ADMIN_SECURITY.md).

Chọn các menu để xem KPI, tìm/lọc/phân trang, mở Thêm/Sửa món, nhập nguyên liệu/bước, Lưu công thức và kiểm tra dữ liệu. Hủy không ghi; xóa cần xác nhận và tôn trọng ràng buộc. Quy tắc tại [ADMIN_RECIPES.md](ADMIN_RECIPES.md), danh sách API tại [API.md](API.md).

Chạy lại unit và integration trong từng thư mục bằng `npm test` và `npm run test:integration`; Frontend thêm lint/build. Integration Frontend cần Backend chạy ở cổng 5000 (hoặc SMARTCOOK_TEST_API_URL), dependencies cả hai ứng dụng và SQL Server. Không chạy hai bộ SQL ghi dữ liệu đồng thời trên cùng database; chúng dùng transaction và có thể tranh khóa. Các log/snapshot cục bộ nằm ở `.cache/step10-*`, bị Git bỏ qua.

## Phần chưa kiểm chứng

- `cua.getState()` ngày 23/10 trả `apps:[], browsers:[]`: chưa kiểm thử trực quan tại 375/768/1024/1440px, thao tác chuột/bàn phím thật hoặc chính sách cookie/HTTPS trong browser. DOM chỉ kiểm tra cấu trúc, sự kiện, focus và trạng thái, không chứng minh kích thước/overflow thực tế.
- Chưa đăng nhập Admin có Role thật trong SQL bằng browser vì chưa có tài khoản được cấp phép. Fixture không chứng minh quy trình cấp quyền vận hành; không tự nâng quyền để kiểm thử.
- SQL fixture chạy mutation tuần tự với savepoint/hàng đợi một connection ODBC. Không suy ra kết quả tải hoặc tranh chấp nhiều transaction SERIALIZABLE production từ fixture này; cần kiểm thử nhiều kết nối riêng khi triển khai.
- Registry vẫn trong bộ nhớ một Backend, restart hết phiên; chưa refresh token, kho phiên dùng chung hoặc triển khai production. Chưa thuộc Bước 10.
