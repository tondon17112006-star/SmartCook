# Chi tiết món ăn — Bước 7

Ngày cập nhật: **18/10/2026**.

Route `/recipes/:id` được mở rộng từ trang chi tiết có sẵn thành công thức tương tác: xem thông tin món, đổi khẩu phần, đánh dấu nguyên liệu, hoàn thành bước và tiếp tục nấu trong cùng phiên. Dữ liệu món ăn, nguyên liệu, định lượng và hướng dẫn đều đến từ API đọc SQL Server hiện có. Bước này không thay đổi Backend, schema hoặc seed; không triển khai tài khoản, yêu thích hay Admin.

## Thành phần và tệp

| Tệp | Vai trò |
| --- | --- |
| `client/src/pages/RecipeDetailPage.jsx` | Trang hiện có được mở rộng; kiểm tra ID, tải công thức, breadcrumb, phần giới thiệu, nút bắt đầu/quay lại, kết nối trạng thái và Cooking Mode. |
| `client/src/components/ServingsSelector.jsx` | Thêm `variant="stepper"` với nút giảm/tăng 1–20 người. Biến thể select mặc định vẫn dùng cho luồng chọn nguyên liệu. |
| `client/src/components/RecipeIngredientChecklist.jsx` | Tên, lượng, đơn vị, bắt buộc/tùy chọn, ghi chú và checkbox đã chuẩn bị; bộ đếm lấy từ trạng thái thực. |
| `client/src/components/RecipeSteps.jsx` | Danh sách bước, ảnh nếu có, checkbox hoàn thành và tiến độ toàn công thức. |
| `client/src/components/RelatedRecipes.jsx` | Tải món liên quan bằng API danh sách, loại món hiện tại và dùng lại `RecipeCard`. |
| `client/src/components/CookingMode.jsx` | Giao diện tập trung vào một bước, điều hướng, hoàn thành, thoát và làm lại. |
| `client/src/components/CookingProgress.jsx` | Bộ đếm, phần trăm và thanh tiến độ có `role="progressbar"`. |
| `client/src/hooks/useRecipeCooking.js` | Kết nối model tiến độ, tương tác React và sessionStorage; trả định lượng và bước đã chuẩn hóa cho giao diện. |
| `client/src/utilities/recipeCooking.js` | Model/hàm thuần: validation, định lượng, sắp xếp bước, đối chiếu ID, khôi phục/ghi tiến độ và làm lại. |
| `client/src/components/SuggestionCard.jsx` | Truyền nguồn điều hướng, ID món và khẩu phần sang trang chi tiết bằng Router state. |
| `client/tests/recipeCooking.test.js` | Kiểm tra model, phép tính và dữ liệu phiên. |
| `client/tests/recipeDetail.test.js` | Kiểm tra DOM/tương tác, route, lỗi và khôi phục bằng các phản hồi HTTP kiểm soát trong test. |
| `client/tests/integration/recipeDetail.integration.test.js` | Kiểm tra tích hợp với API và SQL Server thật. |

Trang dùng lại `catalogService.getRecipe/getRecipes`, `useApiResource`, `RecipeImage`, `RecipeCard`, `RecipeSkeleton`, `LoadingSpinner`, `ErrorState` và `EmptyState`. Không tạo client API hay layout song song. Tài liệu liên quan: [Cooking Mode](COOKING_MODE.md), [báo cáo kiểm thử](RECIPE_DETAIL_VERIFICATION.md), [hợp đồng API](API.md).

## Dữ liệu và trình bày

`GET /api/recipes/:id` cung cấp tên, danh mục, mô tả, ảnh, thời gian chuẩn bị/chế biến/tổng, độ khó, khẩu phần gốc, `ingredients` và `steps`. Phần giới thiệu luôn thể hiện khẩu phần gốc, còn bộ chọn thể hiện số người đang nấu. Breadcrumb là **Trang chủ › Khám phá món ăn › Tên món**.

