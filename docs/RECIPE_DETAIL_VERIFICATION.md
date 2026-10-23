# Kiểm chứng trang chi tiết và Cooking Mode — Bước 7

Ngày: **18/10/2026**, Asia/Saigon. Chỉ mở rộng Frontend, kiểm thử và tài liệu trong workspace hiện tại.

## Kết quả thực tế

| Hạng mục | Lệnh/phương pháp | Kết quả |
| --- | --- | --- |
| Frontend lint | `npm run lint` tại client | Sạch, không lỗi/cảnh báo |
| Frontend unit/DOM | `npm test` tại client | **84/84 đạt**: 50 test cũ + 21 model + 13 DOM mới |
| Frontend integration | `npm run test:integration` tại client | **10/10 đạt**: 8 test cũ + 2 test SQL/DOM mới |
| Production build | `npm run build` tại client | Đạt; 2033 modules; JS 427,23 kB (gzip 132,19 kB), CSS 51,24 kB (gzip 9,36 kB) |
| Backend unit | `npm test` tại server | **61/61 đạt** |
| Backend integration | `npm run test:integration` tại server | **138/138 đạt** |
| SQL Server | `npm run check:db` tại server | SmartCookDB, 20 món, shared memory, mã hóa TRUE |
| Dữ liệu chi tiết | GET danh sách rồi GET cả 20 món | **20 món / 80 bước**, StepNumber tăng dần, định lượng gốc hữu hạn dương |
| Dev server/proxy | Vite 5173, Express 5000 | Khởi động được; route chi tiết/ingredients/suggestions và GET chi tiết qua proxy trả 200 |
| Mã nguồn Backend/database | SHA-256 trước/sau | 43 tệp giữ nguyên |
| Dữ liệu SQL | Bộ integration Backend hiện có | Cả 10 bảng giữ nguyên số dòng và SHA-256 nội dung |

Không cài/cập nhật dependency trong Bước 7. Môi trường vẫn Node 26.6.0, npm 11.18.0, React/DOM 19.3.1, Vite 8.3.4, Tailwind 4.3.3, Router 7.18.4, Axios 1.20.0, Lucide 1.58.0, jsdom 26.1.0 dành cho test.

Hai dev server được mở riêng để kiểm chứng và dừng sau kiểm tra; khởi động lại bằng hướng dẫn cuối tài liệu. Không có thay đổi schema/seed, API, thuật toán gợi ý, tài khoản, yêu thích hoặc Admin.

## Bộ kiểm thử mới

### `client/tests/recipeCooking.test.js` — 21 test

Kiểm tra model thuần: mặc định theo API và thứ tự bước, tính lượng từ số gốc, 12 chữ số có nghĩa/lượng nhỏ, số không hợp lệ/tràn số, khẩu phần gốc sai/lớn hơn 20, giới hạn 1–20, storage schema/version và kiểu ID, đối chiếu ID cũ, toggle bất biến, món độc lập, reset giữ khẩu phần, ưu tiên Suggestions đúng một lần và reload không ghi đè thay đổi, storage bị chặn, công thức rỗng và scope thay đổi.

### `client/tests/recipeDetail.test.js` — 13 test DOM

Mount App/Router/StrictMode thật trong jsdom. Chỉ thay Axios adapter trong test; fixture dùng ID khác seed. Kiểm tra:

- Metadata, nguyên liệu/bước từ response, ảnh/fallback, món liên quan lấy qua API, loại món hiện tại.
- Tăng/giảm và giới hạn khẩu phần, số thập phân, tính lại từ gốc thay vì lượng đã làm tròn.
- Checkbox nguyên liệu/bước, bộ đếm và progressbar 33%/100% theo trạng thái.
- Cooking Mode một bước, trước/tiếp, đánh dấu, chúc mừng, trở về toàn bộ công thức.
- Escape trong vùng nấu trả focus về Bắt đầu nấu; Escape đóng Navbar không thoát vùng nấu.
- Reload phục hồi bước đang xem, khẩu phần/checklist; các món có progress riêng; reset chỉ món hiện tại.
- ID cũ bị loại, ID route sai không gọi API, 404, mất mạng/thử lại không xóa progress.
- Thiếu nguyên liệu/bước, không có món liên quan, khẩu phần gốc sai, ảnh onError.
- Suggestions có khẩu phần 4 ghi đè tiến độ cũ khẩu phần 6 trong một entry mới, vẫn giữ checklist; đổi thành 5 rồi reload cùng entry vẫn giữ 5.

