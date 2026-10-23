# Xác thực SmartCook — Bước 8

## Phạm vi và dữ liệu

Đăng ký, đăng nhập, đăng xuất, khôi phục phiên và cập nhật họ tên/số điện thoại trên bảng `dbo.Users` hiện có. Không migration, không sửa script schema/seed. `PasswordHash NVARCHAR(255)` đủ chứa định dạng mới. Repository bind mọi giá trị qua `mssql`; đăng ký ghi Role cố định `User`.

API không trả password, PasswordHash, pepper hoặc JWT trong JSON. DTO chỉ có `userId`, `fullName`, `email`, `phone`, `avatar`, `role`, `createdAt`. Avatar hiện chỉ đọc, không upload.

## Mật khẩu và khóa

Đăng ký/đăng nhập cùng gọi `utilities/passwords.js`:

```text
prepared = Base64(HMAC-SHA384(PASSWORD_PEPPER, UTF8(password)))
PasswordHash = "sc$bcrypt-hmac384$v1$" + bcrypt(prepared, random salt, cost 12)
```

HMAC cho 64 byte ASCII trước bcrypt. Mật khẩu gốc không bị cắt sau 72 byte, không trim/normalize; tiếng Việt và khoảng trắng được giữ. Validation 12–1024 Unicode code point, tối đa 4096 byte UTF-8, không NUL. Đã kiểm tra hai mật khẩu có cùng phần đầu dài hơn 72 byte nhưng khác đuôi không xác thực lẫn nhau. Hash không đúng prefix/cost/định dạng bị từ chối; không tự chuyển hash cũ hoặc lưu mật khẩu rõ. Login email không tồn tại vẫn thực hiện dummy bcrypt, trả cùng lỗi 401 khi sai thông tin.

`JWT_SECRET` và `PASSWORD_PEPPER` là hai khóa ngẫu nhiên riêng, 32–512 ký tự, không nhận placeholder hoặc hai khóa giống nhau. Chạy trong server:

```powershell
npm run setup:auth
```

Công cụ chỉ bổ sung khóa thiếu/placeholder, giữ khóa hợp lệ, không in khóa. `.env` bị Git bỏ qua. Hạn chế ACL NTFS theo tài khoản vận hành; mode 0600 trên API ghi tệp không thay thế việc quản lý ACL trên Windows. Khi triển khai, cấp khóa từ secret manager và dùng cùng pepper ổn định qua các lần khởi động. Sao lưu pepper tách khỏi database/Git; mất hoặc thay khóa khiến hash cũ không đăng nhập được, cần quy trình đặt lại mật khẩu (chưa thuộc Bước 8). Không chạy công cụ tái tạo pepper để xử lý lỗi login. Đổi JWT secret và restart kết thúc phiên; không giải quyết việc đổi pepper.

## Phiên và cookie

JWT HS256 thời hạn cố định 900 giây, chỉ có sub/jti/iss/aud/iat/exp. Middleware ràng buộc thuật toán, issuer/audience, SQL INT sub, jti ngẫu nhiên, hạn exp/iat và registry phiên đang hoạt động. Sau đó SELECT User từ SQL ở mỗi request bảo vệ; role trong client/token không quyết định quyền.

Cookie auth host-only, Path=/, HttpOnly, SameSite=Lax; không Max-Age/Expires (session cookie). Production dùng HTTPS/Secure và tên `__Host-smartcook_session`; HTTP development dùng `smartcook_session`. Cookie CSRF nonce cũng HttpOnly, cùng thuộc tính, hạn tối đa 15 phút. Không đặt Domain hoặc cho phép wildcard CORS. Có `Cache-Control: no-store` trên auth/admin response; Axios bật `withCredentials`.

Đăng nhập tạo jti mới, thu hồi phiên cũ trong cookie và xoay CSRF. Đăng ký không tự đăng nhập. Đăng xuất có CSRF/Origin, thu hồi jti và xóa cả hai cookie với đúng thuộc tính; JWT đã chụp trước logout không dùng lại được. Logout idempotent với CSRF mới hợp lệ, kể cả phiên JWT đã hết hạn. Hết 15 phút phải đăng nhập lại, không refresh token/remember me.

