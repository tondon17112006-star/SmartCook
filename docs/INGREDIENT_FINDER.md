# Chọn nguyên liệu và gợi ý món — Bước 6

Ngày cập nhật: 17/10/2026. Hai route `/ingredients` và `/suggestions` thay trang thông báo Bước 5. Không sửa SQL Server, dữ liệu, hợp đồng API hoặc thuật toán gợi ý.

## Luồng sử dụng

1. Mở `/ingredients` — “Trong bếp bạn có gì?”. Catalog lấy từ API thật, nhóm theo `ingredientCategory` thực tế.
2. Tìm nguyên liệu có dấu hoặc chọn nhóm; nhấn card để chọn/bỏ chọn. Vùng “Nguyên liệu của bạn” có chip, nút bỏ từng loại, số đã chọn và Xóa tất cả.
3. Chọn “Số người ăn” từ 1–20, mặc định 2. Chưa chọn nguyên liệu hoặc chưa kiểm tra được catalog thì nút tìm bị disable.
4. Bấm “Tìm món ăn phù hợp” → `/suggestions`. Chọn “Thay đổi nguyên liệu” để quay lại mà vẫn giữ lựa chọn.
5. Xem tỷ lệ, số loại bắt buộc đã có/còn thiếu, nguyên liệu tùy chọn và định lượng theo khẩu phần; bấm Xem công thức tới `/recipes/:id`.

Desktop có grid và sidebar sticky bên phải; mobile có vùng lựa chọn trong luồng trang phía trên grid, không dùng overlay che nút. Chip có giới hạn chiều cao và cuộn riêng khi nhiều lựa chọn. Nhóm filter/radio/chip cho phép xuống dòng, tên dài có word wrap, ảnh dùng object-fit/aspect ratio. Card chọn là button `aria-pressed`, progress có số phần trăm và ARIA, radio/select/details là phần tử native; global focus và reduced motion từ Bước 5 giữ nguyên.

## State và khôi phục phiên

`App.jsx` dùng một `PantryProvider` cho hai route nguyên liệu/gợi ý. Các trang Home, Recipes, Detail và tài khoản không tải catalog nguyên liệu tự động.

`usePantry` cung cấp catalog, groups, selectedIds, selectedIngredients, servings, các thao tác chọn/bỏ/xóa, loading/error/retry, isReady và thông báo thay đổi lựa chọn. Provider khôi phục đồng bộ trước effect đầu tiên để không ghi đè lựa chọn đã lưu bằng mặc định.

Session key: `smartcook:pantry:v1`. Dạng dữ liệu:

```json
{
  "version": 1,
  "ingredientIds": [64, 18, 9],
  "servings": 4
}
```

ID trong ví dụ thuộc dữ liệu kiểm chứng, không hardcode trong logic ứng dụng. Production chỉ lưu ID và khẩu phần, không lưu bản sao món/nguyên liệu hoặc tên vào localStorage. ID phải là number nguyên dương SQL INT, không trùng, tối đa 100; khẩu phần number nguyên 1–20. JSON/version/shape không hợp lệ được reset và thông báo.

Catalog phải tải thành công **toàn bộ** trước khi đối chiếu ID. ID không còn tồn tại được bỏ và thông báo; tên/nhóm lấy lại từ DTO mới. Lỗi mạng không bỏ ID đã lưu. Retry hủy/vô hiệu request trước và đối chiếu lựa chọn mới nhất; generation guard được kiểm tra cả trong updater. Nếu storage bị chặn/quota lỗi, có thông báo không chặn thao tác; Context vẫn hoạt động trong nhóm route hiện tại, nhưng reload hoặc rời cây provider có thể mất lựa chọn.

## Nguyên liệu thật và tìm kiếm

`ingredientService.loadIngredientCatalog` gọi `GET /api/ingredients?page=...&limit=100`, lần lượt đọc tất cả trang. Kiểm tra page/limit/total/totalPages/flags, số DTO dự kiến, trùng ID, thay đổi total và schema. Tải thiếu/lỗi giữa chừng không xuất bản catalog một phần và không xóa ID của phiên.

Với catalog hoàn chỉnh, Frontend tìm chuỗi con trong tên, trim/NFC, không phân biệt hoa/thường và giữ phân biệt dấu; lọc nhóm kết hợp AND. Ký tự `%`, `_`, `[` không là wildcard/regex. Tìm/lọc diễn ra tại client trên **toàn bộ catalog**, không chỉ một trang API; vì vậy không có debounce/request mỗi lần gõ. Các nhóm là tập nhãn distinct từ catalog, sắp xếp tiếng Việt. Dữ liệu hiện tại: 64 nguyên liệu và 12 nhóm.

## Gợi ý và phân trang

`suggestionService.suggestRecipes` gọi `POST /api/recipes/suggest`, giữ envelope `{data, pagination}`. Request chỉ có `ingredientIds`, `servings`, `page`, `limit`, tất cả ID/tùy chọn số đúng kiểu; không gửi field filter chưa được Backend hỗ trợ. ID request được loại trùng/sắp xếp ổn định để lựa chọn có cùng tập ID không tạo key khác nhau.