Test bắt console.error và xác nhận không có lỗi React/DOM/act trong các luồng đó; teardown khôi phục adapter/globals/storage môi trường test. Đây không phải console browser thật hoặc kiểm chứng bố cục.

### `client/tests/integration/recipeDetail.integration.test.js` — 2 test

Không mock adapter. App/service gửi request tới Express/SQL Server đang chạy:

1. Đọc danh sách và đủ 20 chi tiết món: 80 bước đúng thứ tự, nguyên liệu/khẩu phần gốc hợp lệ.
2. Chọn Trứng gà, Dầu ăn, Cà chua theo tên từ API → gợi ý 4 người → mở Trứng chiên ID thực tế 8. Món có 5 nguyên liệu và 4 bước. Định lượng 4 người là 6 quả trứng, 30 ml dầu; tăng 5 người, reload giữ 5; tick nguyên liệu/bước, Cooking Mode hoàn thành 100%, reset về 0% và giữ 5 người. Request nguồn/detail/related đều dùng API thật.

Các suite cũ tiếp tục kiểm tra Home 8 danh mục/8 món, Recipes 20 món/phân trang 12, Ingredients 64 nguyên liệu/12 nhóm, Suggestions 13 món/2 ready/11 missing, phân trang, định lượng, reload, lỗi/rỗng và race condition. Backend chạy lại toàn bộ test thay vì chỉ dựa trên báo cáo Bước 6.

## Đối chiếu 22 trường hợp yêu cầu

| # | Trường hợp | Bằng chứng |
| --- | --- | --- |
| 1 | Chi tiết lấy API thật | Integration GET 20 chi tiết và DOM thật |
| 2 | Đúng món | DOM đối chiếu h1/tên, integration Trứng chiên |
| 3 | Nguyên liệu/định lượng | DOM label/quantity; SQL 5 nguyên liệu, 6 quả/30 ml cho 4 |
| 4 | Thứ tự bước | Unit sắp DTO đảo thứ tự; SQL 80 bước tăng dần |
| 5 | Tăng khẩu phần | DOM/integration nút +, 4→5 |
| 6 | Giảm khẩu phần | DOM nút − và lượng đổi theo số gốc |
| 7 | Giới hạn 1–20 | DOM nút disable tại biên, model từ chối ngoài khoảng |
| 8 | Không nhân chồng | Model 2→4→3, DOM tăng/giảm với lượng lẻ |
| 9 | Nguyên liệu đã chuẩn bị | DOM checkbox và bộ đếm, SQL DOM/restore |
| 10 | Bước hoàn thành | DOM checkbox và nút Cooking Mode, bỏ đánh dấu được |
| 11 | Progress đúng | 1/3=33%, tất cả=100%, reset=0% |
| 12 | Trước/tiếp | DOM đổi đúng nội dung, chặn ở bước đầu/cuối |
| 13 | Hoàn tất | DOM chúc mừng, SQL DOM 4/4 |
| 14 | Thoát | Nút xem/thoát, Escape trong vùng và focus trở lại |
| 15 | Reload | DOM/SQL giữ khẩu phần, checklist và bước hiện tại |
| 16 | Món độc lập | Model keys và DOM chuyển hai RecipeID |
| 17 | Làm lại | Model/DOM/SQL chỉ xóa progress của món hiện tại |
| 18 | Không tồn tại | Mock HTTP 404 trong DOM; Backend integration 404 thật |
| 19 | API lỗi/thử lại | DOM lỗi mạng→thử lại, storage giữ nguyên; Backend lỗi 503/504 thật |
| 20 | Từ Suggestions | Cả ba link ảnh/tên/nút truyền Router state; DOM/SQL chọn link |
| 21 | Giữ khẩu phần | Entry mới ưu tiên 4, đổi 5, reload giữ 5 |
| 22 | Hồi quy | Chạy đủ 50 test Frontend cũ, 8 integration cũ và 199 Backend |

## Lỗi được phát hiện và sửa

