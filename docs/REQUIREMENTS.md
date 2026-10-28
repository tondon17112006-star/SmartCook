# Yêu cầu hệ thống SmartCook

Tài liệu này đối chiếu yêu cầu với chức năng có trong source/API. Trạng thái kiểm chứng phải đọc cùng [TEST_SUMMARY.md](TEST_SUMMARY.md) cho bàn giao Bước 12 và [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md) cho thay đổi mới; một requirement có test tự động không đồng nghĩa mọi thao tác browser đã được nghiệm thu.

## Yêu cầu chức năng

| Mã | Yêu cầu | Đối chiếu hiện có |
| --- | --- | --- |
| FR01 | Guest xem Home, danh mục và công thức. | Routes /, /recipes, /recipes/:id; API categories/recipes/detail. |
| FR02 | Tìm kiếm, lọc, sắp xếp và phân trang công thức. | GET /api/recipes có search, categoryId, maxTime, difficulty, sort, page, limit. |
| FR03 | Xem nguyên liệu chuẩn và chọn nguyên liệu có sẵn. | /ingredients, GET /api/ingredients và Pantry selection state. |
| FR04 | Gợi ý món theo nguyên liệu và khẩu phần. | POST /api/recipes/suggest; hiển thị matched/missing/optional và adjustedQuantity. |
| FR05 | Xem chi tiết, bước nấu, checklist, Cooking Mode và đổi khẩu phần. | RecipeDetailPage, CookingMode, RecipeSteps, ServingsSelector. |
| FR06 | Đăng ký, đăng nhập, đăng xuất và cập nhật profile. | API auth; AuthProvider, ProtectedRoute và ProfilePage. |
| FR07 | User quản lý Favorite của chính mình. | API /favorites và Favorites page; UNIQUE theo UserID/RecipeID. |
| FR08 | User tạo/sửa/xóa review của chính mình; mọi người đọc review. | Public/private review API và ownership enforcement. |
| FR09 | User quản lý Pantry và tìm món từ nguyên liệu chưa hết hạn. | API /api/pantry giữ nguyên; MyPantry tại /legacy-pantry; /pantry chuyển tới Meal Planner, không di chuyển dữ liệu. |
| FR10 | Chặn Guest/User thường truy cập Admin. | AdminRoute phía client; authenticateJWT + authorizeRoles ở server. |
| FR11 | Admin xem dashboard và quản lý recipes, categories, ingredients. | API /admin/dashboard, /admin/recipes, /admin/categories, /admin/ingredients. |
| FR12 | Admin xem Users chỉ đọc và quản lý review. | GET /admin/users, GET/DELETE /admin/reviews; không có endpoint đổi role/xóa User. |
| FR13 | Chủ tài khoản lên lịch 7 ngày, ba bữa/ngày, nhiều món/bữa và khẩu phần 1–20. | /meal-planner; API GET/POST/PATCH/DELETE riêng theo session; chuyển tuần trong transaction, không tin UserID client. |
| FR14 | Tổng hợp Shopping List từ nguyên liệu bắt buộc theo khẩu phần. | GET /api/meal-plans/shopping-list; gộp IngredientID + đúng Unit; tổng phân số chính xác rồi ceil 6 chữ số dạng chuỗi; không trừ Pantry. |
| FR15 | Đánh dấu và sao chép danh sách đi chợ. | Checkbox chỉ trong bộ nhớ, reset theo tuần/ghi lịch/phiên/reload; Clipboard API có fallback chọn văn bản, chỉ báo thành công sau ghi thật. |

## Yêu cầu phi chức năng

| Mã | Yêu cầu | Tiêu chí kiểm chứng / bằng chứng |
| --- | --- | --- |
| NFR01 | Cài đặt tái lập được trên máy phát triển. | package-lock trong client/server, env examples, schema/seed/verify và INSTALLATION.md. |
| NFR02 | Không lộ bí mật qua repository/API. | .gitignore, .env.example placeholder, DTO không gồm PasswordHash/JWT/pepper; kiểm thử security đã chạy. |
| NFR03 | Mutation xác thực có bảo vệ CSRF/Origin. | JSON + Origin allowlist + X-CSRF-Token bắt buộc; regression backend. |
| NFR04 | Phân quyền thực thi phía server. | Role lấy từ SQL trong request bảo vệ; Guest 401, User 403 trên Admin. |
| NFR05 | SQL chống injection. | mssql parameters, whitelist sort, escape LIKE và regression test. |
| NFR06 | Giao diện có HTML semantic/accessibility cơ bản. | Label, aria-label, skip link, focus-visible và các component có trạng thái lỗi. Keyboard/screen reader đầy đủ vẫn cần nghiệm thu browser. |
| NFR07 | Responsive tại các breakpoint phổ biến. | Browser smoke read-only đã kiểm tra 375/768/1024/1440 ở bốn route; toàn bộ route/write state chưa được kiểm thử trực quan. |
| NFR08 | Không làm hỏng dữ liệu test. | Integration dùng transaction rollback; Bước 11 so sánh 10 bảng nền. Thay đổi Meal Planner kiểm tra đủ 12 bảng và đối chiếu hash/count 10 bảng cũ với baseline riêng. |
| NFR09 | Hiệu năng local có baseline. | Warm-up + 5 request tuần tự, concurrency 1; không phải SLA hay load test production. |
| NFR10 | Bảo trì được. | Tách frontend/backend, route/controller/service/repository, scripts và tài liệu bàn giao. |

## Tiêu chí chấp nhận quan trọng

| Nhóm | Tiêu chí |
| --- | --- |
| API public | API trả 200/4xx có cấu trúc phù hợp; input hợp lệ/không hợp lệ được kiểm thử trong suite hiện có. |
| Auth | Không trả secret trong JSON, JWT dùng HttpOnly Cookie, session hết hạn/thu hồi bị từ chối. |
| Dữ liệu | SmartCookDB có 12 bảng sau migration 001; FK/UNIQUE/CHECK, verify.sql, integrity và dữ liệu nền được đối chiếu trong báo cáo hiện hành. |
| Regression | Lint/build và bộ unit/integration frontend/backend hoàn tất không lỗi ở lượt kiểm thử cuối. |
| Handoff | Có hướng dẫn cài đặt, kiến trúc, use case, API, database, demo, workflow Git và báo cáo cuối. |

## Giới hạn tiêu chí

Không đánh dấu Passed cho thao tác ghi trên browser, Admin SQL thật, HTTPS/Cookie Secure, screen reader, tải đồng thời hay production deployment khi chưa có môi trường/evidence tương ứng.
d