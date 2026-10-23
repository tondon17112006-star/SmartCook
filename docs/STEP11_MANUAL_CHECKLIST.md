# Checklist kiểm thử thủ công Bước 11 — SmartCook

Ngày lập: **23/10/2026**. Đối chiếu kết quả tự động và số liệu API/SQL tại [STEP11_TEST_REPORT.md](STEP11_TEST_REPORT.md). Quy tắc nghiệp vụ tham chiếu [API.md](API.md), [COOKING_MODE.md](COOKING_MODE.md), [MY_PANTRY.md](MY_PANTRY.md), [ADMIN_RECIPES.md](ADMIN_RECIPES.md) và [ADMIN_SECURITY.md](ADMIN_SECURITY.md).

**Toàn bộ ca trong checklist này hiện là Not Tested bằng trình duyệt thật.** Rà soát source và test jsdom không chứng minh được kích thước, màu, chính sách cookie trong browser, console/network thật hoặc trải nghiệm bàn phím thực tế. Chỉ chuyển ca sang Passed sau khi thực hiện đầy đủ; ghi Failed nếu kết quả khác mong đợi. Trường hợp thiếu điều kiện giữ Not Tested, ghi rõ lý do. Không lấy kết quả tự động điền thay kết quả thủ công.

## Chuẩn bị và cách ghi bằng chứng

1. Tại `server` chạy `npm run dev`, tại `client` chạy `npm run dev`; mở `http://127.0.0.1:5173`. Dùng cùng hostname để tránh nhầm cookie/Origin giữa `localhost` và `127.0.0.1`. Không sửa JWT, HMAC hoặc CSRF để thử.
2. Ghi ngày giờ, tên/phiên bản browser, hệ điều hành, kích thước viewport theo CSS pixel, mức zoom, URL và ID món/danh mục/nguyên liệu đang dùng. Xem số liệu database/API hiện tại trước khi so sánh; không giả định ID cố định hoặc IDENTITY liên tục.
3. Ca chỉ đọc có thể dùng dữ liệu hiện có. Ca ghi tài khoản, hồ sơ, yêu thích, đánh giá, pantry và quản trị phải dùng **database kiểm thử riêng hoặc harness có transaction rollback được xác minh**. Không tạo dữ liệu thử qua browser trên database chính rồi xóa dữ liệu khác để cleanup. Nếu chưa có môi trường ghi an toàn, giữ các ca đó Not Tested; xem bằng chứng tự động rollback trong báo cáo.
4. Cần hai User fixture độc lập A/B cho quyền sở hữu. Không có Admin mặc định. Ca Admin cần fixture trong harness kiểm thử cô lập hoặc tài khoản đã được chủ dự án cho phép cấp quyền. Không tự chạy CLI cấp quyền hoặc thêm bypass vào runtime để mở giao diện.
5. Mở DevTools Console và Network; bật Preserve log khi thử điều hướng. Ảnh/bằng chứng không được chứa cookie, token, mật khẩu, HMAC/JWT secret, PasswordHash, email hoặc số điện thoại thật. Chỉ ghi mã phản hồi, tên header và có/không; không sao chép giá trị nhạy cảm.
6. Sau mỗi ca ghi, đối chiếu dữ liệu của riêng fixture và xác nhận rollback/cleanup an toàn. Cuối đợt so sánh dữ liệu trước/sau theo báo cáo; không DROP/TRUNCATE, reseed hoặc sửa 20 món gốc.

Mẫu ghi kết quả cho mỗi mã: `Ngày giờ — browser/viewport — dữ liệu fixture — thao tác — HTTP/UI quan sát — bằng chứng đã che dữ liệu — Passed/Failed/Not Tested — mã lỗi nếu có`.

## 18 đường dẫn cần nghiệm thu

Mỗi dòng dưới đây cần thử thêm reload trực tiếp URL, Back/Forward và điều hướng bằng menu khi áp dụng. Với trang có API, thử kết nối bình thường, chặn request bằng DevTools để xem lỗi/retry, và dữ liệu rỗng trong môi trường fixture. Không dừng SQL Server thật để tạo lỗi.

