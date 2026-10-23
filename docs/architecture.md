# Kiến trúc SmartCook

Bước 1 dựng nền tảng, Bước 2 bổ sung SQL Server, Bước 3–4 thêm API đọc và gợi ý qua `mssql/msnodesqlv8`. Bước 5 kết nối giao diện khám phá công thức vào các API đọc; không sửa Backend. Health cơ bản vẫn không mở kết nối database.

## Luồng hiện tại

```text
Trình duyệt → React + React Router (127.0.0.1:5173)
                ↓ pages → useApiResource → catalogService → Axios
             Vite proxy /api
                ↓
             Express (127.0.0.1:5000)
                ↓ route → controller → service
                ↓ connection pool mssql/msnodesqlv8
             SQL Server 2019 → JSON {data, pagination?}
```

Frontend gọi đường dẫn API tương đối để Vite proxy tới Backend trong môi trường phát triển. Có thể đổi API bằng cấu hình môi trường. CORS phía Backend chỉ cho phép origin được cấu hình.

`GET /api/health` cho biết tiến trình API đang phản hồi, không kiểm tra SQL Server hoặc JWT. Giao diện Home/Recipes/Detail gọi `/categories`, `/recipes`, `/recipes/:id`; khi Backend dừng, các phần dữ liệu hiển thị lỗi và nút thử lại. Hook hủy request cũ, dùng token để không hiển thị dữ liệu của bộ lọc trước. URL là nguồn bộ lọc, server thực hiện tìm/lọc/sắp xếp/phân trang.

## Trách nhiệm Frontend

- `pages`: các trang theo đường dẫn.
- `layouts`: khung giao diện dùng chung.
- `components`: thành phần giao diện tái sử dụng.
- `services`: Axios và các hàm gọi API.
- `hooks`: logic trạng thái và vòng đời React.
- `context`: trạng thái chia sẻ trong cây component.
- `assets`: tài nguyên giao diện được sử dụng.
- `utilities`: chuẩn hóa query theo hợp đồng Backend trước khi gọi API.

`MainLayout` chia sẻ Navbar/Footer, skip link và cuộn đầu trang. Các component API, skeleton, lỗi/rỗng và fallback ảnh được dùng lại ở Home/Recipes/Detail. Provider health cũ còn trong source nhưng không gắn vào cây ứng dụng để tránh request kiểm tra không cần thiết. Chi tiết thiết kế: [FRONTEND_DESIGN.md](FRONTEND_DESIGN.md).

Bước 6 thêm nhóm route `/ingredients` và `/suggestions` dưới `PantryProvider`. Provider tải đầy đủ catalog bằng `ingredientService`, đối chiếu ID đã lưu trong sessionStorage, cung cấp nhóm/DTO/lựa chọn mới cho hai trang. Những trang khác không tự tải catalog nguyên liệu. `useSuggestions` gọi POST theo lựa chọn; “Tất cả” phân trang server, các bộ lọc trạng thái tải đủ kết quả rồi lọc tại client (giới hạn 500). Context không thay cho SQL Server và không ghi dữ liệu tài khoản. Xem [luồng nguyên liệu](INGREDIENT_FINDER.md).

Bước 7 mở rộng RecipeDetail: `useRecipeCooking` dùng DTO GET làm nguồn định lượng, tính khẩu phần ở client và lưu các ID tiến độ dưới key riêng RecipeID trong sessionStorage. `SuggestionCard` chuyển khẩu phần qua Router state; history entry key ngăn reload ghi đè khẩu phần đã chỉnh. Checklist, bước đầy đủ và CookingMode cùng dùng một state; RelatedRecipes gọi API độc lập, ưu tiên danh mục, không viết SQL Server. Xem [trang chi tiết](RECIPE_DETAIL.md) và [vòng đời tiến độ](COOKING_MODE.md).

## Trách nhiệm Backend

- `config`: đọc và kiểm tra cấu hình môi trường.
- `routes`: khai báo đường dẫn HTTP.
- `controllers`: tiếp nhận request, chuyển kết quả service thành response.
- `services`: logic xử lý độc lập với request/response.
- `middlewares`: xử lý đường dẫn không tồn tại và lỗi tập trung.
- `utilities`: tiện ích nhỏ dùng trong hạ tầng ứng dụng.

Express app được tách khỏi phần mở cổng để thuận tiện kiểm tra và mở rộng. Không tự kết nối SQL Server lúc khởi động trong giai đoạn này.

## Phạm vi đã chuẩn bị

Backend đã có API đọc dữ liệu và `POST /api/recipes/suggest`. Luồng gợi ý đi qua validator → service truy vấn SQL/đếm/xếp hạng → helper phân nhóm nguyên liệu và điều chỉnh khẩu phần; không ghi dữ liệu. Xem [thuật toán](SUGGESTION_ALGORITHM.md) và [kết quả kiểm thử](SUGGESTION_VERIFICATION.md). Frontend đã có Home/Recipes/Detail/IngredientFinder/Suggestions; chỉ các route tài khoản và quản trị còn là thông báo chưa triển khai. Các bước sau thực hiện theo `PLAN.md` khi có yêu cầu.

Mỗi ứng dụng quản lý `package.json`, `package-lock.json` và `.env.example` riêng. Chạy lệnh npm trong đúng `client` hoặc `server`; thư mục gốc không có script npm chung.
