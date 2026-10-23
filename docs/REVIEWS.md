# Đánh giá công thức — Bước 9

Phần **Đánh giá món ăn** nằm tại `/recipes/:id`, ngoài Cooking Mode. Khách đọc danh sách/điểm trung bình; người đăng nhập tạo, sửa và xác nhận xóa đánh giá của chính mình. Không có quyền quản lý đánh giá người khác hoặc Admin Dashboard.

| API | Yêu cầu/kết quả |
| --- | --- |
| GET `/api/recipes/:id/reviews?page=1&limit=20` | Công khai, `{data,pagination,summary:{averageRating,reviewCount}}` |
| GET `/api/recipes/:id/reviews/mine` | Có phiên, `{data:review hoặc null}`, tìm đánh giá của mình dù ở trang khác |
| POST `/api/recipes/:id/reviews` | Phiên/CSRF/Origin, JSON rating/comment; 201 `{data:review}` |
| PATCH `/api/reviews/:reviewId` | Chỉ chủ sở hữu, ít nhất rating hoặc comment; 200 `{data:review}` |
| DELETE `/api/reviews/:reviewId` | Chỉ chủ sở hữu, JSON `{}` và CSRF/Origin; 200 `{message}` |

Mỗi người/món một dòng, UNIQUE(UserID,RecipeID) đã tồn tại, không cần migration. Trùng trả409, món không tồn tại404. Sửa/xóa ID không thuộc mình trả404 nhằm không tiết lộ sự tồn tại dữ liệu. Không cho đổi UserID/RecipeID qua PATCH; không nhận trường thừa.

Rating bắt buộc khi tạo, JSON number nguyên1–5. Comment tùy chọn/null, trim và NFC, rỗng thànhnull, tối đa2.000 UTF-16 units; không nhận ký tự điều khiển ngoài tab/xuống dòng. Bình luận là văn bản: chuỗi giống HTML/script không được thực thi; React không dùng dangerouslySetInnerHTML. SQL luôn bind tham số. API trả reviewId/recipeId/userId/fullName/rating/comment/createdAt, không email, phone hoặc PasswordHash.

Danh sách mới nhất theo CreatedAt rồi ReviewID giảm dần; mặc định20, tối đa100 mỗi trang. Summary tính toàn bộ đánh giá của món, không chỉ trang hiện tại, làm tròn2 chữ số; không có đánh giá thì điểm0/lượt0 và UI thông báo chưa có đánh giá. Sửa giữ CreatedAt hiện có vì schema không có UpdatedAt.

Form dùng radio sao có nhãn bàn phím, textarea, pending và thông báo thật từ API. Trước khi cho tạo mới, tải `/mine`; lỗi không được coi là chưa đánh giá. Tạo/sửa/xóa thành công tải lại summary/danh sách. Thất bại giữ draft và cho thử lại; đổi tài khoản/phiên hủy request và không để lại draft/data của người trước. Chưa làm kiểm duyệt, chống spam nội dung hoặc quản trị đánh giá.

Kiểm thử và phần chưa kiểm chứng tại [STEP9_VERIFICATION.md](STEP9_VERIFICATION.md).