- Định dạng cố định hai chữ số thập phân có thể biến lượng dương nhỏ thành 0: dùng 12 chữ số có nghĩa và ngắt dòng cho lượng/ghi chú dài.
- Thông báo storage bị chặn từng được gắn từ một giá trị cố định khiến nút ẩn không có tác dụng: đưa thông báo vào state có thể xóa; chỉ báo lại nếu có lần ghi mới thất bại.
- HMR=false trong các test harness cũ vẫn để Vite mở WebSocket, gây `Port 24678 is already in use` khi test chạy song song cùng dev server. Đã xác minh tùy chọn `server.ws` ở Vite 8 đang cài, đặt `ws:false` cho các middleware test; chạy lại toàn bộ suite không còn lỗi cổng. Không đổi Vite config production/dev.
- Escape nghe trên document có thể thoát Cooking Mode khi người dùng chỉ muốn đóng Navbar: xử lý Escape trong vùng nấu và thêm test hồi quy focus/menu.

Không phát hiện lỗi chức năng còn lại qua các kiểm tra đã chạy.

## Giới hạn kiểm chứng trực quan

Browser inventory trả `apps: [], browsers: []`; mở tab in-app tại `/recipes/8` trả `Browser is not available: iab`. Vì vậy **chưa kiểm thử trực quan thành công ở 375/768/1024/1440px**. Không có screenshot, phép đo horizontal overflow, focus/scroll native hoặc console trình duyệt để khẳng định hoàn hảo.

jsdom kiểm tra DOM, event và focus mô phỏng; không tính layout, không tải ảnh như browser và scroll được stub. Sự kiện image error được kích hoạt có kiểm soát trong unit test. Bố cục đã được đọc/rà soát source: hero/checklist/bước một cột ở mobile, hai cột từ lg; ảnh aspect ratio/object-fit; Cooking Mode giới hạn max-width, chữ lớn, nút wrap, progress bằng chữ/màu/ARIA, tên/ghi chú/lượng dài có thể xuống dòng. Những điểm này vẫn cần xác nhận ở browser thật.

Checklist còn lại khi có browser:

1. Mở `/recipes/8` tại từng width 375, 768, 1024, 1440px: chữ/checkbox/±/ảnh không chồng hoặc tràn ngang.
2. Tab/Shift+Tab/Space/Enter qua checklist, selector, Start, step navigation và Exit; focus nhìn rõ, không mắc kẹt.
3. Mode đọc rõ một bước, nút trước/tiếp chặn biên, ảnh không méo; menu Navbar/Escape không xung đột; thoát trả focus và vị trí cuộn phù hợp.
4. Từ Suggestions chọn 4 người, mở chi tiết, đổi 5, reload, tiếp tục bước đã lưu; quay sang món khác không mang tiến độ theo.
5. Kiểm tra related cards, network throttle/loading, mất kết nối/retry, ảnh lỗi, không có error console nghiêm trọng.

## Giới hạn chức năng có chủ đích

Tiến độ chỉ trong phiên tab/origin, không đồng bộ tài khoản/thiết bị và có thể mất khi storage bị chặn. Reset giữ khẩu phần; mở/đóng Mode không được lưu, reload trở về trang đầy đủ rồi bấm Bắt đầu nấu để tiếp tục. Nếu nội dung một bước được sửa nhưng ID không đổi, trạng thái hoàn thành hợp lệ theo ID vẫn được giữ. Câu hướng dẫn giữ số lượng gốc; chỉ bảng nguyên liệu được tính lại và có nhắc rõ khi đổi khẩu phần. Chưa có quy đổi đơn vị, timer, tự chuyển bước, wake lock, yêu thích, đăng nhập hoặc Admin.

## Chạy thử và chạy lại test

Hai terminal từ gốc dự án:

```powershell
# Terminal Backend
Set-Location C:\Users\MyPC\Desktop\SmartCook\server
npm run dev
```

```powershell
# Terminal Frontend
Set-Location C:\Users\MyPC\Desktop\SmartCook\client
npm run dev
```

Mở `http://127.0.0.1:5173/recipes/8`, hoặc chọn nguyên liệu ở `/ingredients` rồi đi từ Suggestions. Checklist, thay đổi khẩu phần và hoàn thành bước không ghi SQL Server.

```powershell
# Trong client; integration cần Backend/SQL Server
npm run lint
npm test
npm run test:integration
npm run build
```

```powershell
# Trong server
npm test
npm run test:integration
npm run check:db
```

Biến `SMARTCOOK_TEST_API_URL` có thể đổi base URL của integration Frontend; mặc định `http://127.0.0.1:5000/api`. Chỉ thực hiện Bước 7; các chức năng sau chờ yêu cầu mới.
