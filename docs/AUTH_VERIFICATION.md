# Kiểm chứng Bước 8 — Xác thực và phân quyền

Ngày chạy: **19/10/2026**, workspace `C:\Users\MyPC\Desktop\SmartCook`. Chỉ thực hiện Bước 8, chưa chuyển Bước 9.

## Kết luận lần rà soát cuối

**Bước 8 đã hoàn thành trong phạm vi lập trình và kiểm thử tự động được yêu cầu.** Lần tiếp tục cuối bắt đầu từ code auth đầy đủ và checkpoint 357 test, không bắt đầu lại từ bốn tệp nền. Đã kiểm tra lại source, Git, cấu hình và sáu tài liệu; toàn bộ lệnh lint/build/unit/integration/check:db dưới đây đã được chạy lại thành công ngày 19/10/2026. Các mục tiếp theo giữ lịch sử triển khai để đối chiếu.

Đã sửa thêm trong lần rà soát cuối:

- `server/src/app.js`: đặt no-store cho prefix auth/admin trước CORS và JSON parser để bao gồm cả phản hồi lỗi sớm; `server/tests/auth-configuration.test.js` xác nhận các lỗi Origin403, JSON400, thiếu khóa503 đều có header này.
- `server/scripts/setup-auth.js`: đồng bộ nhận diện placeholder `secret...here` với config runtime; không chạy tạo/đổi khóa trong lần này. Snapshot xác nhận `.env` hiện tại giữ nguyên.
- `client/tests/integration/auth.integration.test.js`: cleanup vẫn rollback/đóng tài nguyên và khôi phục DOM/globals khi có lỗi.
- `client/src/pages/ComingSoonPage.jsx`: sửa câu mô tả yêu thích đang nói tài khoản chưa ra mắt; không bổ sung chức năng yêu thích.
- README, PLAN, API và AUTHENTICATION/AUTH_VERIFICATION: cập nhật trạng thái hiện tại, vị trí AuthProvider và phạm vi cache header. AUTHORIZATION đã rà soát, nội dung vẫn khớp và không cần thay đổi.

Kết quả lần chạy cuối: **Frontend 114 unit/DOM + 11 integration**, **Backend 88 unit + 144 integration**, **lint/build/check:db đạt**; tổng **357/357**, không fail/skip. Integration auth thực hiện đăng ký, login, profile, reload và logout qua HTTP với SQL Server đang cấu hình, transaction rollback. Snapshot mới trước/sau lần rà soát cuối xác nhận hash và số dòng cả 10 bảng giống hệt, Users0 và Recipes20. Không tạo/nâng Admin, không migration/sửa món ăn, không commit hoặc đưa secrets/tệp tạm vào Git.

Hai máy chủ phát triển ban đầu chưa chạy; đã khởi động thành công ở Backend5000 và Frontend5173 để chạy integration/hướng dẫn kiểm tra. Smoke trực tiếp và qua Vite đạt: health200, me401 và admin-check401 khi guest, csrf200 có token, `/login` trả React entry200. Auth config đọc thành công hai khóa riêng, JWT900 giây, cookie HTTP local không Secure theo thiết kế.

Phần còn cần kiểm chứng thủ công: browser thật/responsive, cookie trên HTTPS thực tế và nhánh Admin200 với tài khoản SQL đã được người quản lý cấp phép. Những phần này chưa được báo Passed và không tự cấp quyền để kiểm tra. Không còn lỗi chức năng đã biết trong các luồng đã chạy; chưa triển khai Bước 9.

## Lịch sử lần tiếp tục triển khai trước

Đã đọc yêu cầu Bước 8 trong attachment, README, PLAN, thiết kế/schema Users và toàn bộ nguồn auth hiện có. Trên đĩa chỉ tồn tại bốn tệp nền auth: `server/src/config/auth.js`, `utilities/auth-validation.js`, `utilities/passwords.js`, `utilities/session-store.js`. Bốn tệp được giữ nguyên. Router/API auth, middleware, repository, AuthContext, guard và các trang auth chưa tồn tại ở thời điểm kiểm tra, dù thông báo trước gián đoạn đã nói các nhóm việc được thực hiện.

