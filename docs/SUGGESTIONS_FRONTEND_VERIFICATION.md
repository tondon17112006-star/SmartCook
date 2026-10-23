# Kiểm chứng giao diện gợi ý — Bước 6

Ngày: 17/10/2026 (Asia/Saigon). Workspace hiện tại, không tạo lại React. Báo cáo này phân biệt kiểm tra DOM/API với kiểm tra bố cục browser.

## Môi trường và kết quả cuối

Node 26.6.0, npm 11.18.0; React/DOM 19.3.1; Vite 8.3.4; Tailwind 4.3.3; Router 7.18.4; Axios 1.20.0; Lucide 1.58.0. Backend Express 5 và SQL Server 2019 SmartCookDB hiện có được giữ nguyên.

Thêm **jsdom 26.1.0** chỉ cho dev/test, engines Node >=18 phù hợp với engines hiện tại của client. Không nâng các dependency khác. npm install audit trả 0 vulnerabilities; có cảnh báo deprecated của dependency gián tiếp `whatwg-encoding@3.1.1`, không gây lỗi kiểm thử/build. Không cập nhật npm toàn cục. [jsdom là môi trường mô phỏng DOM trong Node](https://github.com/jsdom/jsdom), không phải browser đo bố cục.

| Lệnh/kiểm tra | Kết quả |
| --- | --- |
| `npm run lint` | Sạch, không lỗi/cảnh báo |
| `npm test` | **50/50 đạt**: 7 hồi quy Bước 5 + 43 test Bước 6 |
| `npm run test:integration` | **8/8 đạt**, dùng Backend/SQL Server thật |
| `npm run build` | Đạt; 2026 modules; JS 405,60 kB (gzip 126,56 kB); CSS 49,38 kB (gzip 9,14 kB) |
| GET nguyên liệu qua Vite proxy | 200, data/pagination thật |
| POST gợi ý qua Vite proxy | 200, total=13 với bộ nguyên liệu kiểm chứng |
| Refresh route qua dev server | `/ingredients`, `/suggestions`, `/recipes`, `/recipes/8`, `/login`, route lạ đều 200 SPA HTML |
| SHA-256 server/database trước/sau | 43 tệp được bảo vệ, không thay đổi |

Các server 5000/5173 đã có trước khi bắt đầu bước này và được dùng cho integration/proxy; không tự dừng tiến trình của người dùng. Ở lần kiểm tra trạng thái cuối, cả hai cổng không còn lắng nghe (ECONNREFUSED); cần mở lại theo hướng dẫn bên dưới để chạy thử. Các Vite middleware test tự đóng sau suite, không chiếm cổng dev.

### Kiểm thử thường

- `recipeFilters.test.js`: 7 test URL/tìm/lọc/phân trang Bước 5 được giữ và chạy lại.
- `ingredientFilters.test.js`: 4 test tìm kiếm Unicode/NFC, nhãn nhóm từ dữ liệu, ký tự literal và tìm toàn catalog.
- `pantryState.test.js`: 9 test ID/servings, storage version/shape, toggle không trùng/giới hạn 100, reconcile ID cũ và storage lỗi.
- `ingredientService.test.js`: 9 test tải đủ 125 DTO qua hai trang, nhóm ở cuối catalog, rỗng, metadata/schema lỗi, thiếu/trùng/thay đổi total, lỗi mạng và hủy request. Dùng client được inject có kiểm soát.
- `suggestions.test.js`: 15 test gom đầy đủ 13/60/110 kết quả, giữ xếp hạng, filter/tổng chính xác, dữ liệu chưa đầy đủ, giới hạn 500, metadata/trùng/thay đổi total, hủy request và clamp page; status missing có thể vẫn mang điểm làm tròn 100%.
- `ingredientFlow.test.js`: 6 kịch bản DOM mount App/Router/Context trong **StrictMode**, kiểm tra thao tác thật của React bằng jsdom, chỉ thay Axios adapter trong test; teardown khôi phục globals/adapter/console. Kết quả không có console.error React/DOM trong suite.

Fixture đơn vị có ID khác seed để xác nhận logic không dựa vào ID hardcode. Mocking chỉ nằm trong test, production gọi Axios/Backend thật.

### Kiểm thử với SQL Server thật

Integration tìm ID qua catalog theo tên, không cố định ID trong logic Frontend. Trong lần chạy hiện tại, bộ Trứng gà, Dầu ăn, Cà chua giải ra `[64,18,9]`.

- Catalog đủ 64 nguyên liệu, 12 nhãn nhóm.
- POST khẩu phần 4, limit 12: total 13, hai trang 12/1, không lặp ID. Trứng chiên đầu tiên: 100%, ready, 2/2 loại bắt buộc.
- Định lượng trứng giữ quantity=3, adjustedQuantity=6 quả; dầu giữ quantity=15, adjustedQuantity=30 ml.
- Gom đủ 13 món rồi lọc: **2 ready + 11 missing = 13**, giữ total trước lọc.
- Không chọn dầu: Trứng xào cà chua 67%, missing, thiếu dầu 30 ml theo 4 khẩu phần.
- Chỉ chọn Hành lá: kết quả rỗng total=0; không tăng điểm do tùy chọn. ID rỗng bị validation 400, tín hiệu đã abort không gửi request.
- Các API detail/categories/recipes cũ tương thích: chi tiết có bước/định lượng gốc, 8 danh mục, tổng 20 món.

`ingredientFlow.integration.test.js` mount **ứng dụng thực** trong DOM, không thay Axios adapter, gửi tới Backend thật: chọn ba nguyên liệu, chọn 4 người, tìm 13 món, chuyển trang 2, lọc 2 ready/11 missing, đổi filter không gọi API lại, mở chi tiết và remount `/suggestions` giữ session. Kiểm tra thêm Home tải đủ 8 danh mục/8 món và Recipes có 20 món, 12 món trang đầu. Không có console.error React/DOM trong luồng này.

## 24 trường hợp được yêu cầu

| # | Trường hợp | Bằng chứng/kết quả |
| --- | --- | --- |
| 1 | Danh sách nguyên liệu | DOM integration hiển thị 64 từ SQL Server |
| 2 | Tìm theo tên | DOM unit gõ TRỨNG dạng NFD; trả đúng card, clear đưa focus về input |
| 3 | Chọn một | DOM unit aria-pressed và chip đúng |
| 4 | Chọn nhiều | DOM unit chọn ba, request integration có ba ID thật |
| 5 | Bỏ chọn | DOM unit kiểm tra card toggle và nút X chip |
| 6 | Không trùng | Unit state + DOM kiểm tra distinct IDs |
| 7 | Xóa tất cả | DOM unit về rỗng, disable nút tìm |
| 8 | Rỗng không tìm | DOM unit và suggestions mở trực tiếp không POST |
| 9 | Khẩu phần 4 | DOM unit/integration native select, request servings=4 |
| 10 | Request đúng ID | DOM unit/interceptor integration kiểm tra numeric IDs lấy từ lựa chọn |
| 11 | 13 món | Service + DOM integration, SQL Server thật |
| 12 | Tỷ lệ | DOM unit 100/50%, integration 100%, SQL kiểm tra 67% |
| 13 | Còn thiếu | DOM unit missing list, SQL thiếu dầu |
| 14 | Định lượng mới | DOM/SQL integration hiển thị 6 quả/30 ml |
| 15 | ready/missing | DOM/SQL kiểm tra nhãn, trạng thái API; không suy từ điểm |
| 16 | Chi tiết | DOM unit và integration mở route, tên/bước đúng |
| 17 | Quay lại giữ chọn | DOM unit qua link Thay đổi nguyên liệu, cùng provider |
| 18 | Reload giữ phiên | Unit/integration remount từ sessionStorage; giữ ID và khẩu phần |
| 19 | Mất kết nối | Controlled DOM unit catalog/POST thất bại, thử lại, không xóa selection |
| 20 | Rỗng | DOM unit response rỗng + SQL chỉ Hành lá, total=0 |
| 21 | Phân trang | DOM unit 53 món/5 trang; SQL 13 món/2 trang, chặn trang sau cuối |
| 22 | Filter không sai tổng | Unit 53 món gom hai request 50/3 rồi lọc 27/26; SQL gom13 lọc2/11 |
| 23 | Mobile | Rà soát CSS/semantic source; **chưa xác nhận trực quan hoặc bàn phím browser** |
| 24 | Hồi quy Bước 5 | 7 unit cũ, integration Home/Recipes/Detail và lint/build |

DOM unit còn kiểm tra response cũ bị abort khi đổi lựa chọn và không ghi đè response mới. Catalog cũ chứa ID đã xóa được reconcile; JSON session hỏng về rỗng có thông báo. Loading state/skeleton được xác nhận trong request chưa hoàn tất.

## Những phần chưa kiểm chứng hoặc còn giới hạn

Browser inventory vẫn `apps: [], browsers: []`; mở tab in-app trả `Browser is not available: iab`. **Chưa có kiểm thử trực quan ở 375/768/1024/1440px**, chưa có screenshot/đo overflow, thao tác chuột hoặc bàn phím native, console trình duyệt, ảnh onError thực tế và scroll/focus sau anchor. jsdom có DOM/event/focus mô phỏng, không tính layout; scroll được stub trong test.

Rà soát source: grid nguyên liệu 2 cột ở 375, 3 cột từ 640, 4 cột từ 1280; desktop lg có sidebar 21rem; Suggestions 1 cột mobile/2 từ sm/3 từ xl. Sidebar không fixed overlay; radio/chip wrap, ảnh giữ tỷ lệ. Cần kiểm tra tại từng viewport khi browser sẵn sàng, đặc biệt sidebar sticky/scroll và thứ tự Tab.

Không phát hiện lỗi chức năng còn lại trong các kiểm tra đã chạy. Các giới hạn có chủ đích:

- Filter client chỉ gom tối đa 500 món; lớn hơn cần thêm filter/count/pagination ở API trong bước riêng. Không lọc một trang rồi coi đó là toàn dữ liệu.
- Tải catalog đầy đủ phù hợp bộ dữ liệu hiện tại; khi catalog lớn, cần API nhóm và cách tra ID theo lô thay cho tải toàn bộ.
- Kiểm tra total/trùng/thiếu giữa trang không tạo snapshot database bất biến; tác vụ khác cập nhật dữ liệu có thể yêu cầu tải lại.
- Storage bị chặn khiến lựa chọn không bền khi remount/reload; có thông báo.
- Detail GET vẫn định lượng gốc, được ghi nhãn rõ; gợi ý hiển thị adjustedQuantity theo khẩu phần yêu cầu.
- Không lưu lượng tồn/phiên theo tài khoản; không có đăng nhập/Admin/yêu thích, không sửa thuật toán hoặc database.

## Chạy lại

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

```powershell
# Terminal kiểm tra — Backend/SQL Server cần chạy cho integration
Set-Location C:\Users\MyPC\Desktop\SmartCook\client
npm run lint
npm test
npm run test:integration
npm run build
```

Mở `http://127.0.0.1:5173/ingredients`; chọn Trứng gà, Dầu ăn, Cà chua, 4 người; tìm món, chuyển trang, lọc trạng thái, mở công thức, quay lại và reload. Kiểm tra lại layout/focus/mobile ở bốn viewport trước khi nghiệm thu trực quan. Bước sau chỉ thực hiện khi người dùng yêu cầu.