| Mã | Route và điều kiện trước | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế / trạng thái |
| --- | --- | --- | --- | --- |
| QA11-R01 | `/`, Guest hoặc User | Mở trang chủ; xem danh mục/món mới; nhấn CTA công thức và nguyên liệu; chặn một API rồi thử lại; cho một URL ảnh lỗi | Navbar/Footer đúng; dữ liệu từ API; từng khối có loading/error/empty riêng; CTA mở đúng trang; ảnh lỗi có placeholder, không méo hoặc phá bố cục | Chưa chạy browser — **Not Tested** |
| QA11-R02 | `/recipes`, có công thức | Tìm tên tiếng Việt; kết hợp danh mục/thời gian/độ khó; đổi từng sort; sang trang tiếp, Back/Forward, reload; thử `?page=999`; xóa bộ lọc | URL, ô tìm và bộ lọc nhất quán; page reset khi đổi filter; kết quả từ API; trang ngoài phạm vi có hành động về trang đầu; không kết quả cũ ghi đè kết quả mới | Chưa chạy browser — **Not Tested** |
| QA11-R03 | `/recipes/:id`, ID hợp lệ | Mở công thức; xem ảnh/thông tin/nguyên liệu/bước; thử ID sai định dạng và ID không tồn tại; đổi khẩu phần/checklist/Cooking Mode | Công thức đúng ID, định lượng theo khẩu phần; ID sai có thông báo hữu ích, không màn hình trắng; lỗi API có retry; tiến độ không lẫn món khác | Chưa chạy browser — **Not Tested** |
| QA11-R04 | `/ingredients`, catalog có dữ liệu | Tìm tên có dấu; lọc nhóm; chọn/bỏ/chip/xóa tất cả; đổi khẩu phần; thử lựa chọn trống; kiểm tra giới hạn 100 loại bằng fixture | Nhóm lấy từ catalog đầy đủ; lựa chọn nhất quán, lưu phiên; trống không gửi gợi ý; giới hạn có thông báo; lỗi catalog không cho dùng danh sách thiếu | Chưa chạy browser — **Not Tested** |
| QA11-R05 | `/suggestions`, có lựa chọn | Xem tỷ lệ, đã có/còn thiếu, khẩu phần; đổi all/ready/missing; phân trang; đổi nguyên liệu nhanh; mở khi lựa chọn trống | Số lượng/status đúng API và toàn tập khi lọc; không dùng tỷ lệ làm tròn thay cho status; lượng hiển thị đúng; không khẳng định đủ số lượng trong bếp; trống/lỗi có hành động phù hợp | Chưa chạy browser — **Not Tested** |
| QA11-R06 | `/login`, Guest, User fixture tồn tại | Thử email/mật khẩu sai; bật/tắt hiện mật khẩu; đăng nhập đúng; nhấn lặp khi pending; rời form trước phản hồi chậm | Validation/focus hợp lý; sai có lỗi, đúng khôi phục đích nội bộ; không ghi token vào Web Storage; không gửi lặp; form đã rời không chiếm lại điều hướng khi phản hồi tới muộn | Chưa chạy browser — **Not Tested** |
| QA11-R07 | `/register`, Guest, môi trường ghi an toàn | Thử tên/email/mật khẩu/xác nhận sai; đăng ký email mới; thử trùng email; rời form trong lúc chờ | Chỉ gửi trường công khai, role không chỉnh được; thành công yêu cầu đăng nhập riêng; lỗi không mất bản nháp; phản hồi muộn không kéo người dùng về Login sau khi họ đã chuyển trang | Chưa chạy browser — **Not Tested** |
| QA11-R08 | `/profile`, User A | Guest mở URL; User A sửa tên/điện thoại hợp lệ, sai rồi sửa lại; reload; thử lỗi lưu | Guest đến Login và giữ đích; email/role chỉ đọc; chỉ lưu fullName/phone; lỗi giữ bản nháp, thành công sau API; Navbar đồng bộ tên; không lộ hash | Chưa chạy browser — **Not Tested** |
| QA11-R09 | `/favorites`, User A có/không có favorites | Thêm tim ở card/detail; mở Favorites; thử trang tiếp; bỏ tim, hủy rồi xác nhận; thử lỗi; logout/login B | Danh sách riêng A; mọi tim đồng bộ sau API; xác nhận bỏ trên trang Favorites; lỗi không giả thành công; B không thấy dữ liệu/bản nháp của A; rỗng có CTA công thức | Chưa chạy browser — **Not Tested** |
| QA11-R10 | `/pantry`, User A, catalog hợp lệ | Thêm nguyên liệu; tìm/select; sửa số lượng/đơn vị/ngày; bỏ trống trường nullable; thử số âm/trùng; hủy/xác nhận xóa; tìm món | Validation, pending, lỗi và thông báo chính xác; không đổi loại khi sửa; phân loại hạn dùng theo Việt Nam; truyền loại còn dùng được và giữ khẩu phần; không suy ra đủ lượng | Chưa chạy browser — **Not Tested** |
| QA11-R11 | `/admin`, Guest/User/fixture Admin | Thử cả ba nhóm; Admin đối chiếu 6 KPI/top 5; thử bảng Users/Reviews rỗng trong fixture; lỗi Dashboard; mobile logout lỗi rồi retry | Guest đến Login, User 403, Admin được phép qua Backend; layout riêng; số SQL đúng, 0 là 0; có retry; lỗi logout nằm trong drawer đang mở và giữ phiên để thử lại | Chưa có browser/điều kiện Admin được phép — **Not Tested** |
| QA11-R12 | `/admin/recipes`, fixture Admin | Tìm tên, lọc danh mục, thử 5 sort/page/Back/Forward; mở sửa; nhấn xóa rồi hủy; thử món có Favorite/Review | Bảng đúng tên/ảnh/danh mục/thời gian/khẩu phần/độ khó/ngày; bộ lọc lấy API; xác nhận trước xóa; 409 giữ món; bảng chỉ cuộn trong vùng của nó | Chưa có browser/fixture Admin tương tác — **Not Tested** |
| QA11-R13 | `/admin/recipes/new`, môi trường ghi an toàn | Thử form trống/thời gian âm/khẩu phần 0; nguyên liệu trùng, định lượng sai, toàn optional hoặc không bước; thêm/xóa dòng; sắp xếp bước; lưu hợp lệ | Validation rõ và focus đúng; ít nhất một nguyên liệu bắt buộc/một bước; số bước liên tiếp; API lưu cả aggregate; pending chặn gửi lặp, chỉ báo thành công khi API thành công | Chưa có browser/fixture Admin tương tác — **Not Tested** |
| QA11-R14 | `/admin/recipes/:id/edit`, món fixture | Load dữ liệu; đổi metadata/nguyên liệu/bước; hủy, load lại; lưu; thử lỗi máy chủ an toàn; xem lại API công khai | Hủy không ghi; lỗi giữ bản nháp; không gửi cột readonly/StepID; cập nhật nhất quán, không công thức nửa vời; món công khai phản ánh dữ liệu đã lưu | Chưa có browser/fixture Admin tương tác — **Not Tested** |
| QA11-R15 | `/admin/categories`, fixture Admin | Tìm/phân trang/xem số món; thêm/sửa tên/mô tả/URL; thử tên trùng, trống và URL sai; xóa danh mục rỗng/đang có món | DTO thật; lỗi 400/409 có thông báo; danh mục đang dùng không bị xóa, không xóa món dây chuyền; hủy dialog không ghi | Chưa có browser/fixture Admin tương tác — **Not Tested** |
| QA11-R16 | `/admin/ingredients`, fixture Admin | Tìm tên, lọc nhóm; thêm/sửa đơn vị/URL; thử tên trùng; xóa nguyên liệu rỗng và có RecipeIngredients/UserIngredients tham chiếu | Không trùng tên; group filter đúng; đổi đơn vị mặc định không sửa định lượng món đã lưu; dữ liệu đang dùng bị chặn 409; thành công sau API | Chưa có browser/fixture Admin tương tác — **Not Tested** |
| QA11-R17 | `/admin/users`, fixture Admin | Tìm tên/email, lọc role, phân trang; mở hồ sơ cơ bản rồi đóng/Escape | Chỉ đọc, tên/email/role/ngày đúng; không PasswordHash; không nút đổi role/reset/xóa; chi tiết có loading/error/retry; đóng trả focus đúng | Chưa có browser/fixture Admin tương tác — **Not Tested** |
| QA11-R18 | `/admin/reviews`, fixture Admin | Tìm/lọc món/sao/page; xem bình luận có ký tự HTML; xóa rồi hủy/thử lỗi/xác nhận | HTML là văn bản; danh sách/filter đúng; không xóa trước xác nhận; lỗi giữ review; API thành công mới thông báo; công thức giữ nguyên; User không gọi được API Admin | Chưa có browser/fixture Admin tương tác — **Not Tested** |

