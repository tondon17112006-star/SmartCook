# Bước 11 — Báo cáo kiểm thử tổng thể SmartCook

Ngày kiểm thử: **23/10/2026**. Phạm vi là Bước 11; không triển khai Bước 12, không commit/push/đổi nhánh, không sửa `.env`, seed hay schema.

## Mục tiêu và phạm vi

Xác nhận hồi quy Frontend/Backend, bảo mật ứng dụng, dependency, SQL Server integrity, rollback của fixture, đo hiệu năng tải nhẹ và một browser smoke test read-only. Các luồng ghi qua test fixture nằm trong transaction và rollback; không tạo hoặc nâng quyền Admin thật.

## Môi trường

| Hạng mục | Giá trị thực tế |
| --- | --- |
| Node.js | `v26.6.0` |
| Client | React 19 + Vite 8, `http://127.0.0.1:5173` |
| Server | Express 5, `http://127.0.0.1:5000/api` |
| Database | `SmartCookDB`, kết nối Shared memory với encryption `TRUE` |
| Dữ liệu đọc lúc kết thúc | 8 Categories, 64 Ingredients, 20 Recipes, 148 RecipeIngredients, 80 CookingSteps |
| Dữ liệu nghiệp vụ lúc kết thúc | Users/Favorites/Reviews/UserIngredients/SearchHistory đều là `0`; Users có Role `Admin` là `0` |

`npm run check:db` trả HTTP/database status `ok`, đúng database `SmartCookDB`, 20 recipes. Mười bảng được kiểm tra qua catalog SQL, các hash snapshot trước/sau test và số lượng sau regression. Không còn dữ liệu fixture hoặc tài khoản Admin trong database.

## Lệnh và kết quả

| Nhóm | Lệnh | Kết quả |
| --- | --- | --- |
| Frontend lint | `npm run lint` | Passed |
| Frontend build | `npm run build` | Passed; 2.081 modules được transform |
| Frontend unit/DOM | `npm test` | **188 passed, 0 failed** |
| Frontend integration với React + HTTP + SQL | `npm run test:integration` | **13 passed, 0 failed** |
| Backend unit/HTTP/security | `npm test` | **161 passed, 0 failed** |
| Backend integration với SQL | `npm run test:integration` | **197 passed, 0 failed** |
| Database integrity riêng | `node --test tests/database-integrity.integration.test.js` | **8 passed, 0 failed** |
| Kết nối database | `npm run check:db` | Passed |
| Dependency tree | `npm ls --all --json` tại Client/Server | Cả hai exit 0 |
| npm audit | Full và `--omit=dev` tại Client/Server | Cả bốn lần **0 advisory** |

## Database integrity

`server/tests/database-integrity.integration.test.js` hiện kiểm tra:

- 10 bảng có Primary Key đúng; 12 Foreign Key, các UNIQUE và CHECK constraints tồn tại, enabled và trusted.
- `DBCC CHECKCONSTRAINTS` lần lượt cho mọi FK/CHECK, không có vi phạm.
- Tất cả recipe hiện có có nguyên liệu bắt buộc, cooking steps liên tiếp và `database/verify.sql` chạy read-only thành công.
- `Favorites`, `Reviews`, `UserIngredients`, `SearchHistory` và Users được ghi thử trong **một** `SERIALIZABLE` transaction; sau đó rollback và so sánh lại SHA-256 snapshot của đủ 10 bảng.

Không thực hiện `DROP`, `TRUNCATE`, `DELETE` dữ liệu thật, thay đổi schema, reseed hoặc tạo/nâng quyền Admin.

## Security và dependency

Các regression đã chạy lại chứng minh: JWT signature/issuer/audience/expiry không hợp lệ bị từ chối; logout/re-login/restart thu hồi phiên theo thiết kế; cookie HttpOnly, CSRF, Origin/CORS, role SQL hiện thời, rate limiting, DTO không có password hash, validation, parameter binding và SQL/LIKE injection được kiểm tra. Frontend cũng có regression cho hai race condition: response Login/Register về muộn không điều hướng lại một form mà người dùng đã rời.

Không tìm thấy advisory trong bốn lượt `npm audit` hiện tại. Tài liệu dependency vẫn ghi lại rằng một advisory dev-only từng xuất hiện trong lần chạy trước, nhưng lần audit hiện tại không báo nó; không thay package hoặc lockfile để làm thay đổi kết quả. Chi tiết xem [STEP11_DEPENDENCIES.md](STEP11_DEPENDENCIES.md).

