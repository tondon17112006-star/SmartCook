# Bảo mật khu vực Admin — Bước 10

## Xác thực và phân quyền

Mọi `/api/admin/*` đều đi qua cùng `authenticateJWT` và `authorizeRoles('Admin')` đã có. JWT HS256 900 giây phải hợp lệ, có jti trong registry chưa bị thu hồi; Backend đọc User/Role từ SQL Server ở từng request. Không tin role hoặc userId trong body, query, token hay React state. Guest401, User403; phiên hết hạn/logout/restart401. Response no-store, không ghi token/cookie/password/secret vào log.

AdminRoute là guard điều hướng, không thay thế Backend: Guest đến Login, User thấy403. AdminLayout độc lập MainLayout và dùng AuthProvider chung. Không có trang đăng nhập thứ hai. Interceptor xử lý401 trên toàn bộ `/admin`, vẫn bỏ qua401 do nhập sai thông tin ở Login.

Giữ nguyên HttpOnly/SameSite/Lax host-only cookie, Secure và tên __Host trong production, HMAC-SHA384 + bcrypt, JWT_SECRET và PASSWORD_PEPPER. Không migration, không reset khóa. Registry phiên vẫn nằm trong bộ nhớ một Backend; restart kết thúc phiên, chưa hỗ trợ nhiều worker hoặc refresh token.

## Ghi dữ liệu

POST/PATCH/DELETE cần cookie phiên, JSON, Origin khớp CLIENT_ORIGIN và X-CSRF-Token gắn đúng phiên. DELETE gửi `{}`. Dùng `authenticatedRequest` hiện có để lấy CSRF trước mỗi mutation; signal hủy cả bước lấy token và bước ghi khi rời/đổi phiên. Không mở ngoại lệ bảo mật cho Admin hoặc kiểm thử.

Validation chỉ nhận trường được cho phép, chặn overposting. SQL parameters cho ID/search/filter/nội dung; chỉ dùng ORDER BY từ whitelist cố định. Tên danh mục/nguyên liệu có UNIQUE ở SQL; FK không bị vô hiệu hóa. Transaction bảo vệ công thức và kiểm tra liên kết trước xóa. Lỗi nội bộ được che, lỗi dữ liệu trả400/404/409 phù hợp.

Users chỉ có GET list/detail với cột an toàn, không trả PasswordHash. Không có API đổi role, đặt lại mật khẩu hoặc xóa User. API review Admin chỉ cho đọc và xóa có xác nhận; API review User cũ vẫn chỉ cho chủ sở hữu sửa/xóa.

Không migration, CASCADE hàng loạt hoặc tự ẩn/xóa các món có người dùng liên kết. Chỉ URL ảnh, không upload/tải file ở server. Nội dung hiển thị qua React dưới dạng văn bản.

## Cấp quyền thủ công

Không tạo Admin mặc định và không nâng quyền trong đợt triển khai này. Khi người quản lý cho phép một tài khoản **đã tồn tại**, người vận hành chạy trong terminal tương tác tại `server`:

```powershell
npm run admin:promote -- email-da-duoc-phe-duyet
```

CLI hiện có kiểm tra tài khoản và yêu cầu nhập đúng `CAP ADMIN <email>`, không chạy non-interactive, không tạo tài khoản mới. Không đưa mật khẩu vào lệnh. Xem [AUTHORIZATION.md](AUTHORIZATION.md). Sau cấp quyền, tải lại trang hoặc đăng nhập lại để UI nhận DTO mới; Backend áp dụng role SQL ngay request tiếp theo.

## Fixture và giới hạn xác minh

Unit/DOM dùng fixture cô lập. Test SQL tạo User bình thường bằng đăng ký thật, Role SQL luôn `User`; một wrapper **chỉ trong test helper** chiếu Role Admin lên DTO của actor đã chọn. JWT, registry, cookie, CSRF, Origin và mọi truy vấn dữ liệu quản trị vẫn chạy thật. Không có cờ override role trong runtime/config/.env và không UPDATE Role trong SQL.

Outer transaction bao toàn bộ dữ liệu test; transaction con mô phỏng bằng savepoint với cùng connection, lỗi SQL thực tế ở bước insert con phải phục hồi toàn bộ công thức. Cleanup rollback và kiểm tra tài khoản fixture không còn. Kiểm tra hash/số dòng10 bảng trước/sau xác nhận dữ liệu gốc giữ nguyên (identity counter có thể tăng do SQL Server không rollback IDENTITY).

Fixture xếp hàng từng truy vấn trên một kết nối ODBC và chạy các mutation tuần tự; không dùng savepoint chung để mô phỏng nhiều transaction đồng thời. Kiểm thử rollback này không phải kiểm thử tải hoặc tranh chấp giữa nhiều kết nối. Production dùng transaction SERIALIZABLE và khóa UPDLOCK/HOLDLOCK; hành vi cạnh tranh nhiều Admin đồng thời chưa được kiểm thử tải riêng.

Vì không có Admin SQL được người dùng cấp phép, chưa kiểm chứng đăng nhập Admin thật bằng browser. Phép chiếu fixture không chứng minh quy trình vận hành cấp quyền; nhánh đọc Role SQL thật User403, kiểm tra middleware/quyền thay đổi trong fixture và quyền dữ liệu SQL được kiểm tra riêng. Browser/HTTPS/visual cũng cần nghiệm thu riêng theo [STEP10_VERIFICATION.md](STEP10_VERIFICATION.md).