## Sáu luồng nghiệp vụ xuyên suốt

### QA11-F01 — Gợi ý từ trứng gà, dầu ăn và cà chua

**Điều kiện:** API/SQL đang hoạt động, lấy ID theo tên từ catalog hiện tại; dùng dữ liệu thật khi chỉ đọc. **Trạng thái: Not Tested bằng browser.**

1. Mở Ingredients, chọn đúng ba loại trên, chọn 2 người, nhấn tìm món; xác nhận request POST suggest chứa ID dạng số, servings/page/limit hợp lệ, không chứa tên thay ID.
2. Đối chiếu tổng số món, thứ tự và các tỷ lệ với số đo API/SQL trong báo cáo Bước 11. Không lấy con số trong tài liệu cũ làm oracle nếu dữ liệu đã khác.
3. Với ít nhất một món đủ và một món thiếu, đối chiếu từng nguyên liệu bắt buộc, đã có/còn thiếu, số loại và tỷ lệ. Nguyên liệu tùy chọn không làm món từ ready thành missing.
4. Chuyển trang; lọc ready/missing, xác nhận tổng được lọc trên toàn tập và không bỏ món ở trang sau. Tỷ lệ làm tròn 100% không tự thay thế status của API.
5. Quay về đổi nguyên liệu nhanh trong Network Slow connection rồi quay lại; kết quả cũ không ghi đè lựa chọn mới. Không phát sinh chuỗi request vô hạn.

