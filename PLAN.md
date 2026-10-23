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

## Phần tương lai — Hoàn thiện và triển khai

- Kiểm thử nghiệp vụ, phân quyền, tính định lượng và thuật toán gợi ý.
- Rà soát bảo mật, hiệu năng truy vấn và khả năng truy cập trên thiết bị di động.
- Cấu hình production, HTTPS, CORS, reverse proxy và quản lý secrets.
- Tài liệu vận hành, sao lưu/khôi phục SQL Server và dữ liệu thử nghiệm.
- Nghiệm thu đầy đủ theo ba nhóm Khách, Người dùng và Admin.

Bước1–10 hoàn thành phần lập trình và kiểm thử tự động theo phạm vi tương ứng, với giới hạn nghiệm thu ghi trong báo cáo. Chưa thực hiện Bước11 hoặc triển khai production.
