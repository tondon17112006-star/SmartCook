# Món ăn yêu thích — Bước 9

`/favorites` có ProtectedRoute. Các trái tim trên RecipeCard, SuggestionCard và chi tiết dùng FavoriteProvider chung, lấy trạng thái thật từ SQL Server; không lưu dữ liệu yêu thích vào Web Storage.

| API | Kết quả |
| --- | --- |
| GET `/api/favorites?page=1&limit=12` | `{data,pagination}`, món mới lưu trước; tie-break FavoriteID giảm dần |
| GET `/api/favorites/ids` | `{data:[recipeId,...]}` của riêng tài khoản |
| POST `/api/favorites` | JSON `{recipeId}` số nguyên SQL INT; 201 `{data:{favoriteId,recipeId,createdAt}}` |
| DELETE `/api/favorites/:recipeId` | JSON `{}`, 200 `{message}`; không có liên kết của mình trả404 |

Tất cả endpoint yêu cầu phiên; mutation cần JSON, CSRF và Origin hợp lệ. UserID chỉ từ middleware, không nhận body/query để chọn người khác. Đăng ký luôn User và Admin cũng chỉ thao tác bộ sưu tập của mình. Thêm trùng trả409; ràng buộc UNIQUE(UserID,RecipeID) hiện có xử lý cả tranh chấp đồng thời. Không xóa Recipes.

Danh sách trả favoriteId/createdAt cùng recipeId/recipeName/description/imageUrl/prepTime/cookTime/totalTime/servings/difficulty/categoryName. Phân trang mặc định20, tối đa100; UI12 món/trang. GET ids không phân trang để đồng bộ trái tim. Response cá nhân no-store.

Khách nhấn trái tim chuyển login với đường dẫn nội bộ an toàn, không tự ghi sau login. Khi đăng nhập, tải một danh sách ID dùng chung; trạng thái chưa tải/lỗi không được coi là chưa lưu để toggle mù. Có thử lại, pending và chống double-click xuyên các nút cùng RecipeID. Chỉ đổi trạng thái sau API thành công; lỗi hiển thị rõ. Nếu409/404 do tab khác thay đổi, đọc lại trạng thái SQL.

Trang yêu thích có loading, lỗi/thử lại, rỗng và phân trang; bỏ món tại đây cần xác nhận. Logout/đổi phiên hủy request, xóa state trong bộ nhớ; response cũ không hiện dữ liệu tài khoản trước. Mutation đang chờ CSRF bị hủy khi đổi phiên để không ghi bằng cookie của phiên mới. Pantry/Cooking Mode giữ nguyên chính sách riêng.

Kiểm thử và giới hạn browser tại [STEP9_VERIFICATION.md](STEP9_VERIFICATION.md).