**Mong đợi:** dữ liệu từ API thật, thống kê/lọc/phân trang nhất quán, có cảnh báo chỉ so loại nguyên liệu; chưa khẳng định bếp đủ định lượng.

### QA11-F02 — Chi tiết, khẩu phần và Cooking Mode

**Điều kiện:** chọn món thật có khẩu phần gốc 2, có định lượng và nhiều bước; sessionStorage hoạt động, rồi thử bị chặn bằng môi trường kiểm thử. **Trạng thái: Not Tested bằng browser.**

1. Ghi lượng gốc của từng nguyên liệu, đổi 2 → 4 → 3 → 2. Lượng cho 4 bằng gốc × 2; các lần đổi luôn tính từ gốc, không nhân dồn. Đơn vị không tự quy đổi.
2. Đánh dấu/bỏ đánh dấu một số nguyên liệu và bước. Bắt đầu Cooking Mode, thử bước trước/tiếp/chọn số bước/hoàn thành/bỏ hoàn thành; thử bước đầu/cuối và trạng thái hoàn thành toàn bộ.
3. Reload cùng URL, kiểm tra khẩu phần, checklist, bước hoàn thành và bước đang xem được khôi phục; mở lại Cooking Mode để xem bước đã lưu. Không yêu cầu chế độ toàn màn hình tự mở sau reload.
4. Mở món khác rồi quay lại: tiến độ độc lập theo ID. Làm lại từ đầu chỉ reset món hiện tại, giữ khẩu phần theo nghiệp vụ hiện có.
5. Thử Escape khi focus trong Cooking Mode rồi trong Navbar mobile: chỉ điều khiển đúng vùng, exit trả focus về nút bắt đầu. Khi storage bị chặn vẫn nấu được và có lời nhắc phù hợp.

**Mong đợi:** không NaN/Infinity, mất bước hoặc lẫn tiến độ; nội dung bước vẫn là công thức gốc, lời nhắc lượng đã đổi rõ ràng; không overflow ở màn hình nhỏ.

### QA11-F03 — Đăng ký, login, profile, reload, logout và hết phiên

**Điều kiện:** User fixture mới trong môi trường ghi an toàn; mật khẩu thử dài, có tiếng Việt/khoảng trắng, không ghi vào báo cáo. **Trạng thái: Not Tested bằng browser.**

