# Admin Dashboard — Bước 10

Khu vực `/admin` có layout riêng, không dùng Navbar/Footer của website công khai. Sidebar dẫn tới tổng quan, món ăn, danh mục, nguyên liệu, người dùng, đánh giá, website và đăng xuất. Header hiển thị breadcrumb, tiêu đề và tài khoản hiện tại. Desktop dùng sidebar cố định; tablet thu gọn; mobile mở drawer. Bảng có vùng cuộn riêng.

## Dữ liệu

`GET /api/admin/dashboard` dùng truy vấn SQL Server thật, trả:

```text
data.totals: recipeCount, ingredientCount, categoryCount,
             userCount, reviewCount, favoriteCount
data.mostFavorited: tối đa 5 {recipeId, recipeName, count}
data.mostReviewed: tối đa 5 {recipeId, recipeName, count}
data.newestRecipes: tối đa 5 {recipeId, recipeName, createdAt}
```

Các số đếm chuyển `COUNT_BIG` thành number. Không có người dùng/đánh giá/yêu thích thì số đếm là 0, danh sách xếp hạng tương ứng rỗng. Xếp hạng đếm liên kết thật, hòa điểm theo RecipeID; món mới theo CreatedAt DESC, RecipeID DESC. Không có số liệu mẫu trong ứng dụng hoặc phụ thuộc biểu đồ mới.

Các trang gọi API qua Axios chung. Đọc có loading/error/retry/empty; mutation chỉ báo thành công khi máy chủ xác nhận. Request gắn với phiên hiện tại và bị hủy khi đổi phiên. Thông tin cũ không được ghi lên phiên đăng nhập mới. `401` từ mọi endpoint Admin được AuthProvider xử lý để yêu cầu đăng nhập lại.

## Các phần quản trị

| Đường dẫn | Chức năng |
| --- | --- |
| `/admin` | KPI và ba danh sách tổng quan |
| `/admin/recipes` | Tìm/lọc/sắp xếp/phân trang, sửa/xóa có xác nhận |
| `/admin/recipes/new` | Thêm công thức gồm nguyên liệu và bước nấu |
| `/admin/recipes/:id/edit` | Sửa công thức, định lượng và thứ tự bước |
| `/admin/categories` | CRUD, tìm kiếm và số món trong danh mục |
| `/admin/ingredients` | CRUD, tìm kiếm/lọc nhóm và đơn vị mặc định |
| `/admin/users` | Tìm kiếm, phân trang, xem hồ sơ; chỉ đọc |
| `/admin/reviews` | Lọc món/sao, phân trang và xác nhận xóa đánh giá |

Không có nút đổi quyền, đặt lại mật khẩu, xóa tài khoản hoặc upload ảnh. Ảnh dùng URL đã kiểm tra. Xem [quản lý công thức](ADMIN_RECIPES.md), [bảo mật](ADMIN_SECURITY.md) và [kết quả kiểm thử](STEP10_VERIFICATION.md).

## Kiểm tra thủ công

Khởi động Backend/Frontend theo README. Guest mở `/admin` sẽ đến đăng nhập; tài khoản User thấy thông báo 403. Để xem Dashboard, cần tài khoản đã được người quản lý cho phép cấp Admin qua CLI tương tác; không có tài khoản hoặc mật khẩu mặc định. Đợt lập trình này không chạy CLI cấp quyền.

Sau khi có Admin được phép, kiểm tra các cỡ 375/768/1024/1440px: drawer/sidebar, thứ tự focus, Escape/dialog, bảng cuộn riêng, nhãn thao tác, thông báo lỗi, tải lại trang và đăng xuất. Các kiểm thử DOM không thay cho kiểm tra trực quan bằng browser.