## Đo hiệu năng tải nhẹ

Phương pháp: local development, một warm-up và 5 request **tuần tự** cho mỗi endpoint, concurrency 1, không stress/load test. Số liệu là round-trip local của `performance.now()`; không phải SLA hay đại diện production.

| Endpoint | Min ms | Median ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: | ---: |
| `GET /health` | 0.81 | 0.91 | 1.54 | 1.54 |
| `GET /health/db` | 1.69 | 2.01 | 2.28 | 2.28 |
| `GET /categories` | 1.59 | 1.69 | 1.83 | 1.83 |
| `GET /ingredients?search=Trứng&limit=20` | 1.77 | 1.85 | 2.92 | 2.92 |
| `GET /recipes?limit=12` | 2.09 | 2.53 | 3.43 | 3.43 |
| `GET /recipes/8` | 2.31 | 2.45 | 3.06 | 3.06 |
| `POST /recipes/suggest` | 7.81 | 8.65 | 37.75 | 37.75 |

Các endpoint fixture an toàn (auth/favorites/pantry/admin) cũng được đo tuần tự. `suggest` thực hiện 3 SQL round trips cho cả limit 1 và 12, danh sách recipes 1 round trip cho cả hai limit, và detail recipe 1 round trip. Test fixture dùng outer transaction rollback.

## Browser smoke test thực tế

Đã dùng local browser tại `127.0.0.1`, không nhập dữ liệu/tạo bản ghi. Console không có error/warning. Đây chỉ là smoke test read-only; không thay thế từng ca trong checklist thủ công.

| Viewport | Route | Bằng chứng quan sát |
| --- | --- | --- |
| 375×812 | `/` | Menu mobile collapse hiển thị, 8 thẻ món featured, không overflow ngang (`360 ≤ 375`) |
| 768×900 | `/recipes` | 20 công thức, filter/search/pagination render, không overflow ngang (`753 ≤ 768`) |
| 1024×900 | `/recipes/8` | Trứng chiên, 5 nguyên liệu và 4 bước render, không overflow ngang (`1009 ≤ 1024`) |
| 1440×960 | `/ingredients` | Navigation desktop, 64 nguyên liệu và khối chọn nguyên liệu render, không overflow ngang (`1425 ≤ 1440`) |

Guest mở trực tiếp `/favorites`, `/pantry` và `/admin` đều chuyển tới `/login`; trang login sau đó có email/password fields. Chưa thử thao tác ghi, account thật, fixture Admin trong browser hay HTTPS thật.

## Thay đổi trong lần tiếp tục Bước 11

- Mở rộng `server/tests/database-integrity.integration.test.js` bằng regression ghi aggregate trong transaction và xác nhận rollback/snapshot.
- Mở rộng `server/tests/helpers/measure-performance.js` để đo thêm `GET /api/health/db`.
- Cập nhật [STEP11_DEPENDENCIES.md](STEP11_DEPENDENCIES.md) theo kết quả audit hiện tại và hoàn thiện checklist/report Bước 11.

Không có bug runtime mới cần sửa trong lần tiếp tục. Hai race condition điều hướng Login/Register đã được sửa trước khi gián đoạn; regression của chúng vẫn passed.

## Giới hạn và việc còn lại

- Chưa kiểm thử toàn bộ thao tác browser thực tế tại các viewport: form ghi, modal, keyboard/focus, account A/B, Admin fixture và error injection browser vẫn là **Not Tested** thủ công.
- Chưa xác nhận cookie `Secure`/`__Host` trên HTTPS thật, TLS/hạ tầng production, nhiều instance/session store hoặc load/concurrency production.
- Hero PNG build vẫn khoảng 2.82 MB và chưa có `srcSet`/WebP/AVIF; chưa có đo LCP/CLS/waterfall trình duyệt.
- npm audit là snapshot registry tại thời điểm chạy, không phải chứng nhận toàn diện không còn lỗ hổng.

## Đánh giá sẵn sàng

**Bước 11 hoàn thành trong phạm vi tự động, SQL integrity, light performance và browser smoke read-only.** Có thể chuyển sang Bước 12 nếu chủ dự án chấp nhận các giới hạn thủ công/HTTPS nêu trên; không có Bước 12 nào được thực hiện trong đợt này.