1. Đăng ký hợp lệ; xác nhận chưa tự login, không có trường chọn Admin. Đăng nhập đúng; truy cập Profile, sửa tên/điện thoại; reload khôi phục tài khoản từ me.
2. Xem Application/Cookies và request headers, chỉ ghi các thuộc tính: HttpOnly/Path/SameSite/thời hạn. Không copy giá trị cookie/token. Web Storage không chứa JWT hoặc mật khẩu.
3. Khi login/register đang chờ phản hồi, bấm menu Công thức; phản hồi tới muộn không tự kéo về Profile/Login. Login đã được server xử lý vẫn có thể hợp lệ và cập nhật Navbar.
4. Logout khi đang ở trang bảo vệ; API CSRF thành công trước khi UI trở thành Guest và về trang chủ. Reload URL bảo vệ phải đến Login, không lộ dữ liệu cũ. Lỗi logout giữ tài khoản và cho thử lại.
5. Chờ qua hạn 15 phút rồi thực hiện request bảo vệ: 401, UI xóa phiên và giữ đích cần đăng nhập. Restart chỉ thực hiện trên Backend kiểm thử riêng: registry mất phiên, không gia hạn ngầm.

**Mong đợi:** đúng role/uid thật, cookie được quản lý bởi browser, không refresh token/remember me ngoài phạm vi; trạng thái mạng unknown có retry thay vì giả kết luận Guest.

### QA11-F04 — Favorites, Reviews và quyền sở hữu

**Điều kiện:** hai User A/B trong hai browser profile hoặc phiên riêng, một món fixture; môi trường ghi rollback/test riêng. **Trạng thái: Not Tested bằng browser.**

1. A lưu tim từ card, kiểm tra tim ở detail/Favorites, bỏ với hủy/xác nhận. Gửi lặp khi pending không tạo hai mutation. Thử lỗi mạng: trạng thái xác nhận trước đó còn nguyên, không báo thành công.
2. A đánh giá lần lượt mức biên 1 và 5; bình luận trống hợp lệ, quá 2.000 ký tự bị chặn; sửa/hủy/sửa/lưu; kiểm tra trung bình và số đánh giá sau thành công.
3. B xem review công khai nhưng không thấy công cụ sửa của A. Gọi PATCH/DELETE review của A bằng phiên B trong môi trường test phải trả 404 theo quy tắc ownership, dữ liệu A nguyên vẹn.
4. A xóa review sau xác nhận; lỗi xóa giữ review; thành công có form mới và summary cập nhật. Thử chuỗi HTML trong bình luận: hiển thị văn bản, không script/event handler chạy.
5. Logout A/login B khi CSRF hoặc GET cá nhân đang pending: không chuyển bản nháp/tim/phản hồi của A sang B. Không đổi role để vượt ownership.

**Mong đợi:** thao tác đúng chủ sở hữu, DTO không email riêng/hash, một đánh giá mỗi user/món; quyền xóa review người khác chỉ qua Admin API có kiểm tra riêng.

### QA11-F05 — Pantry và gợi ý từ tủ cá nhân

**Điều kiện:** User fixture; ngày hiện tại xác định theo Asia/Ho_Chi_Minh; tối thiểu bốn loại với ngày hôm qua, hôm nay, +3 ngày và không ghi ngày. **Trạng thái: Not Tested bằng browser.**

1. Thêm các dòng, thử số lượng null, dương tối đa 2 chữ số thập phân và đơn vị bắt buộc khi ghi lượng. Sửa lượng/ngày, hủy bản nháp, kiểm tra reload; nguyên liệu trùng không tạo dòng mới.
2. Ngày hôm qua là hết hạn; hôm nay đến +3 ngày là sắp hết hạn; không ghi hạn được nhắc tự kiểm tra. Ghi nhận giờ Việt Nam dùng để so sánh.
3. Chọn 4 người, nhấn nấu từ Pantry. Chỉ ID loại chưa hết hạn được chuyển, loại chưa ghi hạn vẫn được chọn, giữ 4 người. Lựa chọn Ingredients trước đó được thay bằng tập hợp hợp lệ này.
4. Kiểm tra lời nhắc chưa tính đủ số lượng/chưa đổi đơn vị/chưa tự trừ kho; dữ liệu pantry không giảm sau khi xem hay hoàn thành món.
5. Thử chỉ có loại hết hạn, catalog mismatch, lỗi trang catalog sau và >100 loại đủ điều kiện bằng fixture: không gửi tập con tùy tiện, có thông báo/hành động sửa. Không sửa giờ hệ điều hành thật để thử nửa đêm; dùng bài tự động đã có cho ranh giới ngày.