ID đường dẫn phải là chuỗi số nguyên dương không có số 0 đầu, tối đa `2147483647`. ID sai có thông báo tại Frontend và không gọi API. API trả 404 có trạng thái không tìm thấy; lỗi kết nối hoặc lỗi API có nút thử lại. Request được hủy khi đổi route; dữ liệu phản hồi cũ không được thay món mới. Trang thiếu nguyên liệu hoặc bước có thông báo riêng; nút **Bắt đầu nấu** bị vô hiệu khi không có bước hợp lệ. `RecipeImage` xử lý ảnh null hoặc tải lỗi bằng placeholder trung tính, không dùng ảnh món khác.

Mỗi nguyên liệu có checkbox với nhãn truy cập, tên, lượng, đơn vị, nhãn **Bắt buộc**/**Tùy chọn**, ghi chú nếu có và trạng thái **Đã chuẩn bị** khi chọn. Bộ đếm là số ID nguyên liệu đã chọn hợp lệ trên tổng danh sách hiện tại. Đây chỉ là checklist chuẩn bị, không suy luận người dùng có đủ số lượng trong bếp và không cập nhật công thức trong SQL Server.

Các bước được sắp xếp theo `stepNumber` tăng dần, dùng `stepId` phân định khi trùng số. Bước có ID không hợp lệ hoặc ID trùng bị loại; số bước không hợp lệ được đặt sau các số hợp lệ. Nội dung hướng dẫn và ảnh bước không được tạo giả. Mỗi checkbox có thể chọn hoặc bỏ chọn; trạng thái hoàn thành được mô tả bằng chữ và biểu tượng, ngoài màu sắc.

## Đổi khẩu phần và định lượng

Công thức tính cho từng nguyên liệu:

```text
AdjustedQuantity = OriginalQuantity × (SelectedServings / OriginalServings)
```

`OriginalQuantity`, `OriginalServings` luôn lấy trực tiếp từ phản hồi API đang mở. Mỗi lần tăng/giảm đều tính lại từ số gốc; không nhân chồng kết quả đã làm tròn. Model chuẩn hóa kết quả về tối đa 12 chữ số có nghĩa; giao diện dùng `Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 12 })`. Cách hiển thị này giữ được lượng dương rất nhỏ thay vì làm tròn thành 0. Đơn vị giữ từ công thức; không đổi g↔kg, ml↔l hoặc tự làm tròn số quả thành số nguyên. `ingredient.quantity` và DTO gốc không bị sửa.

- Lần mở trực tiếp đầu tiên chưa có tiến độ dùng khẩu phần API. Khẩu phần gốc lớn hơn 20 được chọn ban đầu là 20, có thông báo; mẫu số khi tính vẫn là khẩu phần gốc thực tế.
- Bộ chọn giới hạn số nguyên 1–20 và vô hiệu nút tại biên. Giá trị không hợp lệ không được nhận vào state.
- Khẩu phần gốc không phải số nguyên an toàn dương: vô hiệu điều chỉnh, thông báo rõ, giữ lượng gốc hợp lệ; không hiển thị `NaN` hoặc `Infinity`.
- Lượng gốc không phải số hữu hạn dương, hoặc kết quả không hữu hạn/dương: trả `null` và hiển thị **Định lượng chưa được cập nhật**. Không thay thế bằng 0.

Hướng dẫn trong SQL Server có thể chứa số lượng viết trong câu, ví dụ số quả trứng. Các câu này vẫn giữ nguyên theo công thức gốc; Frontend không thay số trong văn bản. Khi khẩu phần đã đổi, trang và Cooking Mode có thông báo để người dùng dùng lượng trong danh sách nguyên liệu đã điều chỉnh.

## Đi từ Suggestions và khôi phục phiên

Các liên kết công thức trong `SuggestionCard` truyền:

```js
{
  from: '/suggestions',
  recipeId: recipe.recipeId,
  suggestedServings: recipe.requestedServings ?? recipe.servings
}
```

Trang chỉ nhận khẩu phần gợi ý khi `from` đúng, `recipeId` là number nguyên trùng món đang mở và `suggestedServings` là số nguyên 1–20. Hook dùng `location.key` làm dấu lần điều hướng, lưu trong `lastSuggestionEntry`: lần vào mới từ Suggestions ưu tiên khẩu phần đó; reload cùng entry giữ thay đổi người dùng đã thực hiện tại trang chi tiết. Không lấy khẩu phần từ tên món, query tùy ý hoặc tiến độ món khác.

Nếu đã có tiến độ hợp lệ trong cùng phiên, mở trực tiếp khôi phục khẩu phần đã lưu thay vì ghi đè bằng mặc định API. `sessionStorage` dùng khóa riêng `smartcook:cooking:v1:<recipeId>`, chứa version, RecipeID, khẩu phần chọn, ID nguyên liệu đã chuẩn bị, ID bước hoàn thành, bước đang xem và dấu entry Suggestions. Không lưu token, mật khẩu, dữ liệu nhạy cảm hoặc bản sao nội dung công thức.

Khi đọc, model kiểm tra cấu trúc, version, kiểu/giới hạn ID và RecipeID. Dữ liệu hỏng hoặc lẫn món được bỏ, khởi tạo lại và có thông báo. Các ID bước/nguyên liệu không còn trong công thức hiện tại bị loại; bước đang xem mất đi thì về bước đầu hợp lệ. Tên, lượng và nội dung luôn lấy từ API mới tải. Nếu sessionStorage không khả dụng hoặc hết dung lượng, giao diện vẫn hoạt động trong bộ nhớ và báo rằng tiến độ có thể mất khi reload.

Reload khôi phục bước đang xem và checklist; người dùng nhấn **Bắt đầu nấu** để tiếp tục ở bước đó. Trạng thái đang mở giao diện Cooking Mode không được lưu riêng. Nút **Làm lại từ đầu** xóa checklist chuẩn bị và bước hoàn thành của món hiện tại, đưa bước đang xem về đầu, giữ khẩu phần đang chọn và ghi trạng thái mới vào phiên. Tiến độ các món khác và lựa chọn nguyên liệu ở `/ingredients` không bị xóa.

## Món liên quan và điều hướng

`RelatedRecipes` gọi `GET /api/recipes` với `categoryId` hiện tại nếu có, `limit=5`, `sort=newest`. Sau khi loại món đang mở và trùng ID, nếu còn ít hơn 3 món thì gọi thêm danh sách chung `limit=5`, `sort=newest`; giữ ưu tiên món cùng danh mục và bổ sung tối đa 4 món tổng cộng. Nếu không có kết quả thì ẩn phần này. Lỗi tải món liên quan có nút thử lại riêng và không thay trang chi tiết bằng màn hình lỗi.

Nút **Quay lại** đưa về `/suggestions` khi có Router state nguồn hợp lệ khớp món, các trường hợp khác về `/recipes`. Không dùng `navigate(-1)` vì lịch sử trước đó có thể thuộc trang ngoài. Khi thoát Cooking Mode, focus trở lại nút **Bắt đầu nấu**; trạng thái đã đánh dấu vẫn được giữ. Cooking Mode không tạo timer từ thời gian chuẩn bị hoặc chế biến tổng.

## Phạm vi và giới hạn

Bước 7 chỉ đọc API hiện tại và lưu tiến độ ở trình duyệt. Chưa có tiến độ đồng bộ tài khoản, lưu trên server, yêu thích, đăng nhập, Admin, quy đổi đơn vị, thay số trong câu hướng dẫn hoặc thời lượng từng bước. SessionStorage hỗ trợ reload trong cùng phiên tab; không được coi là lưu trữ bền vững hoặc đồng bộ giữa thiết bị. Kết quả lint/build/unit/integration và tình trạng kiểm thử trình duyệt được ghi riêng trong [báo cáo kiểm thử](RECIPE_DETAIL_VERIFICATION.md).
