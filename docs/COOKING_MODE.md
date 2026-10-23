# Chế độ nấu ăn và tiến độ trong phiên

Cập nhật: **18/10/2026** — phạm vi Bước 7.

Tổng quan trang và các component: [RECIPE_DETAIL.md](RECIPE_DETAIL.md). Kết quả kiểm thử thực tế và giới hạn kiểm chứng: [RECIPE_DETAIL_VERIFICATION.md](RECIPE_DETAIL_VERIFICATION.md).

## Cách sử dụng

1. Mở một công thức tại `/recipes/:id`, điều chỉnh số người ăn và đánh dấu nguyên liệu đã chuẩn bị.
2. Chọn **Bắt đầu nấu** để xem một bước tại một thời điểm. Bước được hiển thị theo `stepNumber` tăng dần từ API.
3. Dùng **Bước trước**, **Bước tiếp theo** hoặc các nút số bước để chuyển nội dung. Chuyển bước không tự đánh dấu hoàn thành; đánh dấu hoàn thành cũng không tự chuyển bước.
4. Chọn **Đánh dấu hoàn thành** hoặc **Bỏ đánh dấu hoàn thành** cho bước đang xem. Khi tất cả các bước được đánh dấu, giao diện hiển thị lời chúc mừng cùng lựa chọn xem toàn bộ công thức hoặc làm lại.
5. Chọn **Thoát chế độ nấu** hoặc **Xem toàn bộ công thức** để trở về trang đầy đủ, giữ nguyên tiến độ.

Đây là một vùng nội dung trong trang, không phải modal hoặc chế độ toàn màn hình. Navbar và Footer vẫn sử dụng được; không khóa focus trong vùng nấu ăn. Khi mở chế độ nấu, đổi bước hoặc hoàn thành toàn bộ công thức, focus được đưa tới tiêu đề tương ứng. Khi thoát, focus được trả về nút **Bắt đầu nấu** sau khi trang đầy đủ hiển thị lại.

Phím **Escape** chỉ thoát khi sự kiện bàn phím xuất phát trong vùng Cooking Mode. Escape tại Navbar không tự thoát chế độ nấu. Các nút có tên truy cập, trạng thái bước hiện tại dùng `aria-current="step"`; tiến độ có `role="progressbar"` và thông tin số bước bằng chữ.

Nếu công thức chưa có bước, nút bắt đầu bị vô hiệu hóa và có giải thích tiếng Việt. Không tạo hướng dẫn thay thế. Nội dung bước, số bước và ảnh bước đều lấy từ API. Chỉ hiển thị vùng ảnh bước khi có `imageUrl`; ảnh tải lỗi dùng placeholder trung tính hiện có, không lấy ảnh món khác để thay thế.

## Trạng thái và vòng đời

`useRecipeCooking` quản lý trạng thái của một công thức. `recipeCooking.js` chứa các hàm thuần để khởi tạo, kiểm tra, đối chiếu ID, tính định lượng và lưu/khôi phục trạng thái.

| Trường | Ý nghĩa |
| --- | --- |
| `recipeId` | ID món đang theo dõi. |
| `servings` | Số người ăn nguyên từ 1 đến 20; `null` nếu khẩu phần gốc không hợp lệ. |
| `preparedIds` | ID nguyên liệu được đánh dấu đã chuẩn bị. |
| `completedIds` | ID các bước đã hoàn thành. |
| `currentStepId` | ID bước đang xem; `null` khi không có bước. |
| `lastSuggestionEntry` | Khóa history entry đã áp dụng khẩu phần từ Suggestions, hoặc `null`. |

Tiến độ được lưu bằng `sessionStorage` theo khóa:

```text
smartcook:cooking:v1:<recipeId>
```

Ví dụ cấu trúc JSON dưới đây chỉ minh họa định dạng lưu; các ID trong giao diện luôn được lấy và kiểm tra theo phản hồi API, không dùng ví dụ làm dữ liệu ứng dụng:

```json
{
  "version": 1,
  "recipeId": 20,
  "servings": 4,
  "preparedIds": [9, 64],
  "completedIds": [77],
  "currentStepId": 78,
  "lastSuggestionEntry": "navigation-example"
}
```

Chỉ lưu các trường trên: không lưu tên món, tên nguyên liệu, hướng dẫn, ảnh, dữ liệu tài khoản hoặc dữ liệu nhạy cảm. Trạng thái thuộc phiên của tab và origin hiện tại, không được gửi để ghi vào SQL Server.

Khôi phục diễn ra ngay khi khởi tạo hook, trước lần ghi đầu tiên. Vì vậy dữ liệu đã lưu không bị giá trị mặc định ghi đè trong quá trình mở trang. Việc đổi món được kiểm tra theo phạm vi công thức và điều hướng trước khi commit; callback của phạm vi cũ không được cập nhật trạng thái món mới. Khóa lưu luôn được tạo từ chính `recipeId` của tiến độ.

Khi tải lại trang trong cùng phiên, trang đầy đủ xuất hiện với khẩu phần, checklist và bước đang xem đã được phục hồi. Trạng thái mở/đóng Cooking Mode không được lưu; chọn **Bắt đầu nấu** để tiếp tục tại bước đã lưu.

## Kiểm tra dữ liệu lưu