**Mong đợi:** không nhầm ngày theo UTC, không dùng dữ liệu trang thiếu, không suy ra đủ lượng từ tỷ lệ loại nguyên liệu.

### QA11-F06 — Quản trị từ Dashboard tới công thức công khai

**Điều kiện:** fixture Admin/harness cô lập hoặc tài khoản đã được cấp phép; mọi ghi nằm trong database test/transaction an toàn. Không tự cấp quyền. **Trạng thái: Not Tested bằng browser.**

1. Guest mở Admin phải đến Login; User thấy 403. Gọi trực tiếp Admin API bằng User bị 403, JWT hết hạn/thu hồi bị 401, không dựa vào việc ẩn menu.
2. Admin đối chiếu KPI/top 5 với SQL test; tạo danh mục/nguyên liệu mới của riêng fixture. Tên trùng/URL sai/quan hệ đang dùng có thông báo và giữ dữ liệu.
3. Thêm món với ít nhất một nguyên liệu bắt buộc, định lượng dương và một bước; sắp xếp bước rồi lưu. Kiểm tra món ở danh sách công khai, detail và gợi ý bằng đúng ID nguyên liệu mới.
4. Sửa metadata, nguyên liệu, bước; hủy phải không ghi. Dùng fault injection có kiểm soát trong harness để gây lỗi SQL sau khi ghi cha/con: toàn bộ POST/PATCH rollback. Không tạo trigger hoặc cắt kết nối SQL thật để gây lỗi.
5. Xem Users chỉ đọc. Tạo review fixture, lọc/xem, xóa với hủy rồi xác nhận; công thức còn nguyên. User thường không gọi được DELETE Admin này.
6. Khi món fixture còn Favorite/Review, xóa trả 409 và giữ món/con. Chỉ sau bỏ liên kết của chính fixture mới xóa được món. Không xóa seed hoặc liên kết người dùng thật để làm ca test đạt.
7. Kết thúc transaction/môi trường test, kiểm tra không còn dữ liệu fixture và hash/count dữ liệu gốc không đổi.

**Mong đợi:** không partial aggregate, cascade bất ngờ, lộ hash hoặc API tự đổi quyền; quyền và CSRF/Origin vẫn được thực thi đầy đủ.

## Responsive và kiểm thử trực quan

Kiểm tra mỗi route R01–R18 ở cả bốn kích thước dưới đây; điều kiện không đủ (chưa có Admin được phép) giữ Not Tested cho phần đó. Chụp toàn trang và các trạng thái dialog/drawer/Cooking Mode/form có lỗi. Dùng ảnh lỗi/tên dài/bình luận dài để thử bố cục, không chỉ ảnh đẹp và chuỗi ngắn.

| Mã | Viewport | Các điểm cần kiểm tra | Kết quả mong đợi | Trạng thái |
| --- | --- | --- | --- | --- |
| QA11-V01 | 375px | Navbar mobile, CTA, card, IngredientFinder, chips/khẩu phần, Suggestions, detail/Cooking Mode, auth, Favorites/Pantry, drawer Admin, form/bảng | Nội dung không tràn ngang toàn trang; chữ/nút không chồng hoặc bị che; ảnh không méo; drawer đọc được, có đóng/focus; chỉ vùng bảng rộng cuộn ngang | **Not Tested** |
| QA11-V02 | 768px | Grid chuyển cột, bộ lọc, summary nguyên liệu, bảng, sidebar Admin thu gọn và tên truy cập của icon | Bộ lọc/nút vẫn thao tác được; icon sidebar có tên; bảng không ép body rộng; các hàng form có nhãn và lỗi rõ | **Not Tested** |
| QA11-V03 | 1024px | Sidebar/nội dung cạnh nhau, collapse toggle, RecipeDetail hai cột, form nguyên liệu/bước, dialog cao dài | Sidebar và main không đè nhau; không khoảng trắng/scroll ngang bất thường; dialog cuộn bên trong, nút hành động tiếp cận được | **Not Tested** |
| QA11-V04 | 1440px | Max width, số cột card, KPI/top 5, bảng dài, ảnh hero, đoạn văn dài | Khoảng cách/cột cân đối; dòng chữ đọc được; ảnh/card tỷ lệ nhất quán; nội dung không kéo giãn vô hạn | **Not Tested** |