Registry jti/CSRF/limiter ở bộ nhớ một tiến trình, mỗi loại tối đa 10.000 bản ghi, loại bản ghi hết hạn và từ chối khi đầy. Restart/nodemon thu hồi tất cả phiên; phiên không sống qua restart. Không triển khai nhiều worker/instance với các Map riêng: cần kho chung và chính sách tương ứng ở bước triển khai sau. Khôi phục cookie khi mở lại trình duyệt tùy browser nhưng không vượt exp/registry.

## CSRF, Origin và giới hạn thử

`GET /api/auth/csrf` cấp token ngẫu nhiên trong JSON, nonce trong HttpOnly Cookie và bản ghi server liên kết jti (hoặc anonymous). Dùng lại bản ghi còn hạn đúng phiên để tránh xoay token giữa các request song song. Tất cả POST/PATCH auth phải có Origin thuộc CLIENT_ORIGIN, JSON và `X-CSRF-Token`; so sánh timing-safe, kiểm tra nonce/expiry/session binding. Token không lưu trong Web Storage; authService lấy token ngay trước mutation. Thiếu/sai Origin hay CSRF trả 403; sai JSON trả 400. CORS credentials chỉ với origin rõ ràng. Request command-line cũng phải gửi Origin/CSRF/cookie.

Login tối đa 10 lần/15 phút/IP, register 5 lần/giờ/IP, có Retry-After khi 429; giới hạn gồm cả lần thành công và body sai sau khi qua CSRF. Không tin X-Forwarded-For mặc định. Reverse proxy cần cấu hình trust proxy theo hạ tầng thực tế; không bật tin mọi proxy.

## React

App đặt AuthProvider bao quanh Routes, bên trong BrowserRouter. Bootstrap `GET /auth/me`: 200 phục hồi DTO, 401 thành guest, lỗi mạng/503 là trạng thái unknown với thử lại. ProtectedRoute đợi kiểm tra xong; AdminRoute kiểm tra vai trò để điều khiển UI, Backend vẫn thực thi quyền. Request cũ có generation/AbortController không ghi đè lần đăng nhập mới. Interceptor xử lý 401 của me/profile, toàn bộ API Admin Bước10 và API cá nhân Bước9 (favorites, pantry, review riêng/mutation); GET reviews công khai không làm mất phiên. Login sai mật khẩu không xóa nhầm phiên khác.

Bước 9 dùng thêm sessionGeneration trong Context để tách state theo lần đăng nhập, kể cả cùng UserID. Favorites, form review và tủ nguyên liệu hủy GET/CSRF/mutation khi đổi phiên, không hiển thị dữ liệu/draft của tài khoản trước. `authenticatedRequest` tái sử dụng Axios và GET CSRF trước POST/PATCH/DELETE, DELETE gửi JSON `{}`. Không thêm hệ thống auth hoặc token lưu phía client.

Đăng ký chỉ gửi 3 trường, không gửi confirmPassword/role; chuyển login thông báo thành công, không đưa password vào history. Login điều hướng nội bộ đã kiểm tra, không open redirect. Profile chỉ PATCH fullName/phone. Logout mạng lỗi giữ user để thử lại vì client không thể xóa HttpOnly Cookie; thành công giữ nguyên sessionStorage pantry/cooking. JWT/mật khẩu không có trong localStorage/sessionStorage.

## Tham khảo

Lựa chọn tiền xử lý HMAC và pepper đối chiếu [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Chính sách token/Origin đối chiếu [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Tùy chọn xác minh JWT theo [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken). Đây là tài liệu kiến trúc của bản hiện tại; kết quả chạy và giới hạn xác minh ở [AUTH_VERIFICATION.md](AUTH_VERIFICATION.md).
