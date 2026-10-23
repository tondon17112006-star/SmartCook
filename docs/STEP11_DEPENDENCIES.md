# Bước 11 — Dependency và tài nguyên frontend

Kiểm tra ngày **23/10/2026** tại workspace SmartCook. Đây là bằng chứng bổ sung cho `STEP11_TEST_REPORT.md`; không thay thế kiểm thử chức năng hoặc kiểm thử trình duyệt.

## Lệnh và kết quả thực tế

Các lệnh npm dùng cache nằm trong `.npm-cache` của workspace. Không chạy `npm audit fix`, không thay `package.json` hoặc lockfile.

| Ứng dụng | Lệnh | Exit code npm | Kết quả |
|---|---|---:|---|
| Client | `npm ls --all --json` | 0 | Cây dependency hợp lệ |
| Server | `npm ls --all --json` | 0 | Cây dependency hợp lệ |
| Client | `npm audit --json` | 0 | 0 advisory được báo |
| Client | `npm audit --omit=dev --json` | 0 | 0 advisory production được báo |
| Server | `npm audit --json` | 1 | 3 package node mức high, cùng một advisory gốc |
| Server | `npm audit --omit=dev --json` | 0 | 0 advisory production được báo |

Kết quả audit chỉ phản ánh dữ liệu registry tại thời điểm kiểm tra, không chứng minh toàn bộ dependency không có lỗi bảo mật. File JSON gốc được lưu cục bộ trong `.cache/step11-client-full.json`, `step11-client-prod.json`, `step11-server-full.json`, `step11-server-prod.json`, `step11-client-ls.json`, `step11-server-ls.json`; `.cache` không đưa lên Git.

## Advisory còn tồn tại trong công cụ phát triển

Server có chuỗi `nodemon@3.1.14 → chokidar@3.6.0 → braces@3.0.3`, chỉ thuộc **dev dependency**. `npm audit` tính cả ba package bị ảnh hưởng, không phải ba CVE độc lập.

[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) mô tả nguy cơ tràn call stack khi `braces` xử lý pattern lồng quá sâu. Advisory ghi các bản `≤3.0.3` bị ảnh hưởng và chưa có phiên bản vá. `npm view` thực tế xác nhận `braces` mới nhất vẫn là `3.0.3`, `nodemon` mới nhất là `3.1.14`.

Trong source hiện tại, HTTP handler không đưa input người dùng vào `braces`, `chokidar` hoặc `nodemon`. Script production `npm start` gọi `node src/server.js`; nodemon chỉ dùng cho `npm run dev`. Vì vậy chưa xác định đường khai thác từ REST API trong cấu hình hiện tại; rủi ro còn lại liên quan công cụ theo dõi file và pattern ở môi trường phát triển. Đây là phân tích phạm vi từ source và cây dependency, không phải cam kết không thể khai thác.

Gợi ý tự động của npm là hạ `nodemon` xuống `1.14.10` bằng thay đổi semver major. Không áp dụng vì đây không phải bản vá tương thích của stack hiện tại. Không ép `chokidar` major mới bằng override vì nodemon đang yêu cầu nhánh 3 và cần xác minh tương thích riêng. Khi triển khai production, dùng `npm ci --omit=dev` và `npm start`; theo dõi bản vá chính thức trước lần cập nhật dependency tiếp theo. Không dùng pattern lấy từ nguồn không tin cậy cho công cụ phát triển.

## Phiên bản cài thực tế

- Client: React/React DOM `19.3.1`, React Router DOM `7.18.4`, Axios `1.20.0`, Lucide React `1.58.0`; Vite `8.3.4`, Tailwind CSS và plugin Vite `4.3.3`, plugin React `6.1.2`, jsdom `26.1.0`, oxlint `1.88.0`.
- Server: Express `5.3.0`, cors `2.8.6`, dotenv `18.0.8`, bcrypt `6.0.0`, jsonwebtoken `9.0.3`, mssql `12.7.9`, msnodesqlv8 `5.6.0`; nodemon `3.1.14` chỉ dùng dev.

## Kích thước tài nguyên build

Đo từ byte thực của `client/dist/assets`; gzip được tính cục bộ bằng Node `zlib.gzipSync`, không khẳng định server đang bật gzip hoặc trình duyệt đã tải đúng lượng byte này.

| Tài nguyên | Byte chưa nén | Byte gzip cục bộ |
|---|---:|---:|
| Hero PNG `1448×1086` | 2.822.786 | 2.777.505 |
| JavaScript entry | 433.712 | 125.657 |
| Chunk dùng chung authenticatedRequest | 64.674 | 24.007 |
| CSS entry | 58.683 | 10.499 |
| AdminRecipeForm | 14.867 | 4.723 |

Các trang Admin đã tách bằng `React.lazy`/dynamic import; không gộp tất cả trang quản trị vào entry. Số byte từng file và tên hash của build được lưu cục bộ tại `.cache/step11-asset-sizes.json`; tên hash có thể đổi sau khi sửa source.

Ảnh hero có `width`, `height`, `fetchPriority="high"`; ảnh thẻ món, danh mục, nguyên liệu dùng `loading="lazy"`, `decoding="async"`, khung cố định bằng CSS aspect ratio và fallback khi tải lỗi. Tuy nhiên hero PNG khoảng **2,82 MB**, chưa có `srcSet`/WebP/AVIF; đây là điểm cần tối ưu tiếp và có thể làm tăng lượng tải trên điện thoại. Chưa có số LCP/CLS hoặc waterfall từ trình duyệt, không tự đặt ngưỡng Passed cho tốc độ tải ảnh. Không tự tải ảnh URL ngoài hoặc sửa ảnh/dữ liệu SQL trong đợt này.

Kiểm tra source cho thấy `useApiResource`, `PantryProvider` và `useAdminData` có AbortController/cleanup, tránh phản hồi cũ ghi đè và trì hoãn khởi phát request để lần effect bị hủy của StrictMode không tạo I/O dư. Đây là rà soát source bổ trợ; kết quả regression race/duplicate request phải lấy từ các test thực chạy trong báo cáo chính. API phân trang thông thường giới hạn `limit≤100`, Suggestions `limit≤50`; catalog nguyên liệu hiện tại 64 dòng nên chỉ cần một trang 100 dòng. Không thực hiện load test mạnh trên SmartCookDB.
