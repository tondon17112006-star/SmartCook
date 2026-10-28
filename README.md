# SmartCook

Website hướng dẫn nấu ăn dựa trên nguyên liệu có sẵn. Toàn bộ giao diện sử dụng tiếng Việt. Bước1–12 đã hoàn thành theo phạm vi đồ án: khám phá/gợi ý công thức, Cooking Mode, xác thực, cá nhân hóa, khu vực quản trị, database integrity, browser smoke read-only và tài liệu bàn giao. Lượt chốt Bước 12 ngày 23/10/2026: lint/build pass; 188 unit/DOM + 13 integration ở frontend; 161 unit/HTTP/security + 197 integration ở backend; check-db xác nhận SmartCookDB mã hóa với 20 công thức. Xem [tổng kết kiểm thử](docs/TEST_SUMMARY.md) để biết bằng chứng và giới hạn nghiệm thu.

**Hoàn thiện Meal Planner ngày 28/10/2026:** Lịch nấu ăn 7 ngày tại `/meal-planner` và Danh sách đi chợ đã hoàn thành chức năng, tích hợp và kiểm thử tự động. Frontend lint/build đạt, **212 unit/DOM + 14 integration** đạt; Backend **190 unit/HTTP + 215 integration** đạt, tổng **631 đạt, 0 thất bại, 0 bỏ qua**. Migration 001 đã chạy ngày 27/10, SmartCookDB hiện có **12 bảng**; lượt này không chạy lại migration. Hash/count 10 bảng cũ, cấu hình và dữ liệu Pantry được bảo toàn. **Browser trực quan 375/768/1024/1440px và stress nhiều kết nối SQL độc lập vẫn Not Tested**. Xem [kết quả và giới hạn Meal Planner](docs/MEAL_PLANNER_VERIFICATION.md).

## Mục tiêu và phạm vi

SmartCook giúp Guest tìm món từ nguyên liệu có sẵn, xem nguyên liệu thiếu và theo dõi quy trình nấu. User có thêm profile, Favorites, Reviews, lịch nấu ăn theo tuần và danh sách nguyên liệu cần mua; Pantry cũ được duy trì để tương thích dữ liệu/API. Admin đã được cấp quyền có thể quản trị catalog/nội dung. Ứng dụng không tự quy đổi đơn vị, khẳng định đủ lượng tại nhà hoặc triển khai hạ tầng production. Xem [tổng quan dự án](docs/PROJECT_OVERVIEW.md), [yêu cầu hệ thống](docs/REQUIREMENTS.md) và [hướng dẫn Meal Planner](docs/MEAL_PLANNER.md).

## Phân quyền

| Vai trò | Khả năng |
| --- | --- |
| Guest | Xem/tìm/lọc công thức, chọn nguyên liệu, xem gợi ý/đánh giá và đăng ký/đăng nhập |
| User | Profile, Favorites, Reviews, Meal Planner và Shopping List của chính mình; Pantry tương thích vẫn được giữ |
| Admin | Dashboard, quản lý công thức/danh mục/nguyên liệu, xem Users và quản lý Reviews |

Phân quyền được kiểm tra ở Express bằng role hiện thời từ SQL Server; guard frontend không thay thế kiểm tra server. Không có Admin mặc định.

## Công nghệ

- Frontend: React, Vite, JavaScript, Tailwind CSS, React Router, Axios, Lucide React.
- Backend: Node.js, Express, CORS, dotenv; nodemon cho phát triển.
- Database: **Microsoft SQL Server 2019**, tên `SmartCookDB`. Backend dùng `mssql` + `msnodesqlv8` và connection pool với Windows Authentication. Xác thực dùng JWT trong HttpOnly Cookie và HMAC-SHA384 + bcrypt.
- IDE: Visual Studio Code.

Kết quả Bước10 tại [báo cáo quản trị](docs/STEP10_VERIFICATION.md), lịch sử [Bước9](docs/STEP9_VERIFICATION.md) và [Bước8](docs/AUTH_VERIFICATION.md) được giữ nguyên. `package-lock.json` trong từng ứng dụng khóa cây phụ thuộc để cài lại bằng `npm ci`.

## Yêu cầu môi trường

