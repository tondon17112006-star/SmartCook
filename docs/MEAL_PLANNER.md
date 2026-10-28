# Lịch nấu ăn 7 ngày

## Mục tiêu và quyền truy cập

Lịch nấu ăn giúp mỗi tài khoản chọn công thức có sẵn cho 7 ngày, chia thành bữa sáng, trưa và tối. Một bữa có thể chứa nhiều món. Lịch chính được đọc và ghi qua API tới SQL Server, không dùng localStorage làm nguồn dữ liệu.

Trang chính: `/meal-planner`. Trang có tham số `?weekStart=YYYY-MM-DD` để giữ tuần đang xem khi tải lại hoặc chia sẻ đường dẫn; dữ liệu vẫn luôn thuộc tài khoản đang đăng nhập. Guest phải đăng nhập; tài khoản Admin dùng lịch cá nhân theo cùng quy tắc với User. Quyền sở hữu được kiểm tra tại Backend, không tin UserID do trình duyệt gửi.

## Quy trình sử dụng

1. Đăng nhập rồi chọn **Lịch nấu ăn** trên thanh điều hướng.
2. Dùng **Tuần trước**, **Tuần này**, **Tuần sau** để chọn tuần. Tuần bắt đầu thứ Hai và kết thúc Chủ nhật. Hôm nay được đánh dấu theo `Asia/Ho_Chi_Minh`.
3. Nhấn **Thêm món** tại ngày/bữa mong muốn hoặc **Thêm món vào lịch** ở đầu trang.
4. Tìm công thức theo tên, lọc danh mục hoặc chọn tab **Món yêu thích**. Không bắt buộc phải yêu thích công thức trước khi thêm.
5. Chọn ngày, bữa và khẩu phần nguyên từ 1–20, sau đó nhấn **Thêm vào lịch**. Chỉ khi API xác nhận ghi thành công mới hiện thông báo thành công và tải lại lịch/danh sách đi chợ.
6. Nút sửa trên card cho phép đổi ngày, bữa hoặc khẩu phần. Chuyển sang ngày thuộc tuần khác sẽ đưa món tới tuần đích; món không còn hiển thị trong tuần nguồn.
7. Nút xóa mở hộp thoại xác nhận. Thao tác chỉ xóa mục trong lịch, giữ nguyên công thức, Favorites và Reviews.
8. Chọn **Xem công thức** hoặc **Bắt đầu nấu** để tiếp tục luồng RecipeDetail/Cooking Mode, kèm khẩu phần đã lên kế hoạch.

Khi đang lưu, nút lưu và đóng hộp thoại bị khóa để tránh gửi lặp. Nếu request thất bại, hộp thoại giữ nội dung đã nhập và hiển thị lỗi để sửa/thử lại. Có trạng thái đang tải, lịch trống, không có kết quả và lỗi với nút thử lại. Không báo lịch trống thay cho lỗi tải dữ liệu.

## Thống kê và Shopping List

Thống kê tuần lấy từ API: số mục món, số bữa có món, số ngày có kế hoạch và số IngredientID bắt buộc khác nhau. Một công thức ở hai ngày là hai mục trong lịch; không giả định là hai công thức khác nhau. Shopping List tổng hợp đúng số lần món xuất hiện và khẩu phần từng lần. Xem [SHOPPING_LIST.md](SHOPPING_LIST.md).

Mỗi lần thêm/sửa/xóa thành công, lịch và Shopping List đều được tải lại từ Backend. Dữ liệu không được cập nhật lạc quan trước khi SQL Server xác nhận ghi. Nếu lần tải lại thất bại, trang hiển thị lỗi tải và cho phép thử lại, dù thao tác ghi trước đó đã thành công.

## Ngày và phiên đăng nhập

Ngày lịch là chuỗi `YYYY-MM-DD`, không chuyển ngày DATE qua `new Date(dateString)` hoặc UTC. Phép cộng ngày hoạt động theo lịch Gregory, gồm năm nhuận, giao tháng và giao năm. Giới hạn giao diện/API dành cho tuần đủ 7 ngày: từ 01/01/0001 đến 26/12/9999; tuần cuối bắt đầu 20/12/9999.

Các trang và hộp thoại riêng được gắn với UserID + `sessionGeneration`. Khi phiên hoặc tài khoản đổi, request đang tải/lưu bị hủy, dữ liệu hiển thị, bản nháp và dấu “Đã mua” bị xóa khỏi giao diện. Không lưu JWT hoặc CSRF token vào localStorage.

## Pantry cũ và giới hạn

Sau khi luồng lịch mới qua React→HTTP→SQL được kiểm thử, Navbar dùng **Lịch nấu ăn** với icon CalendarDays tới `/meal-planner`. Route cũ `/pantry` được bảo vệ rồi redirect replace sang `/meal-planner`; giao diện cũ vẫn truy cập được trực tiếp tại **`/legacy-pantry`** sau đăng nhập, trong PantryProvider hiện có. Meal Planner không chuyển đổi hoặc xóa dữ liệu `UserIngredients`; Backend `/api/pantry` tiếp tục giữ nguyên. Không có thao tác di chuyển dữ liệu Pantry sang lịch.

Phạm vi hiện tại chưa có kéo thả, sao chép tuần, tự động chọn thực đơn, xuất PDF, lưu vĩnh viễn trạng thái đã mua, nhắc lịch hay đặt hàng. Sắp xếp món dùng thứ tự do API trả về, chưa có điều khiển kéo thả trên giao diện. Không trừ nguyên liệu Pantry hoặc thay đổi thuật toán Suggestions.

## Kiểm thử giao diện

Chạy trong `client`:

```powershell
node --test tests/meal-planner-dates.test.js tests/meal-planner.test.js
npm run lint
npm run build
```

Các bài DOM dùng React thật, React Router, Axios và adapter HTTP kiểm soát; kết quả SQL/integration và browser được báo riêng trong [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md). DOM test không chứng minh bố cục hiển thị trên trình duyệt thật.

Để chạy luồng React → HTTP → SQL Server, trong `client` dùng `npm run test:integration`. Bộ kiểm thử này có fixture SQL rollback riêng cho Meal Planner, không thay dữ liệu lịch bằng mock response. Các integration public có sẵn còn cần Backend local đang chạy. Chạy các suite SQL của client và server lần lượt để tránh chồng fixture/khóa trên database dùng chung. Trong `server`, `npm test` và `npm run test:integration` đã bao gồm các bài Meal Planner; không cần chạy migration để kiểm thử trên workspace đã có 12 bảng.

Checklist thủ công ở 375/768/1024/1440px: thanh điều hướng; chuyển tuần; đủ 7 ngày/3 bữa; không tràn ngang; card tên dài; hộp thoại có cuộn, focus và Escape; thêm/sửa/xóa; giữ dữ liệu sau reload; mở công thức/Cooking Mode đúng khẩu phần; Shopping List; phản hồi khi mất kết nối; tài khoản khác không thấy dữ liệu cũ.
