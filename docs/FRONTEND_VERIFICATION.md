# Kiểm chứng Frontend — Bước 5

Ngày: 17/10/2026, workspace `C:\Users\MyPC\Desktop\SmartCook`. Chỉ cập nhật Frontend và tài liệu. Không ghi dữ liệu SQL Server.

## Môi trường thực tế

| Công nghệ | Phiên bản |
| --- | --- |
| Node.js / npm | 26.6.0 / 11.18.0 |
| React / React DOM | 19.3.1 / 19.3.1 |
| Vite / plugin React | 8.3.4 / 6.1.2 |
| Tailwind / plugin Vite | 4.3.3 / 4.3.3 |
| React Router DOM | 7.18.4 |
| Axios / Lucide React | 1.20.0 / 1.58.0 |
| Oxlint | 1.88.0 |

Không cài thêm thư viện hoặc cập nhật cây dependency trong bước này. Bổ sung script `npm test` dùng `node:test` có sẵn.

## Kết quả đã chạy

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| `npm run lint` | Đạt, không lỗi/cảnh báo |
| `npm test` trong client | 7/7 đạt |
| `npm run build` | Đạt; 2007 modules; JS khoảng 367,01 kB, gzip 117,67 kB; CSS 41,85 kB |
| `npm run dev` Backend/Frontend | Khởi động thành công tại 5000/5173 |
| API qua Vite proxy | Health, categories, recipes trả 200 và JSON thực tế |
| Refresh/deep link | 11 URL giao diện đã kiểm tra HTTP 200 trả SPA HTML, gồm chi tiết và route không tồn tại |
| Render React + Axios smoke | 43/43 kiểm tra đạt; chi tiết bên dưới |
| Backend dừng | Proxy trả 502; Axios giữ lỗi; ErrorState render alert + Thử lại, không lộ ECONNREFUSED; `/recipes` vẫn trả HTML 200 |
| Bảo toàn Backend/database | So sánh SHA-256 trước/sau của 43 tệp trong server/database: không tệp thay đổi |

Hai server dùng để kiểm chứng đã dừng sau khi kiểm tra; mở lại bằng hướng dẫn README.

### Kiểm thử bộ lọc — lưu trong repository

`client/tests/recipeFilters.test.js` kiểm tra mặc định trang 12 món, Unicode/NFC, vòng đi-về URL, giới hạn số nguyên, query trùng/sai/không hỗ trợ, bảo toàn bộ lọc khi phân trang, giới hạn từ khóa và whitelist cả 5 sort. Kiểm tra mô hình query khi Back/Forward, chưa phải thao tác Back/Forward trong browser.

### API thật và component render

Đã gọi Backend kết nối SmartCookDB qua các service Frontend và kiểm tra riêng query thực tế:

- 8 danh mục, tổng 20 món; page 1 có 12 món, page 2 có 8 món, ID không trùng.
- Tìm “trứng” có 5 món; kết hợp “trứng” + Dễ + tối đa 30 phút có 4 món.
- Lọc Dễ + tối đa 30 phút có 12 món, tất cả thỏa điều kiện và đúng thứ tự thời gian.
- Cả 5 sort trả 200; lọc danh mục đầu có 2 món đúng tên danh mục.
- Từ khóa không tồn tại có data rỗng/total=0; page 100000 có data rỗng, vẫn giữ total=20.
- Chi tiết món ID 20 có nguyên liệu, định lượng số và bước nấu; ID sai trả 400, ID không tồn tại trả 404. AbortSignal đã hủy giữ mã hủy Axios.

43 kiểm tra dùng Vite SSR loader, MemoryRouter và ReactDOMServer: 12 route render h1/layout, các liên kết nội bộ phù hợp route; 7 trang chưa mở có thông báo và không có form giả. RecipeCard với món thật hiển thị tên, danh mục, thời gian, độ khó, fallback NULL và link chi tiết. CategoryCard hiển thị tên/mô tả/link danh mục thật. Empty/Error/Timeout/Loading/Skeleton có nội dung tiếng Việt, status/alert, thử lại và escape nội dung lỗi an toàn.

Driver smoke và bằng chứng tạm được lưu tại `.cache/frontend-smoke.mjs`, `client/.cache/frontend-smoke-entry.jsx`, `.cache/frontend-smoke.json`, `.cache/frontend-offline.json`; các thư mục cache bị Git bỏ qua. Chúng là bằng chứng phiên làm việc, không thay thế suite kiểm thử browser. Có thể chạy lại `node .cache/frontend-smoke.mjs` tại gốc khi Backend đang hoạt động và những tệp tạm vẫn còn.

## Giới hạn kiểm chứng

Môi trường điều khiển trả `apps: [], browsers: []`; thử tạo tab in-app báo `Browser is not available: iab`. Vì vậy **chưa kiểm thử trực quan hoặc tương tác browser** ở 375, 768, 1024 và 1440px. Không có ảnh chụp màn hình, số đo overflow thực tế hoặc log console trình duyệt để khẳng định sạch console.

SSR không chạy effect: trang danh sách/chi tiết được kiểm tra markup lúc tải, service được kiểm tra riêng với API thật. Chưa xác minh luồng chuyển từ loading sang thành công/lỗi trên DOM trình duyệt, mở hamburger, focus bàn phím, image onError hoặc Back/Forward bằng thao tác thực tế. Đã đọc source và kiểm tra CSS cho bốn breakpoint, sửa nguy cơ từ khóa dài gây tràn và rule font ghi đè Tailwind; đây không phải nghiệm thu hiển thị.

Không phát hiện lỗi còn lại qua lint/build/unit/SSR/API. Ảnh món/danh mục SQL Server hiện NULL, có fallback trung tính. Hero PNG 2,82 MB chưa tối ưu băng thông. Chưa chạy lại 199 test Backend vì mã nguồn Backend/database không thay đổi; đã kiểm tra endpoint đọc trực tiếp phục vụ tích hợp.

## Chạy thử và checklist browser còn lại

Mở hai terminal tại gốc:

```powershell
# Terminal 1
Set-Location server
npm run dev
```

```powershell
# Terminal 2
Set-Location client
npm run dev
```

Mở `http://127.0.0.1:5173` và kiểm tra tại từng chiều rộng 375/768/1024/1440px:

1. Home đủ hero, 8 danh mục, 8 món; không tràn ngang; ảnh và chữ không chồng lấn.
2. Navbar active, hamburger mở/đóng và Escape hoạt động; tất cả menu/CTA đến trang đúng.
3. Nhấn danh mục → URL categoryId và món đúng; nhấn card → công thức đúng, định lượng và thứ tự bước đúng.
4. Tìm “trứng”, lọc danh mục/thời gian/độ khó, đổi cả 5 sort, chuyển trang; URL đồng bộ, reset/refresh/Back/Forward phục hồi đúng.
5. Tìm từ khóa không tồn tại; thử `?page=100000` và URL sai; có empty/reset/về trang đầu phù hợp.
6. Bật network throttling xem skeleton; dừng Backend xem error, khởi động lại và bấm Thử lại. Không có dữ liệu giả hoặc màn hình trắng.
7. Tab qua menu, form, pagination, card; focus nhìn rõ; kiểm tra console không lỗi nghiêm trọng.
8. Vào 7 trang tương lai và route lạ: thông báo đúng, không có form đăng nhập/Admin giả.

Chọn nguyên liệu, kết quả gợi ý và điều chỉnh khẩu phần trên giao diện chưa triển khai. Chỉ thực hiện Bước 6 khi người dùng yêu cầu.