`git status --short` cho thấy toàn bộ dự án vẫn untracked, chưa có commit; `git diff --stat` và `git diff --name-only` trống vì Git không diff các tệp untracked. Không khởi tạo lại Git/dự án. Snapshot SHA-256 trước và sau dùng để xác định phần thực sự thay đổi; không suy luận rằng diff trống là không có thay đổi. Không xóa tệp cũ, không sửa repository cha.

Đã bổ sung phần còn thiếu, nối route/provider/CORS/cookie, công cụ khóa và CLI Admin có xác nhận. Các lỗi phát hiện khi tích hợp đã sửa: logout cần JSON `{}`, trường avatar phải đọc `avatar`, điều hướng logout từ trang bảo vệ bị guard chuyển nhầm `/login`. Hai fixture hồi quy cũ nay trả guest401 riêng cho request bootstrap `/auth/me`, không tính request này thành request món ăn.

## Môi trường đã dùng

| Thành phần | Phiên bản thực tế |
| --- | --- |
| Node / npm | 26.6.0 / 11.18.0 |
| React / ReactDOM | 19.3.1 / 19.3.1 |
| Vite / Tailwind | 8.3.4 / 4.3.3 |
| React Router / Axios / Lucide | 7.18.4 / 1.20.0 / 1.58.0 |
| Express / bcrypt / jsonwebtoken | 5.3.0 / 6.0.0 / 9.0.3 |
| mssql / msnodesqlv8 | 12.7.9 / 5.6.0 |
| jsdom / oxlint | 26.1.0 / 1.88.0 |
| Database | SQL Server 2019, SmartCookDB, Windows Authentication |

Không thay thư viện hoặc cài dependency mới trong lần tiếp tục này. Phiên bản lấy từ `npm ls --depth=0`, không suy luận từ range trong package.json.

## Kết quả lệnh đã chạy

| Vị trí | Lệnh | Kết quả |
| --- | --- | --- |
| client | `npm run lint` | Đạt, không cảnh báo |
| client | `npm run build` | Đạt, Vite production bundle |
| client | `npm test` | **114/114** unit/DOM đạt |
| client | `npm run test:integration` | **11/11** đạt, HTTP/SQL Server thật |
| server | `npm test` | **88/88** đạt (61 cũ + 25 auth + 2 cấu hình/CORS) |
| server | `npm run test:integration` | **144/144** đạt (138 cũ + 6 auth SQL) |
| server | `npm run check:db` | Đạt, SmartCookDB, 20 món, Shared memory, encrypted TRUE |
| server | `npm run setup:auth` | Tạo hai khóa thiếu; chạy lại giữ nguyên khóa, không in secret |
| root | `node --check server/scripts/setup-auth.js` và `promote-admin.js` | Cú pháp đạt; **không chạy cấp quyền Admin** |
| root | `git check-ignore server/.env` | `.env` được bỏ qua |

Tổng **357 test đạt**, không fail/skip ở các lần chạy cuối. Có các lần test thất bại trong lúc tích hợp; chỉ kết quả sau sửa được tính ở trên. Không báo chúng là lỗi còn tồn tại.

Smoke tiến trình phát triển đang có: Backend `/api/health` 200, `/api/auth/me` guest401, Frontend proxy `/api/auth/csrf` 200 và có token. Không dừng tiến trình Backend/Frontend vốn có của người dùng. Unit cấu hình tự khởi động tiến trình app riêng; integration mở server cổng ngẫu nhiên rồi đóng.

## Kiểm chứng chức năng