Ghi riêng `document.documentElement.scrollWidth` và `clientWidth` khi nghi ngờ overflow; chỉ dùng chênh lệch để điều tra, không thay cho quan sát vùng gây tràn. Bảng có vùng cuộn riêng được phép. Thử zoom 200%, xoay ngang và thay đổi viewport khi drawer/Cooking Mode đang mở; không chỉ resize khi trang trống.

## Bàn phím và khả năng tiếp cận

| Mã | Điều kiện/thao tác | Kết quả mong đợi | Trạng thái |
| --- | --- | --- | --- |
| QA11-A01 | Dùng Tab/Shift+Tab từ đầu trang công khai/Admin; kích hoạt skip link | Focus rõ, thứ tự hợp lý; skip link đến main; không mắc kẹt ngoài dialog; mọi nút icon có tên dễ hiểu | **Not Tested** |
| QA11-A02 | Mở menu/drawer và dialog xóa/thêm/sửa; Tab vòng, Escape; thử pending | Focus vào dialog, vòng trong dialog, đóng trả focus; pending không đóng nhầm; lỗi nằm trong dialog đang mở và được thông báo | **Not Tested** |
| QA11-A03 | Gửi form sai bằng keyboard, chọn sao bằng keyboard, thao tác checkbox/servings | Nhãn gắn đúng control; trường lỗi có mô tả/focus hợp lý; trạng thái sao/checkbox/chọn bước đọc được; không bắt buộc chuột | **Not Tested** |
| QA11-A04 | Dùng screen reader trên loading/error/empty/success, page/filter change | Thông báo đủ ngữ cảnh, không lặp vô hạn; loading không bị đọc là thành công; 403/404 có tiêu đề và đường về | **Not Tested** |
| QA11-A05 | Kiểm tra bảng Admin bằng keyboard và screen reader | Caption/header rõ, vùng cuộn có tên và focus; actions gọi đúng dòng; không mất focus khi hủy dialog | **Not Tested** |
| QA11-A06 | Bật reduced motion, zoom 200%; đo contrast bằng công cụ; thử text dài | Giảm chuyển động, không mất nội dung/nút; tương phản được đo thực tế và ghi công cụ/kết quả, không suy ra từ mã màu | **Not Tested** |

## Browser Console, Network và vòng đời request

| Mã | Các bước | Kết quả mong đợi | Trạng thái |
| --- | --- | --- | --- |
| QA11-B01 | Đi hết 18 route và 6 luồng, giữ Console log | Không React warning, uncaught exception, màn hình trắng hoặc lỗi import; phân biệt API 401 Guest dự kiến với lỗi thực sự | **Not Tested** |
| QA11-B02 | Xóa Network log, reload từng route, không tương tác 30 giây, rồi thay search/filter/page nhanh | Request bootstrap có giới hạn; không chuỗi GET/POST tự lặp; response cũ không ghi đè; catalog nhiều trang chỉ tải theo giới hạn nghiệp vụ | **Not Tested** |
| QA11-B03 | Slow connection/offline/chặn riêng API; thử Retry; đổi trang khi request pending | Loading/lỗi rõ, không kết quả thành công giả; Retry gửi lại đúng request; việc rời trang không kéo người dùng quay lại do phản hồi muộn; lỗi sau không hiện lên tài khoản khác | **Not Tested** |
| QA11-B04 | Network cache tắt, đo cold/warm load và request ảnh ở bốn viewport | Ghi thời gian/transfer size thực, cache và thiết bị; không tự đặt số đo. Hero PNG hiện là 2.822.786 byte ở source, cần quan sát tác động tải thực; ảnh card lazy/placeholder hoạt động | **Not Tested** |

