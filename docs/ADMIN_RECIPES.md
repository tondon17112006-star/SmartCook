# Quản lý món ăn và công thức — Bước 10

## Lưu công thức

Admin dùng `/admin/recipes/new` hoặc `/admin/recipes/:id/edit`. Body JSON gồm `recipeName`, `categoryId`, `description`, `imageUrl`, `prepTime`, `cookTime`, `servings`, `difficulty`, `ingredients`, `steps`. `POST` cần đầy đủ trường bắt buộc; `PATCH` cho phép cập nhật một phần. Các trường không gửi khi PATCH được giữ lại. Không nhận CreatedBy hoặc Role từ client.

```json
{
  "recipeName": "Tên món mới",
  "categoryId": 1,
  "description": null,
  "imageUrl": null,
  "prepTime": 5,
  "cookTime": 10,
  "servings": 2,
  "difficulty": "Dễ",
  "ingredients": [
    {"ingredientId": 1, "quantity": 2, "unit": "quả", "isRequired": true, "notes": null}
  ],
  "steps": [{"stepNumber": 1, "instruction": "Hướng dẫn chế biến.", "imageUrl": null}]
}
```

ID trong ví dụ chỉ minh họa; phải chọn danh mục/nguyên liệu thật từ catalog. Không chạy body mẫu để sửa dữ liệu hiện có.

Validation Backend kiểm tra:

- Tên NFC/trim, 1–200 ký tự; mô tả tối đa 10.000 ký tự.
- CategoryID và IngredientID tồn tại, là SQL INT dương.
- Thời gian là INT không âm, tổng lớn hơn 0; khẩu phần INT dương; độ khó `Dễ`, `Trung bình`, `Khó`.
- Từ 1–200 nguyên liệu, không trùng IngredientID, có ít nhất một nguyên liệu bắt buộc.
- Quantity number dương tối đa 9999999999.99 và tối đa hai số thập phân; unit 1–30 ký tự; isRequired boolean; notes tối đa255 ký tự.
- Từ 1–100 bước, stepNumber đúng vị trí liên tiếp từ1; instruction 1–10.000 ký tự; không nhận stepId để sửa công thức khác.
- URL tối đa500 ký tự: http/https không chứa credentials hoặc đường dẫn `/...`; chặn URL thực thi, protocol-relative, backslash và ký tự trắng/điều khiển.
- Không nhận trường thừa. PATCH kiểm tra cả trạng thái ghép với dữ liệu hiện có.

Recipes, RecipeIngredients và CookingSteps được lưu trong một SQL Transaction. Production dùng SERIALIZABLE; mọi truy vấn dùng tham số, sort chọn từ whitelist. CreatedBy lấy từ tài khoản đã được Backend xác thực. Lỗi bất kỳ bước ghi nào rollback toàn bộ. Khi thay mảng nguyên liệu hoặc bước, các dòng con được thay trong cùng transaction; StepID có thể thay đổi. Cooking Mode hiện có tự đối chiếu các bước mới khi tải lại.

## Xóa và ràng buộc

Xóa cần hộp xác nhận trên UI, JSON `{}`, cookie, CSRF và Origin hợp lệ. Backend kiểm tra trong transaction:

- Món có Favorites hoặc Reviews: trả409, giữ nguyên món và liên kết.
- Món không có hai liên kết trên: xóa CookingSteps, RecipeIngredients rồi Recipes atomically.
- Foreign key hiện hữu tiếp tục có hiệu lực; không bật CASCADE hoặc bỏ constraint.

Không thêm soft-delete hoặc migration. Nếu sau này cần ẩn món có liên kết, thiết kế trạng thái hiển thị và tác động đến API/gợi ý trước khi thay schema.

Danh mục đang có món không xóa được. Nguyên liệu đang thuộc RecipeIngredients hoặc UserIngredients không xóa được. Sửa tên/nhóm/đơn vị mặc định không thay Quantity/Unit đã lưu trong công thức hoặc tủ cá nhân. Tên danh mục/nguyên liệu trùng theo collation SQL trả409, lỗi FK được xử lý an toàn.

## Ảnh hưởng API công khai

Món mới hợp lệ được API danh sách/chi tiết đọc từ cùng bảng hiện có. Thuật toán gợi ý vẫn tính theo danh tính nguyên liệu bắt buộc, không theo số lượng trong tủ; định lượng được đổi theo khẩu phần khi hiển thị. Không thay công thức tính điểm hoặc thứ tự xếp hạng cũ.

Các test SQL tạo dữ liệu riêng trong transaction rồi rollback, không chỉnh sửa20 món mẫu. Xem [STEP10_VERIFICATION.md](STEP10_VERIFICATION.md) để biết các luồng thực tế đã chạy và giới hạn.
