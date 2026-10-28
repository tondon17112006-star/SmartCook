# Tổng quan dự án SmartCook

## Tên đề tài

SmartCook – website gợi ý món ăn từ nguyên liệu sẵn có.

## Lý do chọn đề tài

Người dùng thường có nguyên liệu nhưng khó xác định món phù hợp, lượng nguyên liệu cần thêm và các bước chế biến. SmartCook tập trung giải quyết bước khám phá này bằng catalog công thức, tìm kiếm/lọc và thuật toán đối chiếu nguyên liệu.

## Mục tiêu

1. Cung cấp dữ liệu công thức có cấu trúc, dễ tìm và đọc trên các kích thước màn hình phổ biến.
2. Gợi ý công thức từ IngredientID người dùng chọn, minh bạch tỷ lệ phù hợp và danh sách thiếu.
3. Cung cấp trải nghiệm cá nhân an toàn: tài khoản, Favorites, Reviews, Meal Planner và Shopping List; giữ Pantry cũ tương thích.
4. Cho phép Admin được ủy quyền quản lý catalog/nội dung qua API có kiểm tra quyền.

## Đối tượng sử dụng

| Đối tượng | Nhu cầu chính |
| --- | --- |
| Guest | Khám phá công thức, chọn nguyên liệu, xem gợi ý và đăng ký. |
| User | Lưu món, đánh giá, lên lịch 7 ngày, tổng hợp nguyên liệu cần mua; dữ liệu Pantry và gợi ý cũ vẫn được giữ. |
| Admin | Quản trị công thức, danh mục, nguyên liệu, đánh giá và theo dõi dashboard. |

## Phạm vi hiện có

- Public: Home, Recipes, Recipe Detail, Ingredients, Suggestions, Login và Register.
- Cá nhân: Profile, Favorites, Review, lịch nấu ăn và Shopping List của chính tài khoản. Navbar dẫn tới `/meal-planner`; `/pantry` redirect replace, giao diện cũ ở `/legacy-pantry` và API `/api/pantry` giữ nguyên.
- Admin: Dashboard; Recipes; Categories; Ingredients; Users chỉ đọc; Reviews có thể xem/lọc/xóa.
- Backend: REST API Express, SQL Server, validation, middleware xác thực/phân quyền và transaction cho thao tác aggregate.
- Database: 10 bảng nền trong schema.sql và hai bảng MealPlans/MealPlanItems từ migration 001 đã áp dụng ngày 27/10/2026, tổng 12 bảng; seed không tạo tài khoản Admin hoặc lịch mẫu. Máy mới cần schema → migration → seed → verify; workspace hiện tại không cần chạy lại migration.

## Ngoài phạm vi hiện tại

- Refresh token, remember me, khôi phục mật khẩu, xác minh email và session store đa instance.
- Upload ảnh hoặc tối ưu image CDN; ảnh hero chưa có ảnh responsive.
- Quy đổi đơn vị, theo dõi nhiều lô Pantry, tự trừ kho hoặc khẳng định đủ định lượng.
- Migration tự động trên database đã có, tự tạo tài khoản Admin hoặc đồng bộ dữ liệu SQL Server lên GitHub.
- Deployment production, HTTPS hạ tầng thật và SLA chịu tải.

## Tiêu chí thành công

Sản phẩm có thể cài trên máy phát triển theo tài liệu, chạy frontend/backend, kết nối SmartCookDB, thực thi các luồng đã có và tái hiện kết quả kiểm thử đã ghi. Những phần chưa nghiệm thu thủ công được giữ rõ là Not Tested thay vì suy ra từ unit test.

Các số kiểm thử Bước 11/12 là lịch sử bàn giao. Kết quả và giới hạn của thay đổi lịch nấu ăn nằm ở [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md).

## Tài liệu liên quan

- [Requirements](REQUIREMENTS.md)
- [System architecture](SYSTEM_ARCHITECTURE.md)
- [Use cases](USE_CASE.md)
- [Final project report](FINAL_PROJECT_REPORT.md)
d