# Danh sách đi chợ

## Nguồn dữ liệu

Danh sách xuất hiện phía dưới lịch tại `/meal-planner#shopping-list`. API `GET /api/meal-plans/shopping-list?weekStart=YYYY-MM-DD` tính danh sách từ MealPlanItems của người đang đăng nhập, Recipes, RecipeIngredients và Ingredients. Tuần bắt đầu thứ Hai. Dữ liệu không lấy từ localStorage hoặc trừ `UserIngredients`.

Mặc định và phạm vi hiện tại chỉ gồm `IsRequired = 1`. Giao diện ghi rõ “nguyên liệu bắt buộc”; chưa có nút xem optional. Danh sách trống nếu tuần không có món.

## Quy tắc tính và gộp

Mỗi lần món xuất hiện trong lịch đóng góp:

```text
AdjustedQuantity = OriginalQuantity × PlannedServings / OriginalServings
```

`OriginalServings` lấy đúng từ Recipes, không giả định luôn bằng 2. Cùng món được lên ở nhiều ngày/bữa được cộng theo từng mục và từng khẩu phần. IngredientID giống nhau với cùng Unit mới được gộp. Đơn vị khác nhau nằm trên những dòng riêng; không tự đổi g/kg, ml/l hoặc cộng khối lượng với số quả. Không sửa RecipeIngredients gốc.

SQL trả `RecipeIngredients.Quantity` dạng text để giữ nguyên giá trị DECIMAL. Backend biểu diễn từng phần đóng góp dưới dạng phân số BigInt, cộng chính xác tất cả phần của một nhóm rồi **chỉ làm tròn lên một lần ở tổng cuối**, tối đa 6 chữ số thập phân. `totalQuantity` trả về là chuỗi decimal chuẩn, bỏ các số 0 thừa ở cuối. Ví dụ `1 × 1/3 + 1 × 4/3 = 5/3` trả `"1.666667"`; không làm tròn riêng từng lần nấu trước khi cộng.

Frontend định dạng chuỗi này sang dấu phẩy thập phân của tiếng Việt, không chuyển qua Number gây mất chính xác khi tổng lớn. Hai đơn vị khác hoa/thường hoặc khác chuỗi vẫn là hai nhóm; ứng dụng không tự chuẩn hóa đơn vị để gộp. Quy tắc tính và kết quả test được ghi trong tài liệu xác minh.

Mỗi dòng gồm tên nguyên liệu, tổng số lượng, đơn vị, nhóm nguyên liệu và tên món liên quan. Thống kê “loại nguyên liệu” đếm IngredientID khác nhau; số dòng mua có thể lớn hơn khi một IngredientID xuất hiện với nhiều đơn vị.

## Dấu đã mua

Checkbox **Đã mua** chỉ tồn tại trong bộ nhớ frontend. Nó được đặt lại khi:

- Đổi tuần.
- Thêm, sửa hoặc xóa món làm tải lại danh sách.
- Tải lại trang.
- Đăng xuất, đổi tài khoản hoặc đổi phiên đăng nhập.

Đây không phải dữ liệu đã được lưu vào SQL Server. Không có thêm bảng trạng thái đã mua và không dùng localStorage để giả lập lịch chính. Số dòng đã đánh dấu được hiển thị thật theo checkbox hiện tại.

## Sao chép

**Sao chép danh sách** gọi Clipboard API và chỉ báo thành công sau khi Promise ghi clipboard hoàn thành. Nếu trình duyệt từ chối hoặc không cung cấp Clipboard API, trang mở ô văn bản chỉ đọc, focus và chọn nội dung để người dùng sao chép thủ công; không báo sao chép thành công giả.

Nội dung sao chép gồm khoảng tuần, nhãn nguyên liệu bắt buộc, tên, định lượng, đơn vị và `[x]`/`[ ]` phản ánh dấu đã mua tạm. Clipboard API có thể yêu cầu localhost hoặc HTTPS. Không có chức năng mua hàng trực tuyến.

## Đồng bộ và lỗi

Danh sách được đọc lại sau mỗi ghi lịch thành công. Có loading, empty, error và retry độc lập với lịch. Nếu API lỗi, không hiển thị các tổng cũ như dữ liệu đã đồng bộ. Request bị hủy và trạng thái bị xóa khi phiên/tài khoản thay đổi.

Các kiểm thử tự động gồm tính chính xác/đơn vị/required tại Backend; frontend gồm hiển thị chuỗi decimal lớn, cập nhật sau thêm/sửa/xóa, checkbox tạm, sao chép thành công, fallback và hủy request theo phiên. Xem [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md) để biết phần nào đã thực sự chạy.