| Tình huống | Bằng chứng và phạm vi |
| --- | --- |
| Đăng ký201 / email trùng409 | HTTP với SQL transaction; email được chuẩn hóa, DTO không có hash/token, không tự đăng nhập |
| Email sai / password ngắn / trường thừa400 | Unit validation và HTTP fixture; register/profile role injection400 đã chạy SQL thật |
| Lưu PasswordHash | Đọc lại SQL: prefix `sc$bcrypt-hmac384$v1$`, bcrypt cost12, không plaintext; verify đúng pepper/password và sai đuôi trả false |
| Mật khẩu Unicode dài hơn 72 byte | Unit hash và SQL register/login dùng cùng helper; thay phần đuôi không còn khớp; pepper sai thất bại |
| Login200 / sai401 | HTTP SQL và React DOM thật; generic401 khi sai thông tin; JSON không chứa JWT |
| Cookie / me / reload | HttpOnly, host-only, Path=/, Lax, session cookie; GET me khôi phục đúng user, React reload gọi server |
| Profile | SQL + DOM: chỉ fullName/phone, sửa đúng uid phiên; trường uid/role/email/avatar bị từ chối |
| User không thành Admin | Register cố định User và profile whitelist; SQL User403 ở admin/check, không có API đổi quyền |
| Admin được phép / đổi role / xóa tài khoản | HTTP với repository fixture trong bộ nhớ: Admin200, hạ role User403 ngay, xóa user401. **Không dùng SQL để cấp/thay quyền** |
| JWT không hợp lệ/hết hạn | HTTP unit thực sự gọi middleware với sai chữ ký, HS384/none, sai claims/expiry, vẫn còn registry nhưng JWT hết hạn401 |
| CSRF/Origin | HTTP: thiếu/sai token, cookie, session binding, expiry, thiếu/ngoại Origin403; non-JSON400; token cũ sau login không dùng được |
| CORS | App thật trong tiến trình riêng: exact origin + credentials true, preflight PATCH/CSRF204, Origin lạ403 |
| Logout/replay | HTTP SQL: clear cookie và revoke jti; replay cookie chụp trước logout me401, CSRF cũ403; logout lại với CSRF mới hợp lệ200 |
| Restart | HTTP unit: JWT còn hạn nhưng registry mới trống trả401; không giả định JWT đơn thuần là đủ |
| Rate limit | Unit thời gian/capacity và HTTP429 + Retry-After, không tin header giả X-Forwarded-For |
| SQL Injection | SQL auth thực tế: tìm email chứa payload không trả tài khoản khác, fullName chứa dấu nháy/lệnh SQL được lưu như chuỗi trong transaction; Users còn nguyên |
| React guard và lỗi | StrictMode bootstrap, guest redirect giữ path/query, loading/unknown503 retry, stale401 không xóa phiên mới, lỗi logout giữ user |
| Storage | Không lưu JWT/password trong Web Storage; pantry/cooking giữ sau login/logout/reload theo scope cũ |
| Hồi quy | 84 test Frontend cũ + 10 integration cũ; Backend cũ 61 + 138; nguyên liệu/gợi ý/khẩu phần/checklist/Cooking Mode đều đạt |

Luồng tích hợp mới tại `client/tests/integration/auth.integration.test.js` mount React App thật bằng jsdom, gửi HTTP qua Axios node adapter có cookie jar, sử dụng repository SQL thật trong transaction rollback. Đây không phải kiểm thử chính sách cookie hoặc layout trong browser thật.

## Dữ liệu và secret sau kiểm thử

Hai bộ auth integration sử dụng User thử ngẫu nhiên trong transaction; luôn rollback trong cleanup và kiểm tra lại số Users. Không để lại tài khoản/password thử, không tạo hoặc nâng Admin. SQL IDENTITY có thể có khoảng trống do INSERT rollback, không reset identity để lấp khoảng trống.

So sánh SHA-256 JSON theo thứ tự khóa và số dòng trước/sau của cả 10 bảng: **giống hệt**. Users0, Categories8, Ingredients64, Recipes20, RecipeIngredients148, CookingSteps80, Favorites0, Reviews0, UserIngredients0, SearchHistory0. Schema/seed/verify.sql và các file Cooking Mode/nghiệp vụ món không đổi theo snapshot nguồn.

`server/.env` chỉ bổ sung JWT_SECRET/PASSWORD_PEPPER cục bộ từ crypto.randomBytes, không in hoặc ghi khóa trong tài liệu/test/nguồn frontend. Hai khóa có mục đích khác nhau. Chạy lại setup giữ nguyên khóa. Không có migration vì bảng Users hiện đủ trường và độ dài hash.

## Các tệp tạo/sửa khi triển khai trước lần rà soát cuối

Tạo mới:

```text
client/src/components/AdminRoute.jsx
client/src/components/AuthFormField.jsx
client/src/components/AuthShell.jsx
client/src/components/ProtectedRoute.jsx
client/src/components/UserAvatar.jsx
client/src/context/AuthContext.js
client/src/context/AuthProvider.jsx
client/src/hooks/useAuth.js
client/src/pages/AdminAccessPage.jsx
client/src/pages/LoginPage.jsx
client/src/pages/ProfilePage.jsx
client/src/pages/RegisterPage.jsx
client/src/services/authService.js
client/src/utilities/authForms.js
client/tests/auth-core.test.js
client/tests/auth.test.js
client/tests/authForms.test.js
client/tests/integration/auth.integration.test.js
server/scripts/promote-admin.js
server/scripts/setup-auth.js
server/src/middlewares/authenticateJWT.js
server/src/middlewares/authorizeRoles.js
server/src/routes/admin.routes.js
server/src/routes/auth.routes.js
server/src/services/auth.service.js
server/src/services/user.repository.js
server/src/utilities/auth-security.js
server/src/utilities/rate-limit.js
server/tests/auth-configuration.test.js
server/tests/auth.integration.test.js
server/tests/auth.unit.test.js
docs/AUTHENTICATION.md
docs/AUTHORIZATION.md
docs/AUTH_VERIFICATION.md
```

Sửa:

```text
client/src/App.jsx
client/src/components/Navbar.jsx
client/src/services/api.js
client/tests/ingredientFlow.test.js
client/tests/recipeDetail.test.js
server/src/app.js
server/package.json
server/.env.example
server/.env (cục bộ, Git bỏ qua)
PLAN.md
README.md
docs/API.md
```

Snapshot/hash tạm ở `.cache/` bị Git bỏ qua, không phải phần runtime. Không xóa file có sẵn; không tạo commit.

## Giới hạn và phần chưa kiểm chứng

- Không còn lỗi đã biết trong những luồng đã chạy; điều này không tương đương chứng nhận an toàn production.
- Chưa kiểm thử trực quan/responsive và chuột/bàn phím thật trong browser tại 375/768/1024/1440px. jsdom không đo layout hoặc chính sách browser.
- Secure/__Host cookie đã kiểm tra Set-Cookie ở HTTP unit, **chưa thử browser trên HTTPS thực tế**. Local chạy HTTP; production cần HTTPS, origin HTTPS và kiểm tra hạ tầng riêng.
- Không có Admin được cấp phép trong SQL: Admin200 thật và CLI promotion chưa chạy; nhánh cho phép chỉ có fixture. Guest401/User403 thực tế đã xác nhận. Không tự nâng quyền để kiểm thử.
- Registry trong bộ nhớ một tiến trình: restart kết thúc mọi phiên; không chạy nhiều instance độc lập. Chưa triển khai refresh token, nhớ đăng nhập, đổi/quên mật khẩu, email verification, CRUD Admin hoặc Bước 9.

## Tự chạy thử trên website

Terminal server: `npm run setup:auth` (không đổi khóa đang dùng), `npm run check:db`, `npm run dev`. Terminal client: `npm run dev`. Giữ nguyên `.env` hiện có; không chép đè từ mẫu. Với Backend đã chạy trước khi đổi .env, tự khởi động lại để nạp cấu hình; lưu ý mọi phiên cũ sẽ kết thúc.

1. Mở `http://127.0.0.1:5173/register`, nhập họ tên/email của bạn và mật khẩu ít nhất 12 ký tự, xác nhận trùng; thử nút hiện/ẩn. Thành công về login với thông báo, không tự login.
2. Login, kiểm tra Navbar có tên/avatar và Đăng xuất; `/profile` hiện thông tin từ SQL. Sửa họ tên/phone, lưu và reload kiểm tra.
3. Mở trực tiếp `/admin` với User để thấy thông báo không có quyền. Chỉ thử Admin thật khi đã có tài khoản được người quản lý cấp phép theo [AUTHORIZATION.md](AUTHORIZATION.md).
4. Chọn nguyên liệu/khẩu phần hoặc đánh dấu Cooking Mode, logout, kiểm tra lựa chọn/tiến độ còn trong phiên tab. Mở `/profile` lại phải về login.
5. Sau 15 phút, thao tác profile/reload phải yêu cầu login lại. DevTools chỉ nên dùng kiểm tra cờ cookie, không sao chép/chia sẻ token. Restart Backend cũng kết thúc phiên theo thiết kế.

Chi tiết API và yêu cầu CSRF: [API.md](API.md). Kiến trúc/khóa: [AUTHENTICATION.md](AUTHENTICATION.md). Quyền và CLI: [AUTHORIZATION.md](AUTHORIZATION.md).