- Node.js đáp ứng `engines` trong hai `package.json`. Môi trường khởi tạo đã kiểm tra với Node.js **26.6.0**, npm **11.18.0**.
- Vite yêu cầu Node.js 20.19+ hoặc 22.12+ theo [tài liệu chính thức](https://vite.dev/guide/); khi đổi Node, kiểm tra thêm `engines` của phiên bản thư viện đang khóa.
- Git và Visual Studio Code.
- Chạy giao diện và `/api/health` không cần SQL Server. Để thực thi script Bước 2 cần SQL Server 2016+ và tài khoản đủ quyền; xem [hướng dẫn database](database/README.md). `/api/health` không chứng minh kết nối SQL Server.
- API dữ liệu Bước 3 cần SQL Server đang chạy, quyền đọc của tài khoản Windows chạy Node và driver ODBC x64. Máy hiện tại dùng SQL Server Native Client 11.0 có sẵn; môi trường production yêu cầu ODBC Driver 17/18, mã hóa và chứng chỉ đáng tin cậy.

## Cấu trúc

```text
SmartCook/
├── client/               # React + Vite
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── services/
│       └── utilities/       # Chuẩn hóa URL bộ lọc
│   └── tests/               # Kiểm thử URL/tìm kiếm/phân trang
├── server/               # Express
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       ├── services/
│       └── utilities/
├── database/             # schema.sql, seed.sql, verify.sql và hướng dẫn chạy
├── docs/
├── .gitignore
├── PLAN.md
└── README.md
```

Thư mục `SmartCook` hiện tại là gốc dự án, đã có Git repository riêng. Không tạo thêm thư mục `SmartCook` bên trong. Đợt Meal Planner tiếp tục trên nhánh `feature/weekly-meal-planner`, giữ các thay đổi chưa commit để chủ dự án review; không commit, push, đổi nhánh hoặc sửa cấu hình Git toàn cục.

## Chạy môi trường phát triển trên Windows

Mở thư mục dự án bằng Visual Studio Code, dùng hai terminal PowerShell riêng.

### Terminal 1 — Backend

```powershell
Set-Location C:\Users\MyPC\Desktop\SmartCook
$env:npm_config_cache = Join-Path (Get-Location) '.npm-cache'
Set-Location server
npm ci
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
npm run setup:auth
npm run dev
```

Chỉ chạy `Copy-Item` khi chưa có `.env`; không ghi đè cấu hình cá nhân. Sau lần thiết lập đầu, chỉ cần vào `server` và chạy `npm run dev`.

Backend mặc định: **http://127.0.0.1:5000**. `server/.env` bị Git bỏ qua, chứa cấu hình Windows Authentication và hai khóa auth riêng đã được tạo cục bộ. `setup:auth` giữ nguyên khóa hợp lệ đang có; không in khóa. Health vẫn độc lập SQL Server và cấu hình auth. Thiếu khóa thì endpoint auth trả 503; tạo khóa rồi khởi động lại Backend.

### Terminal 2 — Frontend

```powershell
Set-Location C:\Users\MyPC\Desktop\SmartCook
$env:npm_config_cache = Join-Path (Get-Location) '.npm-cache'
Set-Location client
npm ci
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
npm run dev
```

Chỉ sao chép mẫu nếu `.env` chưa tồn tại. Frontend mặc định: **http://127.0.0.1:5173**. Mở trang chủ, chọn danh mục hoặc vào `/recipes` để tìm/lọc món. Backend và SQL Server cần chạy để hiện dữ liệu; khi mất kết nối, trang vẫn có thông báo và nút thử lại. Dừng mỗi tiến trình bằng `Ctrl+C` tại terminal tương ứng.

Trong lần khởi tạo này, các thư viện đã được cài sẵn. Có thể bỏ qua `npm ci` nếu thư mục `node_modules` còn nguyên.

### Biến môi trường

Mỗi ứng dụng có mẫu riêng: [client/.env.example](client/.env.example) và [server/.env.example](server/.env.example). Không có `.env` ở gốc vì gốc không phải ứng dụng chạy độc lập.

- `VITE_API_BASE_URL=/api`: Axios gọi API qua đường dẫn tương đối. Biến có tiền tố `VITE_` được đưa vào mã trình duyệt; không chứa mật khẩu hoặc JWT secret.
- `API_PROXY_TARGET=http://127.0.0.1:5000`: đích proxy `/api` của Vite trong phát triển. Nếu đổi cổng Backend, sửa biến này và khởi động lại Vite.
- `HOST`, `PORT`, `CLIENT_ORIGIN`: địa chỉ lắng nghe và danh sách origin được Backend cho phép. Khi đổi cổng Frontend, cập nhật `CLIENT_ORIGIN` và cấu hình Vite tương ứng.
- `JWT_SECRET`, `PASSWORD_PEPPER`: hai khóa ngẫu nhiên riêng (32–512 ký tự), chỉ ở Backend. Sinh bằng `npm run setup:auth`; không đổi pepper tùy tiện vì mật khẩu cũ cần đúng khóa này để đăng nhập. Sao lưu bí mật và hạn chế quyền đọc `.env`. Production dùng secret manager phù hợp.
- `AUTH_COOKIE_SECURE=false` chỉ cho HTTP local. Production bắt buộc HTTPS, Secure cookie và origin HTTPS. Thời hạn JWT cố định 15 phút; không có `JWT_EXPIRES_IN=1d`, refresh token hoặc ghi nhớ đăng nhập.
- `DB_AUTH=windows`, `DB_SERVER=lpc:localhost`, `DB_PORT=` (trống), `DB_NAME=SmartCookDB`, `DB_DRIVER=SQL Server Native Client 11.0`: cấu hình local đang dùng. `lpc:` chọn shared memory, không cần bật TCP hoặc SQL Browser.
- `DB_ENCRYPT=true`: giữ mã hóa. `DB_TRUST_SERVER_CERTIFICATE` trong mẫu mặc định `false`; `.env` local hiện dùng `true` vì chứng chỉ tự ký. Code chỉ chấp nhận ngoại lệ này ở development/test trên loopback; production bắt buộc `false`, mã hóa `true` và ODBC Driver 17/18. Không dùng cấu hình local này để triển khai production.
- `DB_CONNECTION_TIMEOUT=10000`, `DB_REQUEST_TIMEOUT=15000` tính bằng ms; `DB_POOL_MAX=10` giới hạn pool. Khi đổi môi trường, khởi động lại Backend.
- Khi dùng TCP, cấu hình `DB_SERVER` và `DB_PORT` theo instance thực tế; không đặt `DB_PORT` khi server đã gồm cổng/instance hoặc dùng `lpc:`. Chưa hỗ trợ SQL Login trong cấu hình Bước 3; không cần `DB_USER`/`DB_PASSWORD`.
- Script SQL chạy bằng SSMS hoặc tiện ích PowerShell riêng, không đọc `.env`. Không đưa `.env`, mật khẩu hoặc dữ liệu SQL Server lên Git.

Máy mới phải chạy **`database/schema.sql` → `database/migrations/001_weekly_meal_planner.sql` → `database/seed.sql` → `database/verify.sql`**. Schema nền không tự tạo hai bảng Meal Planner. Máy hiện tại đã áp migration và kiểm chứng chạy lại ngày 27/10; khi cấu trúc đã đúng chỉ cần verify, không chạy lại migration theo thói quen. Migration chỉ bổ sung hai bảng, không chuyển Pantry sang lịch. Xem [hướng dẫn cài đặt](docs/INSTALLATION.md) và [database](database/README.md).

Tailwind được tích hợp qua plugin Vite theo [hướng dẫn chính thức](https://tailwindcss.com/docs/installation/using-vite).

## Kiểm tra

Kiểm tra Backend tại `server`:

```powershell
npm run check:db
npm test
npm run test:integration
```

`check:db` kiểm tra SQL Server và mã hóa. `npm test` không cần database; integration tự mở cổng ngẫu nhiên, cần SQL Server và quyền đọc/ghi các bảng trong transaction. Bước10 tạo User/công thức/danh mục/nguyên liệu/dữ liệu cá nhân kiểm thử riêng rồi rollback; không sửa20 món mẫu hoặc tạo/nâng quyền Admin thật. Fixture Admin chỉ chiếu Role trên DTO test, mọi User SQL vẫn User. Xem [STEP10_VERIFICATION.md](docs/STEP10_VERIFICATION.md) và [ADMIN_SECURITY.md](docs/ADMIN_SECURITY.md).

Kiểm tra Frontend:

```powershell
Set-Location C:\Users\MyPC\Desktop\SmartCook\client
npm run lint
npm test
npm run build
```

Các unit/DOM test dùng fixture có kiểm soát, không cần SQL Server. Integration Frontend kiểm tra các luồng món ăn qua Backend đang chạy và SQL Server; test auth tự mở server riêng với repository SQL trong transaction rollback. Cần cài dependencies cả client và server trước khi chạy:

```powershell
# Chạy trong client khi Backend đã chạy
npm run test:integration
```

Có thể đổi API món ăn bằng `$env:SMARTCOOK_TEST_API_URL = 'http://127.0.0.1:5000/api'`. Test auth/personal/admin dùng dữ liệu riêng và rollback, không để lại tài khoản/công thức thử. jsdom kiểm tra DOM, không xác nhận layout hay chính sách cookie của browser thật. Kết quả và phần chưa kiểm chứng xem [STEP10_VERIFICATION.md](docs/STEP10_VERIFICATION.md).

Kiểm tra API khi Backend đang chạy:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Phản hồi thành công có HTTP `200`, dạng:

```json
{
  "status": "ok",
  "service": "SmartCook API",
  "timestamp": "2026-10-16T00:00:00.000Z"
}
```

`timestamp` là thời điểm thực tế theo UTC. Khi cả hai server đang chạy, có thể kiểm tra cả proxy Frontend:

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

Chạy Backend không dùng nodemon: `npm start` trong `server`. Xem thử bản build bằng `npm run preview` trong `client`; proxy phát triển không thay thế cấu hình reverse proxy/API của môi trường triển khai. Khi triển khai thật cần cấu hình riêng, chưa nằm trong giai đoạn này.

Nếu cổng đang được dùng, dừng ứng dụng trùng cổng hoặc đổi cấu hình đồng bộ. Không dừng các tiến trình khác khi chưa xác định chúng thuộc dự án.

## API dữ liệu và gợi ý

| Endpoint | Nội dung |
| --- | --- |
| `GET /api/health` | Trạng thái tiến trình API, giữ nguyên hợp đồng cũ |
| `GET /api/health/db` | Kiểm tra database đang phản hồi |
| `GET /api/categories` | Toàn bộ danh mục |
| `GET /api/ingredients` | Nguyên liệu, tìm tên, lọc nhóm và phân trang |
| `GET /api/recipes` | Món ăn, tìm/lọc/sắp xếp và phân trang |
| `GET /api/recipes/:id` | Món, danh mục, định lượng nguyên liệu và các bước nấu |
| `POST /api/recipes/suggest` | Gợi ý theo nguyên liệu bắt buộc, nguyên liệu còn thiếu và khẩu phần |

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/categories
$keyword = [Uri]::EscapeDataString('trứng')
Invoke-RestMethod "http://127.0.0.1:5000/api/recipes?search=$keyword&page=1&limit=5"
Invoke-RestMethod http://127.0.0.1:5000/api/recipes/1
```

Danh sách GET có `data` và `pagination`, page size mặc định 20, tối đa 100. Tìm kiếm giữ dấu tiếng Việt, coi `%`, `_`, `[` và `~` là ký tự thường. Chi tiết API món ăn và xác thực xem [docs/API.md](docs/API.md).

### Gợi ý món ăn — Bước 4

`POST /api/recipes/suggest` nhận JSON `ingredientIds` (1–100 ID trước loại trùng), `servings` tùy chọn (1–20), `page` mặc định 1, `limit` mặc định 12 và tối đa 50. Các ID phải là JSON number nguyên dương và tồn tại trong SQL Server.

Tỷ lệ phù hợp là số loại bắt buộc đã có chia tổng số loại bắt buộc, nhân 100 và làm tròn. Không tính nguyên liệu tùy chọn; không trả món không trùng loại bắt buộc nào hoặc không có loại bắt buộc. Thứ tự: điểm giảm dần, số loại bắt buộc còn thiếu tăng dần, thời gian tăng dần, ID tăng dần.

Phản hồi phân nhóm `matchedIngredients`, `missingIngredients`, `optionalIngredients`; `quantity` giữ định lượng gốc, `adjustedQuantity` theo khẩu phần yêu cầu. `ready` chỉ nghĩa là đủ loại bắt buộc, **không xác nhận đủ số lượng trong kho**. Không gửi `servings` thì giữ định lượng và trả `requestedServings: null`.

Ví dụ trên database hiện tại, ID 64 = Trứng gà, 18 = Dầu ăn, 9 = Cà chua. Lấy lại ID qua API khi thay bộ dữ liệu; xem ví dụ không cố định ID trong [tài liệu API](docs/API.md#post-apirecipessuggest).

```powershell
$body = @{ ingredientIds = @(64,18,9); servings = 4; page = 1; limit = 1 } | ConvertTo-Json
$result = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:5000/api/recipes/suggest' -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
$result | ConvertTo-Json -Depth 10
```

Kết quả thực tế: tổng 13 món phù hợp; món đầu Trứng chiên đạt 100%, `ready`. Định lượng gốc 3 quả trứng và 15 ml dầu cho 2 khẩu phần được điều chỉnh thành 6 quả và 30 ml cho 4 khẩu phần. [Request](docs/examples/suggestion-request.json) và [response đầy đủ](docs/examples/suggestion-response.json) đã được lưu từ lần gọi thật. Theo cờ trong SQL Server, chỉ Trứng gà + Cà chua chưa có dầu cho Trứng xào cà chua đạt 67%, không phải 100%.

Xem [thuật toán và giới hạn](docs/SUGGESTION_ALGORITHM.md) cùng [báo cáo 20 nhóm kiểm tra bắt buộc](docs/SUGGESTION_VERIFICATION.md).

## Giao diện — Bước 5–7

- `/`: hero, 8 danh mục và tối đa 8 công thức từ API, giới thiệu 3 bước và CTA.
- `/recipes`: tìm tên, lọc danh mục/thời gian/độ khó, 5 cách sắp xếp và phân trang 12 món. Bộ lọc nằm trong URL để tải lại, chia sẻ và dùng Back/Forward. SQL Server thực hiện tìm/lọc toàn bộ dữ liệu.
- `/recipes/:id`: nguyên liệu với checklist, đổi khẩu phần 1–20, đánh dấu bước, tiến độ, Cooking Mode và món liên quan từ API.
- `/ingredients`: tìm/lọc nguyên liệu thật, chọn/bỏ chọn, chip, xóa tất cả, khẩu phần 1–20 và tìm món.
- `/suggestions`: tỷ lệ phù hợp, loại đã có/còn thiếu/tùy chọn, định lượng theo khẩu phần, lọc trạng thái, phân trang và link chi tiết.
- `/login`, `/register`: đăng nhập và đăng ký; đăng ký thành công chuyển về đăng nhập.
- `/profile`: hồ sơ có ProtectedRoute, sửa họ tên/số điện thoại; email/vai trò chỉ đọc.
- `/admin`: layout quản trị riêng và Dashboard dùng SQL thật; quản lý recipes/categories/ingredients, xem users và quản lý reviews. Mọi API yêu cầu Role Admin thực tế; xem [hướng dẫn quản trị](docs/ADMIN_DASHBOARD.md).
- `/favorites`: bộ sưu tập SQL riêng, thêm/bỏ bằng trái tim, đồng bộ trạng thái và phân trang.
- `/meal-planner`: lịch riêng 7 ngày/3 bữa, nhiều món mỗi bữa, khẩu phần 1–20 và Shopping List tại `#shopping-list`.
- `/pantry`: chuyển hướng replace sang `/meal-planner` sau kiểm thử luồng lịch mới; `/legacy-pantry` giữ giao diện Pantry tương thích, API và dữ liệu UserIngredients.
- `/recipes/:id`: bổ sung đánh giá công khai, điểm trung bình và form thêm/sửa/xóa đánh giá của mình.
- Đường dẫn không tồn tại có trang 404.

Ảnh công thức/danh mục trống hoặc tải lỗi có fallback trung tính, không lấy ảnh món khác để thay. Ảnh hero riêng được tạo bằng Imagegen cho hình ảnh thương hiệu, không gắn vào dữ liệu món ăn. Các phần API có trạng thái tải/lỗi/rỗng/thử lại; không dùng dữ liệu giả khi Backend lỗi.

Báo cáo lịch sử: [Frontend Bước5](docs/FRONTEND_VERIFICATION.md), [gợi ý Bước6](docs/SUGGESTIONS_FRONTEND_VERIFICATION.md), [chi tiết/Cooking Mode Bước7](docs/RECIPE_DETAIL_VERIFICATION.md), [Bước9](docs/STEP9_VERIFICATION.md). Kết quả hồi quy hiện tại ở [Bước10](docs/STEP10_VERIFICATION.md). **Chưa kiểm thử trực quan hoặc chuột/bàn phím thật** ở375/768/1024/1440px. Đã kiểm tra DOM React và luồng gọi SQL Server thật; các kiểm tra này không xác nhận bố cục màn hình.

### Tìm món từ nguyên liệu — Bước 6

Mở `/ingredients`, chọn nguyên liệu, chọn số người ăn (mặc định 2), bấm **Tìm món ăn phù hợp**. Trang gợi ý hiển thị dữ liệu từ `POST /api/recipes/suggest`; định lượng lấy `adjustedQuantity` và giữ đơn vị API. “Đủ loại nguyên liệu chính” chỉ xác nhận loại bắt buộc, bạn vẫn cần kiểm tra lượng thực tế.

`PantryProvider` giữ ID/khẩu phần trong Context và `sessionStorage` của tab, không lưu tên/dữ liệu giả vào localStorage. Quay lại hoặc reload `/suggestions` khôi phục lựa chọn; ID bị xóa được bỏ sau khi tải đủ catalog mới. Backend lỗi không làm mất ID đã lưu. Nếu browser chặn storage, có thông báo và vẫn thao tác được trong cây Context hiện tại; lựa chọn có thể mất khi reload hoặc rời cây route này.

Nguyên liệu được tải hết các trang API trước khi tìm/lọc tại client; nhóm dựa trên nhãn thật từ SQL Server. Danh sách gợi ý “Tất cả” dùng phân trang Backend, 12 món/trang. Bộ lọc đủ/còn thiếu chỉ chạy sau khi tải đủ mọi trang phù hợp (50 món/request), tối đa 500 món; đổi giữa hai trạng thái và phân trang sau lọc không gọi lại API. Nếu vượt 500 hoặc dữ liệu thay đổi/thiếu giữa các trang, không trình bày kết quả lọc một phần; vẫn có thể quay về “Tất cả”. Đề xuất filter ở API cho quy mô lớn thuộc bước riêng, chưa sửa Backend ở Bước 6.

Chi tiết component/state/cách gọi API tại [INGREDIENT_FINDER.md](docs/INGREDIENT_FINDER.md).

### Hướng dẫn nấu ăn — Bước 7

Mở công thức, điều chỉnh số người bằng nút −/+, tích nguyên liệu đã chuẩn bị và đánh dấu các bước đã xong. **Bắt đầu nấu** mở một bước tại một thời điểm, có trước/tiếp theo, hoàn thành và thoát về toàn bộ công thức. Không có bộ đếm thời gian từng bước giả.

Định lượng luôn tính từ số gốc API: `quantity × selectedServings / originalServings`, giữ đơn vị, không nhân chồng. Nếu đến từ Suggestions, khẩu phần đã chọn được ưu tiên một lần theo lượt điều hướng; thay đổi sau đó được giữ khi reload. Mở trực tiếp lần đầu dùng khẩu phần API; đã có tiến độ cùng phiên thì khôi phục tiến độ đó. Nội dung bước nấu giữ nguyên từ SQL Server, kể cả số lượng được nhắc trong câu; trang nhắc sử dụng lượng đã điều chỉnh trong bảng nguyên liệu.

Tiến độ lưu tại `sessionStorage` theo RecipeID: khẩu phần, ID nguyên liệu đã chuẩn bị, ID bước đã hoàn thành và bước đang xem. Không ghi database; không trộn món. Khi dữ liệu đổi, ID không còn hợp lệ bị loại. **Làm lại từ đầu** xóa checklist/bước hiện tại của riêng món này, giữ số người đang chọn. Khi reload, mở Bắt đầu nấu để tiếp tục bước đã lưu. Storage bị chặn có thông báo, vẫn thao tác được trong trang hiện tại.

Chi tiết tại [RECIPE_DETAIL.md](docs/RECIPE_DETAIL.md) và [COOKING_MODE.md](docs/COOKING_MODE.md).

## Tài liệu

- [Kế hoạch phát triển](PLAN.md).
- [Kiến trúc khởi tạo](docs/architecture.md).
- [Kết quả kiểm tra](docs/verification.md).
- [Quy ước SQL Server](database/README.md).
- [Thiết kế cơ sở dữ liệu](docs/DATABASE_DESIGN.md).
- [Sơ đồ ERD](docs/ERD.md).
- [Báo cáo kiểm tra Bước 2](docs/DATABASE_VERIFICATION.md).
- [Tài liệu API](docs/API.md).
- [Báo cáo kiểm tra Backend Bước 3](docs/BACKEND_VERIFICATION.md).
- [Thuật toán gợi ý Bước 4](docs/SUGGESTION_ALGORITHM.md).
- [Báo cáo kiểm tra gợi ý Bước 4](docs/SUGGESTION_VERIFICATION.md).
- [Thiết kế Frontend Bước 5](docs/FRONTEND_DESIGN.md).
- [Kiểm chứng Frontend Bước 5](docs/FRONTEND_VERIFICATION.md).
- [Chọn nguyên liệu và gợi ý Bước 6](docs/INGREDIENT_FINDER.md).
- [Kiểm chứng giao diện gợi ý Bước 6](docs/SUGGESTIONS_FRONTEND_VERIFICATION.md).
- [Trang hướng dẫn món ăn Bước 7](docs/RECIPE_DETAIL.md).
- [Cooking Mode và tiến độ phiên](docs/COOKING_MODE.md).
- [Kiểm chứng trang chi tiết Bước 7](docs/RECIPE_DETAIL_VERIFICATION.md).
- [Xác thực và quản lý khóa Bước 8](docs/AUTHENTICATION.md).
- [Phân quyền User/Admin và cấp quyền thủ công](docs/AUTHORIZATION.md).
- [Kiểm chứng Bước 8, giới hạn và checklist chạy thử](docs/AUTH_VERIFICATION.md).
- [Món ăn yêu thích Bước 9](docs/FAVORITES.md).
- [Đánh giá và bình luận Bước 9](docs/REVIEWS.md).
- [Tủ nguyên liệu cá nhân và gợi ý](docs/MY_PANTRY.md).
- [Lịch nấu ăn 7 ngày](docs/MEAL_PLANNER.md).
- [Danh sách đi chợ và định lượng](docs/SHOPPING_LIST.md).
- [Database và migration Meal Planner](docs/MEAL_PLANNER_DATABASE.md).
- [Kiểm chứng và checkpoint Meal Planner](docs/MEAL_PLANNER_VERIFICATION.md).
- [Kiểm chứng và danh sách file Bước 9](docs/STEP9_VERIFICATION.md).
- [Admin Dashboard và các route quản trị](docs/ADMIN_DASHBOARD.md).
- [Thêm/sửa công thức và quy tắc xóa](docs/ADMIN_RECIPES.md).
- [Bảo mật và chuẩn bị tài khoản Admin](docs/ADMIN_SECURITY.md).
- [Kết quả kiểm thử và danh sách file Bước10](docs/STEP10_VERIFICATION.md).
- [Báo cáo kiểm thử tổng thể Bước 11](docs/STEP11_TEST_REPORT.md).
- [Hướng dẫn cài đặt máy mới](docs/INSTALLATION.md).
- [Tổng quan dự án](docs/PROJECT_OVERVIEW.md).
- [Yêu cầu chức năng và phi chức năng](docs/REQUIREMENTS.md).
- [Kiến trúc hệ thống](docs/SYSTEM_ARCHITECTURE.md).
- [Use case](docs/USE_CASE.md).
- [Tài liệu API bàn giao](docs/API_DOCUMENTATION.md).
- [Tổng kết kiểm thử](docs/TEST_SUMMARY.md).
- [Kịch bản demo](docs/DEMO_SCRIPT.md).
- [GitHub workflow](docs/GITHUB_WORKFLOW.md).
- [Báo cáo hoàn thành dự án](docs/FINAL_PROJECT_REPORT.md).

## Chạy thử đăng nhập — Bước 8

1. Khởi động SQL Server, chạy Backend và Frontend theo hai terminal ở trên. Mở `http://127.0.0.1:5173/register` (giữ cùng hostname khi thử).
2. Điền họ tên/email và mật khẩu từ 12 ký tự, xác nhận trùng; đăng ký thành công chuyển `/login`. Tài khoản mới luôn là User.
3. Đăng nhập → `/profile`, sửa họ tên/số điện thoại, tải lại để kiểm tra khôi phục phiên bằng `/api/auth/me`.
4. Mở `/admin` với User sẽ bị chặn. Chọn **Về trang chủ**, dùng Navbar để đăng xuất, mở lại `/profile` phải về đăng nhập; nguyên liệu và Cooking Mode trong tab được giữ.

Phiên hết sau 15 phút, không gia hạn ngầm. Khởi động lại Backend/nodemon cũng kết thúc mọi phiên do danh sách phiên nằm trong bộ nhớ. Không tạo Admin mặc định; chỉ người vận hành được phép cấp quyền theo tài liệu [AUTHORIZATION.md](docs/AUTHORIZATION.md). Không có tài khoản thử hoặc Admin được để lại từ kiểm thử tự động.

## Chạy thử cá nhân hóa — Bước 9

1. Đăng nhập ở `http://127.0.0.1:5173`. Nhấn trái tim trên món, mở **Món yêu thích**, tải lại để kiểm tra lưu SQL; bỏ lưu tại đây có xác nhận. Khách nhấn trái tim được chuyển login, không tự ghi yêu thích.
2. Mở một công thức, kéo đến **Đánh giá món ăn**. Chọn 1–5 sao, nhập bình luận tùy chọn; gửi rồi thử sửa/xóa đánh giá của mình. Khách xem được đánh giá và điểm trung bình, không có form ghi.
3. Để kiểm tra Pantry tương thích, mở trực tiếp **`/legacy-pantry`**, tìm nguyên liệu thật trong danh mục, thêm lượng/đơn vị và hạn dùng nếu biết. Thử chỉnh sửa, tải lại và xóa có xác nhận. Không cần nhập ngày giả khi chưa biết hạn.
4. Chọn khẩu phần tại tủ, nhấn **Nấu ăn từ tủ nguyên liệu**. Hàng hết hạn bị loại, hàng chưa ghi hạn được chọn với nhắc kiểm tra chất lượng. Kết quả gợi ý giữ khẩu phần; `ready` chỉ đủ loại bắt buộc, chưa xác nhận đủ lượng.

Bước 9 trước đây không cần migration cho Pantry. Phần Meal Planner mới dùng migration 001 bổ sung; không đổi ràng buộc hoặc dữ liệu Pantry cũ. Các test ghi dữ liệu dùng transaction rollback; dữ liệu món ăn và Ingredients dùng chung được bảo toàn. Chạy kiểm tra tại từng thư mục bằng `npm test` và `npm run test:integration`; Frontend thêm `npm run lint` và `npm run build`. Integration Frontend cần Backend chạy và dependencies của cả hai ứng dụng; các bài SQL chạy tuần tự. Số liệu Bước 9/Bước 10 ở dưới là lịch sử; kết quả thay đổi mới nằm ở báo cáo Meal Planner.

## Chạy thử Lịch nấu ăn và Danh sách đi chợ

1. Khởi động SQL Server, Backend và Frontend như trên; đăng nhập rồi mở `http://127.0.0.1:5173/meal-planner`. Chỉ được xem/sửa lịch của tài khoản hiện tại.
2. Chọn Tuần trước/Tuần này/Tuần sau. Lịch luôn từ thứ Hai đến Chủ nhật; Hôm nay dùng ngày Việt Nam. Tải lại giữ tuần trong query `weekStart` và đọc lại dữ liệu SQL.
3. Chọn Thêm món ở một bữa, tìm/lọc công thức thật hoặc chọn Món yêu thích, nhập khẩu phần1–20 rồi Thêm vào lịch. Mỗi bữa có nhiều món; cùng recipe chỉ có một lần trong cùng bữa/ngày.
4. Sửa ngày, bữa hoặc khẩu phần; chuyển ngày sang tuần khác sẽ chuyển mục sang lịch đích cùng tài khoản. Xóa cần xác nhận và chỉ xóa MealPlanItem.
5. Shopping List tổng hợp nguyên liệu bắt buộc bằng `Quantity × PlannedServings / Recipes.Servings`, gộp cùng IngredientID + đúng Unit, không đổi đơn vị hoặc trừ Pantry. `totalQuantity` là chuỗi decimal, chỉ làm tròn lên một lần ở tổng cuối tới tối đa 6 chữ số thập phân; optional không nằm trong tổng.
6. Đánh dấu Đã mua chỉ lưu tạm; đổi tuần, cập nhật lịch, reload hoặc đổi phiên sẽ đặt lại. Nút Sao chép báo thành công sau Clipboard API; nếu không có quyền, dùng ô nội dung được chọn để sao chép thủ công.
7. Từ card mở Xem công thức hoặc Bắt đầu nấu, giữ khẩu phần đã chọn. RecipeDetail có nút thêm vào lịch; Favorites/Reviews và tiến độ Cooking Mode không bị xóa.

Các endpoint mới nằm trong [API.md](docs/API.md). Admin không được xóa recipe có MealPlanItems, Favorites hoặc Reviews tham chiếu; các FK mới vẫn NO ACTION. Không có tài khoản Admin hoặc lịch mẫu tự động. Kết quả kiểm thử thực tế và những phần browser chưa xác minh tại [MEAL_PLANNER_VERIFICATION.md](docs/MEAL_PLANNER_VERIFICATION.md).

## Chạy thử quản trị — Bước10

1. Chạy `npm run dev` trong hai terminal tại `server` và `client`; SQL Server phải đang chạy. Mở `http://127.0.0.1:5173/admin`.
2. Guest đến Login; User thông thường thấy403. **Không có Admin mặc định.** Khi người quản lý đã cho phép một tài khoản cụ thể, người vận hành dùng CLI tương tác hiện có tại `server`: `npm run admin:promote -- email-da-duoc-phe-duyet`. CLI yêu cầu xác nhận đúng email, không tạo tài khoản mới. Trong đợt lập trình này CLI không được chạy và không tài khoản nào được nâng quyền.
3. Đăng nhập tài khoản được phép, mở lại `/admin`. Dashboard đọc6 số đếm và3 danh sách từ SQL. Sidebar mở món ăn, danh mục, nguyên liệu, người dùng và đánh giá.
4. Vào **Quản lý món ăn → Thêm món ăn**: nhập thông tin, chọn danh mục/nguyên liệu thật, định lượng, đánh dấu ít nhất một nguyên liệu bắt buộc, thêm các bước. Bấm **Lưu công thức**; thành công trở về danh sách. Nút sửa mở `/admin/recipes/:id/edit` với ID thật (không dùng `/admin/recipes//edit`). Hủy không ghi database.
5. Mọi xóa có xác nhận. Món có Favorites/Reviews, danh mục có món, nguyên liệu thuộc công thức/tủ cá nhân bị chặn409. Users chỉ xem/tìm kiếm; không có nút đổi quyền hoặc xóa tài khoản. Admin có thể xóa review vi phạm qua khu vực đánh giá.
6. Đăng xuất trong sidebar thu hồi phiên; khi lỗi mạng, giao diện giữ tài khoản và hiện lỗi để thử lại, kể cả drawer mobile.

Kiểm thử tự động ngày23/10: Frontend **186 unit/DOM + 13 integration**, Backend **150 unit/HTTP + 189 integration**; tổng **538 đạt, 0 thất bại, 0 bỏ qua**. SQL Server vẫn20 món, hash/số dòng10 bảng giữ nguyên; không migration hoặc dữ liệu thử tồn đọng. Test Admin dùng DTO fixture, không cấp quyền trong SQL. Chưa kiểm tra browser trực quan/HTTPS hoặc Admin SQL thật, chưa kiểm thử tải nhiều Admin đồng thời. Hướng dẫn và phạm vi chính xác tại [báo cáo Bước10](docs/STEP10_VERIFICATION.md).