- Chấp nhận đúng `version: 1` và cấu trúc trường đã định nghĩa. ID phải là số nguyên dương trong giới hạn SQL `INT`, không ép chuỗi thành số; mảng ID không được trùng nhau.
- `recipeId` trong dữ liệu phải khớp món hiện tại. Mỗi món có khóa riêng, không nhập tiến độ của món khác.
- Sau khi tải công thức, chỉ giữ `preparedIds` còn trong danh sách nguyên liệu hiện tại và `completedIds` còn trong danh sách bước hiện tại. Nếu bước đang xem đã bị bỏ, chọn bước đầu tiên theo thứ tự mới; không có bước thì dùng `null`.
- JSON hỏng, phiên bản khác hoặc cấu trúc sai được bỏ qua an toàn, dùng tiến độ ban đầu và hiển thị thông báo. ID đã hết hiệu lực được loại bỏ cùng thông báo công thức thay đổi.
- Nếu trình duyệt chặn truy cập/lưu trữ hoặc hết dung lượng, người dùng vẫn đánh dấu và nấu bằng trạng thái trong bộ nhớ. Trang đầy đủ có thông báo rằng tiến độ có thể mất khi tải lại.

Thông báo tiến độ có nút **Ẩn thông báo tiến độ**. Nút này xóa thông báo hiện tại; thông báo không bị gắn lại chỉ vì render tiếp. Nếu một thao tác thay đổi tiến độ sau đó lại ghi storage thất bại, thông báo có thể xuất hiện lại. Thông báo lỗi storage không chứa nội dung ngoại lệ nội bộ của trình duyệt.

## Khẩu phần và ưu tiên từ Suggestions

Khi mở trực tiếp và chưa có tiến độ hợp lệ, chọn khẩu phần gốc từ API. Nếu đã có tiến độ hợp lệ cho món đó, giữ lựa chọn được lưu. Khẩu phần gốc là số nguyên dương lớn hơn 20 vẫn dùng làm mẫu số tính định lượng, nhưng lựa chọn ban đầu được giới hạn ở 20 và có thông báo rõ ràng.

Đường dẫn từ Suggestions truyền state chứa `from: '/suggestions'`, `recipeId` và `suggestedServings`. Trang chi tiết chỉ nhận khẩu phần nguyên từ 1 đến 20 khi ID món khớp. Hook dùng `location.key` làm `entryKey`:

- Một entry hợp lệ khác `lastSuggestionEntry` được ưu tiên áp dụng khẩu phần Suggestions, đồng thời lưu khóa entry đó.
- Reload cùng entry giữ khẩu phần mà người dùng đã tự chỉnh sau đó, không liên tục áp lại giá trị Suggestions.
- Giá trị Suggestions không hợp lệ bị bỏ qua. Không sửa khẩu phần chung của bộ chọn nguyên liệu khi chỉnh riêng tại trang chi tiết.

Mỗi lần tính định lượng đều đọc số gốc từ DTO API:

```text
AdjustedQuantity = OriginalQuantity × SelectedServings / OriginalServings
```

Kết quả được chuẩn hóa tối đa 12 chữ số có nghĩa; không lấy lượng đã hiển thị/làm tròn để nhân tiếp. Ví dụ đổi 2 → 4 → 3 người luôn tính lại từ công thức gốc cho 2 người. Giữ nguyên đơn vị, không tự đổi g sang kg hoặc ml sang l; giao diện định dạng số theo `vi-VN`.

Chỉ trả về định lượng hữu hạn và dương. Lượng không hợp lệ, kết quả tràn số hoặc về 0 do giới hạn số học dùng `null` và hiển thị **Định lượng chưa được cập nhật**; không đưa `NaN` hay `Infinity` ra giao diện. Số rất nhỏ còn biểu diễn được vẫn giữ giá trị dương thay vì làm tròn cố định về 0.

Nếu khẩu phần gốc bằng 0, thiếu, sai kiểu hoặc không phải số nguyên dương an toàn, tạm khóa bộ điều chỉnh và hiển thị cảnh báo. Khi đó giữ lượng gốc hợp lệ; lượng gốc sai vẫn dùng trạng thái chưa cập nhật. Nội dung bước nấu không tự sửa các con số trong câu: khi đổi khẩu phần, giao diện nhắc dùng định lượng đã điều chỉnh ở danh sách nguyên liệu.

## Tiến độ và làm lại

Số bước hoàn thành được đếm từ các ID hợp lệ đang được chọn. Phần trăm hiển thị là:

```text
Math.round(CompletedCount / TotalSteps × 100)
```

Nếu không có bước, phần trăm là 0 và không coi là hoàn thành toàn bộ. Số nguyên liệu đã chuẩn bị được tính riêng, không làm tăng tiến độ bước nấu.

**Làm lại từ đầu** chỉ xóa `preparedIds` và `completedIds` của món hiện tại, đưa `currentStepId` về bước đầu tiên. Khẩu phần đang chọn và `lastSuggestionEntry` được giữ để tránh đổi định lượng ngoài ý muốn hoặc áp lại khẩu phần Suggestions sau reload. Tiến độ các món khác và lựa chọn nguyên liệu ở Ingredients/Suggestions không bị xóa. Trạng thái đã làm lại được ghi thay thế vào đúng khóa món hiện tại; không gọi `sessionStorage.clear()`.

## Phạm vi chưa triển khai

Không có bộ đếm thời gian từng bước, tự chuyển bước, tự hoàn thành, wake lock hay toàn màn hình. `prepTime` và `cookTime` chỉ là thời gian ước tính của công thức, không được dùng để tạo timer giả. Không lưu tiến độ trên SQL Server, không đồng bộ giữa thiết bị và không bổ sung tài khoản, yêu thích hoặc Admin trong Bước 7.
