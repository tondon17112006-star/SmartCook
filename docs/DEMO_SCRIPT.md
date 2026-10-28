# Kịch bản demo SmartCook (10–15 phút)

Mục tiêu: trình bày vấn đề, kiến trúc và các luồng có thể demo an toàn mà không tạo dữ liệu khó khôi phục. Chuẩn bị browser local, backend/frontend đang chạy và SmartCookDB đã kiểm tra. Không đọc to hay trình chiếu secret/cookie/JWT.

## Trước khi demo

- Chạy health, health/db và npm run check:db.
- Mở sẵn trang chủ, tab Recipes và route Ingredients.
- Nếu có môi trường demo riêng và account User đã được chuẩn bị, xác nhận có thể đăng nhập; không dùng thông tin thật trong slide.
- Chỉ demo Admin khi có tài khoản Admin đã được cấp phép rõ ràng hoặc database demo riêng có thể khôi phục. Không cấp quyền ngay trong buổi demo.
- Có thể chuẩn bị một bản ghi recipe demo riêng cho thao tác ghi; không sửa seed data.

## Kịch bản chính

| Thời lượng | Thao tác | Lời nói ngắn | Kết quả mong đợi | Dự phòng |
| --- | --- | --- | --- | --- |
| 0:00–0:45 | Mở Home | SmartCook giúp chọn món từ nguyên liệu đã có, thay vì chỉ tra công thức rời rạc. | Trang chủ hiển thị catalog/điểm vào chức năng. | Dùng ảnh/video đã chuẩn bị từ chính môi trường nếu browser lỗi; không tạo screenshot giả. |
| 0:45–1:30 | Nêu stack/architecture | React/Vite gọi Express API; Express dùng SQL Server và query tham số. | Sơ đồ kiến trúc trong SYSTEM_ARCHITECTURE.md. | Mở tài liệu kiến trúc. |
| 1:30–2:30 | Vào Recipes, tìm kiếm/lọc/sắp xếp | Khách có thể khám phá catalog bằng URL filter/pagination. | Danh sách thay đổi theo filter; mở detail hợp lệ. | Refresh route hoặc dùng query đã biết. |
| 2:30–3:30 | Chọn một Recipe Detail | Một recipe có metadata, nguyên liệu, bước và đánh giá công khai. | Detail/ingredients/steps hiển thị. | Quay về Recipes chọn một món seed khác. |
| 3:30–4:20 | Đổi khẩu phần, checklist, Cooking Mode | Lượng được tỉ lệ từ khẩu phần gốc; Cooking Mode giúp theo dõi từng bước. | Lượng/checklist/mode phản hồi tại client. | Reload route để khôi phục giao diện cơ bản. |
| 4:20–5:45 | Vào Ingredients, chọn vài nguyên liệu | Người dùng chọn nguyên liệu mình có, thay vì gõ text tự do. | Chip/lựa chọn hiện rõ. | Dùng một tập IngredientID có trong catalog. |
| 5:45–7:00 | Mở Suggestions | Thuật toán tính tỷ lệ theo nguyên liệu bắt buộc và chỉ ra phần thiếu. | Cards có percentage, ready/missing, matched/missing. | Giải thích request/response trong API_DOCUMENTATION.md. |
| 7:00–7:45 | Nêu giới hạn thuật toán | Tỷ lệ không đồng nghĩa đủ gram/ml; hệ thống không tự quy đổi/trừ Pantry. | Người xem hiểu đúng phạm vi. | Mở SYSTEM_ARCHITECTURE.md. |
| 7:45–8:45 | Register/Login bằng User demo nếu sẵn có | Phiên nằm trong HttpOnly Cookie, không lưu JWT ở localStorage. | Navbar/profile phản ánh phiên. | Không đăng nhập nếu thiếu account hợp lệ; chuyển sang mô tả tài liệu Auth. |
| 8:45–9:45 | Favorites/Review | User chỉ thao tác dữ liệu của chính mình; review công khai nhưng ownership được server kiểm tra. | Favorite/review hiện theo account demo. | Chỉ trình bày route/contract nếu không có môi trường ghi an toàn. |
| 9:45–10:45 | Meal Planner và Shopping List | Một tuần có7 ngày/3 bữa, nhiều món mỗi bữa và khẩu phần riêng. Shopping List cộng required cùng ID/đơn vị, không trừ Pantry. | Lịch SQL theo User, chuyển tuần/reload; thêm/sửa/xóa có xác nhận và tổng mua cập nhật sau API. | Chỉ ghi trên môi trường demo/tài khoản được phép; nếu chưa nghiệm thu luồng mới, trình bày contract và báo cáo thực tế. |
| 10:45–12:00 | Admin Dashboard nếu được phép | Admin có guard client và kiểm tra role từ SQL cho mọi API quản trị. | Dashboard/category/recipe management hiện theo quyền. | Nêu rõ Admin manual demo chưa thực hiện nếu không có account được phép. |
| 12:00–13:00 | Tạo/sửa recipe demo riêng nếu môi trường rollback | Aggregate recipe, ingredients và steps được lưu trong transaction. | Thành công toàn bộ hoặc rollback khi lỗi. | Không ghi seed/production; chuyển sang kết quả integration rollback. |
| 13:00–14:00 | Mở TEST_SUMMARY và database docs | Các suite tự động/SQL integrity đã có evidence; browser/HTTPS còn checklist riêng. | Bằng chứng và giới hạn minh bạch. | Dùng report Bước 11. |
| 14:00–15:00 | Kết luận | SmartCook hoàn thành các luồng trong phạm vi; next steps là HTTPS, performance và nghiệm thu browser đầy đủ. | Người xem nắm phạm vi bàn giao. | – |