Một request bị abort ở browser không chứng minh server đã rollback: nếu request đã tới server, phải kiểm tra kết quả SQL/API bằng harness an toàn. Không báo “không ghi” chỉ vì thấy canceled trong Network.

## Cookie, bảo mật và dữ liệu nhạy cảm trong browser

Các ca sửa request được thực hiện trong harness/test riêng; không tắt middleware hoặc brute-force database chính. Các test tự động riêng được ghi tại báo cáo, không thay trạng thái thủ công bên dưới.

| Mã | Điều kiện/thao tác | Kết quả mong đợi | Trạng thái |
| --- | --- | --- | --- |
| QA11-S01 | Login HTTP local; xem thuộc tính cookie, thử đọc qua document.cookie và kiểm tra Web Storage | Session HttpOnly/Path=/, host-only, SameSite đúng thiết kế; JS không đọc được session; storage không có JWT/password; chỉ ghi thuộc tính, không lộ giá trị | **Not Tested** |
| QA11-S02 | Môi trường HTTPS thật với cấu hình production hợp lệ | Secure và tên cookie `__Host-` đúng; gửi cookie/request/CSRF hoạt động trên browser thật. HTTP local không chứng minh ca này | **Not Tested — chưa có HTTPS browser** |
| QA11-S03 | Trong test, gửi mutation không CSRF, token cũ sau login, Origin ngoại/thiếu; request JSON hợp lệ rồi sai content type | Thiếu/sai CSRF/Origin bị chặn, không ghi; token gắn phiên; JSON được kiểm tra; CORS exact origin và credentials đúng; không wildcard Origin | **Not Tested** |
| QA11-S04 | Logout rồi dùng cookie cũ/hết hạn trong test; mở trang cá nhân/Admin | 401, registry thu hồi; UI không giữ dữ liệu tài khoản cũ; không tự nâng quyền từ body hoặc sửa state client | **Not Tested** |
| QA11-S05 | Nhập chuỗi HTML/event handler vào review/form fixture, tên tìm kiếm và dữ liệu dài | Dữ liệu bị validation từ chối hoặc render thành văn bản; không script/event handler thực thi; không dùng dangerouslySetInnerHTML cho dữ liệu này | **Not Tested** |
| QA11-S06 | Search tiếng Việt và chuỗi dấu nháy/SQL literal trong test; xem request/response | Không SQL injection, rò lỗi SQL hoặc nhân rộng kết quả do nối chuỗi; 400/empty đúng trường hợp; các API quản trị vẫn đòi quyền | **Not Tested** |
| QA11-S07 | Kiểm tra response auth/profile/users/reviews và lỗi 4xx/5xx; xem headers | Không PasswordHash/JWT/HMAC/stack/chuỗi kết nối; phản hồi riêng tư no-store; header bảo mật đúng môi trường; không ghi cookie/token vào log | **Not Tested** |
| QA11-S08 | Harness mô phỏng nhiều lần login sai có giới hạn, không thử tải mạnh trên DB chính | Rate limit trả 429 theo chính sách, có khả năng thử lại sau giới hạn; thông báo sai thông tin không xác nhận email tồn tại | **Not Tested** |

## Các giới hạn phải giữ khi chốt nghiệm thu

- Chưa có browser thì toàn bộ trạng thái trực quan/responsive/console/network/cookie thật ở trên vẫn Not Tested, kể cả khi unit/DOM/integration đều đạt.
- Chưa có Admin được cấp phép thì không nghiệm thu thủ công Admin bằng cách tự nâng quyền; fixture tự động không chứng minh quy trình vận hành tài khoản thật.
- Chưa có HTTPS thì không đánh dấu Secure cookie và hành vi browser HTTPS là Passed từ việc đọc Set-Cookie trong HTTP test.
- Chưa chạy multi-user/load test thì số đo vài request local không chứng minh chịu tải hoặc loại bỏ deadlock/race nhiều transaction production.
- Bước 11 chỉ kiểm thử và sửa lỗi; không thêm chức năng, đổi kiến trúc xác thực, schema, dữ liệu gốc hoặc triển khai Bước 12.
