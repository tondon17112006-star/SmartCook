# Tổng kết kiểm thử SmartCook

## Phạm vi và môi trường

Kết quả dưới đây là lượt kiểm thử cuối Bước 12 ngày 23/10/2026. Môi trường ghi nhận: Node.js 26.6.0, SmartCookDB, Windows Authentication, kết nối Shared memory, encrypted TRUE. Lượt chạy sử dụng source/documentation bàn giao hiện tại, không thay auth, schema, seed, dependency hoặc configuration.

## Kết quả kiểm thử cuối Bước 12

| Phạm vi | Lệnh | Kết quả ghi nhận |
| --- | --- | --- |
| Frontend lint | client: npm run lint | Pass |
| Frontend build | client: npm run build | Pass |
| Frontend unit/DOM | client: npm test | 188 passed, 0 failed, 0 skipped |
| Frontend integration | client: npm run test:integration | 13 passed, 0 failed, 0 skipped |
| Backend unit/HTTP/security | server: npm test | 161 passed, 0 failed, 0 skipped |
| Backend integration | server: npm run test:integration | 197 passed, 0 failed, 0 skipped |
| Database integrity | database-integrity integration suite, thuộc backend integration | 8 passed, 0 failed |
| DB connection | server: npm run check:db | SmartCookDB, 20 recipes, encrypted TRUE |

Tổng bốn runner frontend/backend là 559 bài passed (188 + 13 + 161 + 197); 8 case database integrity là một phần của 197 backend integration, không cộng thêm lần nữa. Không thay thế số liệu này bằng số liệu lịch sử Bước 10.

## Database integrity

Suite integrity kiểm tra 10 bảng, PK/FK/UNIQUE/CHECK, DBCC CHECKCONSTRAINTS, cấu trúc recipe và verify.sql. Một fixture aggregate ghi Users/Favorites/Reviews/UserIngredients/SearchHistory bên trong transaction SERIALIZABLE rồi rollback; snapshot SHA-256 của 10 bảng được so lại.

Snapshot dữ liệu được ghi nhận trước/sau Bước 11:

| Table | Rows |
| --- | ---: |
| Users | 0 |
| Categories | 8 |
| Ingredients | 64 |
| Recipes | 20 |
| RecipeIngredients | 148 |
| CookingSteps | 80 |
| Favorites | 0 |
| Reviews | 0 |
| UserIngredients | 0 |
| SearchHistory | 0 |

## API performance – baseline local

Đo tại development local, warm-up một request và 5 request tuần tự cho mỗi endpoint, concurrency 1. Đây không phải load test hoặc SLA production.

| Endpoint | Median ms | p95 ms |
| --- | ---: | ---: |
| GET /health | 0.91 | 1.54 |
| GET /health/db | 2.01 | 2.28 |
| GET /categories | 1.69 | 1.83 |
| GET /ingredients?search=Trứng&limit=20 | 1.85 | 2.92 |
| GET /recipes?limit=12 | 2.53 | 3.43 |
| GET /recipes/8 | 2.45 | 3.06 |
| POST /recipes/suggest | 8.65 | 37.75 |

Suggestions thực hiện 3 SQL round trip ở limit 1 và 12; recipe list 1 round trip và detail 1 round trip trong phép đo này. Hero image/browser waterfall/LCP/CLS chưa được đo.

## Security và dependencies

- Regression đã bao phủ JWT signature/issuer/audience/expiry, revoke/restart, HttpOnly cookie, CSRF, Origin/CORS, role từ SQL, rate limiting, DTO, validation và SQL/LIKE injection.
- Lượt Bước 12 chạy lại npm ls của client/server và bốn audit (full + omit=dev cho mỗi app): tất cả exit 0, 0 advisory.
- Một advisory dev-only trước đó ở nodemon/chokidar/braces không còn xuất hiện ở snapshot audit hiện tại; không có package/lockfile nào được đổi để khẳng định đã vá.
- .env bị ignore; client/server .env.example chỉ có placeholder. Không thấy JWT hoặc password được lưu trong localStorage.

## Browser smoke đã thực hiện

Đây là smoke read-only với browser local, không tạo/ghi dữ liệu:

| Viewport | Route | Quan sát |
| --- | --- | --- |
| 375×812 | / | Menu mobile, featured cards, không overflow ngang |
| 768×900 | /recipes | Search/filter/pagination, không overflow ngang |
| 1024×900 | /recipes/8 | Detail, ingredient và steps render, không overflow ngang |
| 1440×960 | /ingredients | Navigation desktop, 64 nguyên liệu, không overflow ngang |

Console không có error/warning trong smoke. Guest mở trực tiếp /favorites, /pantry và /admin được chuyển đến /login.

## Chưa kiểm thử trực quan

- Toàn bộ form/mutation browser, confirmation dialog, error injection và account A/B.
- Admin bằng account SQL thật được cấp phép.
- Keyboard traversal, focus trap/modal, screen reader, contrast thực đo, zoom/reduced motion.
- HTTPS thật: cookie Secure/__Host, TLS, CORS qua hạ tầng production.
- Load/concurrency nhiều user, multi-instance session store, deadlock/race production.

Xem [STEP11_TEST_REPORT.md](STEP11_TEST_REPORT.md) và [STEP11_MANUAL_CHECKLIST.md](STEP11_MANUAL_CHECKLIST.md) để có evidence/checklist chi tiết.
d