`useSuggestions` dùng `useApiResource` từ Bước 5: AbortController + token, không lộ kết quả/lỗi cũ khi request mới bắt đầu, không để response đến muộn ghi đè. Không polling hoặc tự request theo mỗi lần render. Chọn nguyên liệu/khẩu phần khác tạo key mới, reset trang và trạng thái về Tất cả. Chưa chọn nguyên liệu thì không gọi POST.

- **Tất cả món phù hợp:** API phân trang 12 món, dùng total/totalPages/page của Backend. Nút trước/sau chặn giới hạn. Nếu dữ liệu co lại khiến page cũ vượt phạm vi, service tải trang cuối hợp lệ.
- **Đủ loại/Còn thiếu:** tải đủ tất cả kết quả API, tối đa 50 món/request, rồi lọc `status`. Kiểm tra số dòng/metadata/ID trùng trước khi công bố. Total sau lọc được tính từ tập hoàn chỉnh; xếp hạng Backend được giữ. Phân trang 12 món trong tập đã lọc. Đổi ready/missing hoặc page đã lọc dùng lại tập hoàn chỉnh, không gửi request mới.
- **Giới hạn 500 món để lọc:** nếu total lớn hơn 500, hoặc các trang không nhất quán, hiển thị thông báo/thử lại/quay về Tất cả; không trình bày tập thiếu như toàn bộ dữ liệu. Khi mở rộng, đề xuất Backend thêm filter status cùng count/pagination phía SQL Server ở một bước riêng. Bước 6 chưa sửa API.

POST 400 có thêm nút “Cập nhật danh sách nguyên liệu”, xử lý trường hợp ID bị xóa sau lần tải catalog đầu. Lỗi mạng/timeout/HTTP có thông báo và Thử lại. Không có món trả empty state hữu ích để chọn thêm nguyên liệu.

## Trình bày kết quả

`SuggestionCard` dùng `matchPercentage`, các số đếm và `status` thật. Progress: 100% xanh, 50–99% cam, dưới 50% trung tính; luôn có phần trăm bằng chữ. “Đủ loại nguyên liệu chính” dựa vào `status === 'ready'`, **không** suy từ điểm làm tròn và không xác nhận đủ gram/ml/quả thực tế.

Ba phần nguyên liệu dùng `matchedIngredients`, `missingIngredients`, `optionalIngredients` riêng. Hai phần bắt buộc luôn hiển thị; tùy chọn trong details và có Đã chọn/Chưa chọn theo `isAvailable`. Định lượng hiển thị trực tiếp `adjustedQuantity`, đơn vị API, `Intl.NumberFormat('vi-VN', {maximumSignificantDigits: 12})`; lượng nhỏ không bị ép thành 0. Không tự nhân khẩu phần lần nữa, không quy đổi đơn vị hoặc tự làm tròn số quả.

Ảnh NULL hoặc lỗi dùng neutral fallback của Bước 5, không gán ảnh món khác. API GET chi tiết vẫn trả định lượng **gốc**; từ Bước 7, giao diện chi tiết nhận khẩu phần đã chọn qua Router state và tính lại từ số gốc. Card gợi ý tiếp tục dùng adjustedQuantity của Backend. Xem [trang chi tiết](RECIPE_DETAIL.md).

## Tệp mới và cập nhật

| Nhóm | Tệp |
| --- | --- |
| Trang mới | `client/src/pages/IngredientFinder.jsx`, `Suggestions.jsx` |
| Component nguyên liệu | `IngredientCard.jsx`, `IngredientSearch.jsx`, `SelectedIngredients.jsx`, `ServingsSelector.jsx` trong `client/src/components` |
| Component gợi ý | `SuggestionCard.jsx`, `MatchProgress.jsx`, `IngredientStatusList.jsx`, `SuggestionSkeleton.jsx` trong `client/src/components` |
| Context/hooks | `context/PantryContext.js`, `context/PantryProvider.jsx`, `hooks/usePantry.js`, `hooks/useSuggestions.js` |
| Services | `services/ingredientService.js`, `services/suggestionService.js` |
| Utilities | `utilities/pantryState.js`, `utilities/ingredientFilters.js`, `utilities/suggestions.js` |
| Unit/DOM test | `tests/ingredientFilters.test.js`, `pantryState.test.js`, `ingredientService.test.js`, `suggestions.test.js`, `ingredientFlow.test.js`, `tests/helpers/IngredientFlowApp.jsx` |
| Integration test | `tests/integration/suggestions.integration.test.js`, `ingredientFlow.integration.test.js` |
| Mã có sẵn cập nhật | `client/src/App.jsx`, `client/src/pages/HomePage.jsx` |
| Scripts/dependency | `client/package.json`, `client/package-lock.json`: `test:integration`, jsdom dev dependency |
| Tài liệu | `README.md`, `PLAN.md`, `docs/architecture.md`, tài liệu này và `SUGGESTIONS_FRONTEND_VERIFICATION.md` |

Giữ nguyên Navbar/Footer/RecipeCard/RecipeImage/ErrorState/EmptyState/Pagination và hệ thống màu Bước 5, tái sử dụng vào luồng mới. Không triển khai tài khoản, Admin, yêu thích, lượng tồn, thay thế nguyên liệu hoặc API filter mới.
