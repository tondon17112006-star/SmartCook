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
| Server | `npm audit --json` | 0 | 0 advisory được báo |
| Server | `npm audit --omit=dev --json` | 0 | 0 advisory production được báo |

Lần chạy lại cuối cùng trong đợt QA xác nhận cả bốn audit trên đều trả mã 0 và báo 0 advisory; `npm ls --all --json` của cả Client và Server cũng trả mã 0. Không chạy `npm audit fix`, không thay `package.json` hoặc lockfile. Kết quả audit chỉ phản ánh dữ liệu registry tại thời điểm kiểm tra, không chứng minh toàn bộ dependency không có lỗi bảo mật.

## Advisory công cụ phát triển đã ghi nhận trước đó

Lần kiểm tra trước đó của Bước 11 từng ghi một advisory dev-only ở chuỗi `nodemon@3.1.14 → chokidar@3.6.0 → braces@3.0.3`. Lần chạy lại hiện tại của `npm audit --json` không còn báo advisory này, dù dependency tree vẫn hợp lệ và không có package nào được sửa trong đợt tiếp tục QA.

Đây là thay đổi trong dữ liệu audit từ registry, không phải bằng chứng rằng vấn đề lịch sử đã được vá ở package tree hay rằng dependency hoàn toàn không có rủi ro. Duy trì `npm ci --omit=dev` và `npm start` cho production; lặp lại audit trước mỗi lần phát hành. Không ép override hoặc nâng/hạ major dependency chỉ để thay đổi kết quả audit.

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