## Lưu ý cho phần Admin

- Không có tài khoản Admin mặc định.
- Nếu chưa có Admin được ủy quyền, chỉ nói về source/API và test fixture rollback; không giả vờ đăng nhập Admin.
- Không chạy npm run admin:promote trong khi demo nếu chưa có phê duyệt rõ ràng.
- Không xóa review/công thức seed hoặc dữ liệu người dùng để minh họa thao tác xóa.
- Recipe đang có MealPlanItems cũng bị chặn xóa409; không xóa lịch để vượt ràng buộc khi demo.

## Phần demo Meal Planner sau khi kiểm thử liên quan đạt

1. Mở `/meal-planner`, chọn Tuần trước/Tuần này/Tuần sau và đối chiếu khoảng thứ Hai–Chủ nhật.
2. Trong môi trường demo được phép, thêm recipe có thật vào bữa trưa với khẩu phần4, rồi thêm một món khác cùng bữa. Không giả định có recipe ngoài catalog.
3. Mở Shopping List phía dưới; chỉ ra tổng tính từ khẩu phần gốc của từng recipe, các dòng khác đơn vị được tách và optional không nằm trong tổng.
4. Sửa khẩu phần hoặc chuyển ngày/tuần, xem lịch và danh sách mua đọc lại từ SQL. Tải lại để xác minh persistence.
5. Đánh dấu đã mua và sao chép; nói rõ dấu checkbox chỉ tạm trong frontend. Không khẳng định đã mua thật hoặc đã có đủ lượng ở nhà.
6. Mở Xem công thức/Bắt đầu nấu từ card và kiểm tra khẩu phần; tại RecipeDetail có thể thêm món vào lịch. Dữ liệu Favorites/Reviews và tiến độ nấu riêng món không bị xóa.

Pantry cũ không bị di chuyển sang lịch: `/api/pantry` và UserIngredients còn nguyên, giao diện tương thích ở `/legacy-pantry`. Chỉ trình bày kết quả browser/SQL thực sự đã chạy trong [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md), không tái sử dụng số Passed Bước11–12 cho chức năng mới.

## Kế hoạch dự phòng kỹ thuật

| Lỗi | Hành động an toàn |
| --- | --- |
| Frontend không tải | Kiểm tra Vite terminal, sau đó truy cập health API trực tiếp và trình bày API/documentation. |
| API/SQL lỗi | Chạy npm run check:db, kiểm tra SQL service/config local; không sửa .env hay database ngay trước hội đồng. |
| CSRF/Origin 403 | Kiểm tra URL frontend có trong CLIENT_ORIGIN và refresh CSRF theo flow app; không tắt middleware. |
| Account demo lỗi | Bỏ qua mutation, trình bày contract/test report, không reset mật khẩu/cấp role vội. |
| Thiếu quyền Admin | Giữ phần Admin ở mức kiến trúc/tài liệu và ghi nhận đúng là không demo live. |
d