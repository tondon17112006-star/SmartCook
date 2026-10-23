# Báo cáo kiểm tra khởi tạo

Đây là báo cáo lịch sử **Bước 1**. Cấu trúc và dữ liệu SQL Server bổ sung ở Bước 2 được ghi riêng tại [DATABASE_VERIFICATION.md](DATABASE_VERIFICATION.md).

Ngày kiểm tra: **16/10/2026**, múi giờ Việt Nam. Workspace: `C:\Users\MyPC\Desktop\SmartCook`.

## Phiên bản đã cài thực tế

| Công nghệ | Phiên bản |
| --- | --- |
| Node.js | 26.6.0 |
| npm | 11.18.0 |
| Git | 2.55.0.windows.3 |
| React / React DOM | 19.3.1 |
| Vite | 8.3.4 |
| Plugin React của Vite | 6.1.2 |
| Tailwind CSS / plugin Vite | 4.3.3 |
| React Router DOM | 7.18.4 |
| Axios | 1.20.0 |
| Lucide React | 1.58.0 |
| Oxlint | 1.88.0 |
| Express | 5.3.0 |
| CORS | 2.8.6 |
| dotenv | 18.0.8 |
| mssql | 12.7.9 |
| bcrypt | 6.0.0 |
| jsonwebtoken | 9.0.3 |
| nodemon | 3.1.14 |

Phiên bản được xác nhận từ môi trường và `npm ls --depth=0`. Cây phụ thuộc chính xác nằm trong hai `package-lock.json`. Vite chấp nhận Node hiện tại; plugin Tailwind tương thích với Vite đang cài. Không dùng `--force` hoặc `--legacy-peer-deps`.

## Kết quả kiểm tra thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| `node -v`, `npm -v` | Đạt; phiên bản như bảng trên |
| `git init`, `git rev-parse --show-toplevel` | Git riêng tại đúng workspace SmartCook |
| `npm ls --depth=0` ở hai ứng dụng | Đạt, không báo cây phụ thuộc không hợp lệ |
| `npm run lint` tại `client` | Đạt, 0 lỗi và 0 cảnh báo |
| `npm run build` tại `client` | Đạt; tạo bản build trong `client/dist` |
| `npm run dev` tại `server` | nodemon khởi động Express thành công tại `127.0.0.1:5000` |
| `GET http://127.0.0.1:5000/api/health` | HTTP 200, `status=ok`, đúng tên service và timestamp hợp lệ |
| `npm run dev` tại `client` | Vite khởi động thành công tại `127.0.0.1:5173` |
| `GET http://127.0.0.1:5173/` | HTTP 200, tiêu đề SmartCook, thuộc tính ngôn ngữ `vi` |
| `GET http://127.0.0.1:5173/api/health` | HTTP 200; proxy chuyển đến Express và trả JSON hợp lệ |
| Module JSX, CSS, SVG và favicon qua Vite | HTTP 200, nội dung không rỗng |
| Truy cập đường dẫn Frontend bất kỳ qua Vite | Trả HTML cho React Router xử lý |
| Origin Frontend trong whitelist | Được cho phép; header CORS đúng origin |
| Origin ngoài whitelist | HTTP 403 |
| `GET /api/missing` tại Backend | HTTP 404, thông báo tiếng Việt |
| Header `x-powered-by` | Không xuất hiện |
| bcrypt hash/compare | Chạy thành công trên Node hiện tại |
| JWT sign/verify với khóa thử chỉ trong tiến trình | Chạy thành công, không tạo tính năng đăng nhập |
| Import `mssql.ConnectionPool` | Thành công, không mở kết nối SQL Server |
| Git ignore | Bỏ qua node_modules, dist, cache, `.env`; giữ hai `.env.example` |

Ví dụ phản hồi được ghi nhận khi kiểm tra proxy:

```json
{
  "status": "ok",
  "service": "SmartCook API",
  "timestamp": "2026-10-16T12:43:19.164Z"
}
```

Đây là kiểm tra build, lint, HTTP và rà soát mã nguồn. Chưa kiểm tra hiển thị/tương tác trực tiếp trong trình duyệt vì không có trình duyệt được kết nối với công cụ kiểm tra. Health không phải kiểm tra cơ sở dữ liệu.

## Cảnh báo còn lại

- Frontend: audit trong quá trình cài đặt báo **0 vulnerabilities**.
- Backend: `npm audit --omit=dev` báo **0 vulnerabilities**.
- Backend audit đầy đủ còn **3 high** trong chuỗi phụ thuộc phát triển `nodemon → chokidar → braces`. Theo [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), `braces <= 3.0.3` bị ảnh hưởng và chưa có bản vá tại thời điểm kiểm tra. Registry hiện có bản mới nhất là 3.0.3. Không áp dụng đề xuất downgrade nodemon qua major hoặc ép override không tương thích. Khi có bản vá, cập nhật lockfile và kiểm tra lại nodemon.
- npm có thông báo chính sách install script của bcrypt; binary có sẵn đã được kiểm tra bằng hash/compare thành công, không cần thay đổi cấu hình npm toàn cục.

Không còn lỗi build hoặc lỗi khởi động trong các kiểm tra đã thực hiện. Các tiến trình chạy thử đã được dừng trước khi bàn giao. Chưa tạo `.env` thật, database, schema, tài khoản, commit hoặc triển khai lên hosting.

## File đã tạo

- Gốc: `.gitignore`, `README.md`, `PLAN.md` và repository `.git/` riêng.
- `client`: `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `.oxlintrc.json`, `vite.config.js`, `index.html`, `public/favicon.svg`.
- `client/src`: `main.jsx`, `App.jsx`, `index.css`; `assets/fresh-bowl.svg`; `pages/HomePage.jsx`, `pages/NotFoundPage.jsx`; `components/HealthStatusCard.jsx`; `layouts/MainLayout.jsx`; `services/api.js`, `services/healthService.js`; `hooks/useHealthCheck.js`, `hooks/useApiHealth.js`; `context/ApiHealthContext.js`, `context/ApiHealthProvider.jsx`.
- `server`: `package.json`, `package-lock.json`, `.env.example`.
- `server/src`: `app.js`, `server.js`; `config/env.js`; `routes/api.routes.js`; `controllers/health.controller.js`; `services/health.service.js`; `middlewares/not-found.js`, `middlewares/error-handler.js`; `utilities/config.js`, `utilities/listen-error.js`.
- Tài liệu: `database/README.md`, `docs/architecture.md`, `docs/verification.md`.
- File sinh tự động và bị Git bỏ qua: `client/node_modules/`, `server/node_modules/`, `client/dist/`, `.npm-cache/`.

Không tạo thư mục SmartCook lồng nhau; không thao tác chỉnh sửa repository cha hoặc cài thư viện npm toàn cục. Cache và log npm của các lệnh khởi tạo được đặt trong `.npm-cache` của workspace.
