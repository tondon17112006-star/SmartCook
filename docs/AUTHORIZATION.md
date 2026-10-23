# Phân quyền SmartCook — Bước 8

## Ma trận quyền

| Chức năng | Khách | User | Admin |
| --- | --- | --- | --- |
| Xem/tìm món, chọn nguyên liệu, gợi ý và hướng dẫn nấu | Có | Có | Có |
| Đăng ký tài khoản mới | Luôn User | Luôn User ở API | Luôn User ở API |
| GET auth/me | 401 | Hồ sơ chính mình | Hồ sơ chính mình |
| PATCH auth/profile | 401 khi CSRF hợp lệ | Họ tên/phone chính mình | Họ tên/phone chính mình |
| GET admin/check | 401 | 403 | 200 |
| Đọc reviews Bước 9 | Có | Có | Có |
| Favorites / Pantry | Yêu cầu login | Dữ liệu chính mình | Dữ liệu chính mình |
| Tạo/sửa/xóa review Bước 9 | Yêu cầu login | Review chính mình | Review chính mình |
| Dashboard/Recipes/Categories/Ingredients quản trị Bước10 | 401 | 403 | Có, ghi cần CSRF/Origin |
| Users quản trị Bước10 | 401 | 403 | Xem/tìm kiếm, không đổi quyền/xóa tài khoản |
| Reviews quản trị Bước10 | 401 | 403 | Xem/lọc và xóa có CSRF/Origin |

`authenticateJWT` xác minh JWT + registry, lấy User thật từ SQL mỗi request; tài khoản bị xóa hoặc role không hợp lệ bị thu hồi phiên. `authorizeRoles('Admin')` chỉ đọc `req.user.role` từ SQL. Không có cổng đổi role hoặc nhận uid của người khác để sửa profile. Profile chỉ nhận fullName/phone; email/role/avatar/userId hay trường lạ trả 400. SQL INSERT công khai cố định N'User' kể cả gọi repository với dữ liệu thừa.

Frontend ProtectedRoute/AdminRoute và Navbar chỉ phục vụ điều hướng. Giả state client, gọi trực tiếp URL hoặc sửa JWT không vượt qua middleware. Bước10 thay trang kiểm tra quyền bằng AdminLayout và Dashboard/CRUD gọi SQL thật, giữ endpoint `GET /api/admin/check` tương thích. Xem [ADMIN_SECURITY.md](ADMIN_SECURITY.md).

## Cấp Admin thủ công khi đã được phép

Không có tài khoản Admin mặc định, mật khẩu cứng hoặc SQL seed Admin. Đợt triển khai/kiểm thử này **không chạy cấp quyền**. Khi người quản lý đã cho phép, tự đăng ký tài khoản rồi chạy tại server bằng terminal tương tác với quyền SQL thích hợp:

```powershell
npm run admin:promote -- dia-chi-email-da-dang-ky
```

CLI tìm đúng tài khoản bằng tham số email, hiển thị email và yêu cầu nhập chính xác `CAP ADMIN <email>`. Không khớp thì hủy, không tạo tài khoản thiếu, không cho chạy non-interactive; UPDATE còn kiểm tra uid/email/role User để tránh thay đổi ngoài ý định. Không chia sẻ hoặc ghi mật khẩu vào lệnh này. Công cụ không phải API và không được gọi bởi Frontend.

Thay đổi role hợp lệ áp dụng ở request bảo vệ tiếp theo do đọc lại SQL. Trong kiểm thử tự động, nhánh Admin200/chuyển role dùng repository fixture; integration Bước10 giữ mọi User SQL ở Role User và chỉ chiếu Admin lên DTO fixture, còn dữ liệu quản trị đọc/ghi SQL thật trong transaction rollback. Database chưa có Admin được cấp phép nên chưa xác nhận đăng nhập Admin SQL thật/browser; không tự nâng quyền để làm xanh test. Nhánh Khách401/User403 và ngăn role injection chạy trên SQL thật. Phạm vi kết quả tại [STEP10_VERIFICATION.md](STEP10_VERIFICATION.md).
