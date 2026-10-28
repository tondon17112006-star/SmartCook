# Kiến trúc hệ thống SmartCook

## Tổng quan

SmartCook là web application ba lớp: React/Vite ở browser, Express API ở Node.js và Microsoft SQL Server cho dữ liệu bền vững. Frontend không truy cập database trực tiếp.

~~~mermaid
flowchart TB
  subgraph Client["Browser"]
    R[React pages/components]
    C[Context + hooks]
    AX[Axios withCredentials]
    R --> C --> AX
  end
  subgraph Server["Node.js / Express"]
    RT[Routes]
    MW[CORS, auth, role, error middleware]
    CT[Controllers]
    SV[Services / repositories]
    RT --> MW --> CT --> SV
  end
  DB[(Microsoft SQL Server: SmartCookDB)]
  AX -->|HTTP /api| RT
  SV -->|parameterized mssql queries| DB
~~~

## Frontend

- BrowserRouter định nghĩa public, protected và Admin route.
- AuthProvider quản lý bootstrap session; FavoriteProvider và PantryProvider quản lý state theo phiên.
- Pages sử dụng reusable component, service Axios và hooks có AbortController/cleanup khi phù hợp.
- Admin pages dùng lazy import để không đưa toàn bộ khu vực quản trị vào initial bundle.
- sessionStorage chỉ lưu trạng thái chọn nguyên liệu/Pantry và Cooking Mode; JWT, password và CSRF token không được lưu trong Web Storage.
- Meal Planner đọc/ghi lịch từ SQL qua API; request và dialog gắn với UserID + sessionGeneration, hủy khi đổi phiên. Checkbox đã mua là state trong bộ nhớ, không phải dữ liệu lịch hoặc kho hàng lưu bền vững.

## Backend

### Luồng HTTP

1. Browser gọi endpoint dưới /api.
2. Express thêm header bảo vệ, kiểm tra CORS và parse JSON tối đa 100 KB.
3. Route công khai đi tới controller/service. Route cá nhân/Admin khởi tạo security layer khi có cấu hình auth.
4. Middleware xác thực kiểm tra JWT cookie, session registry và lấy User/Role hiện tại từ SQL.
5. Controller gọi service/repository. Giá trị người dùng được validate và bind qua mssql parameter.
6. Error handler trả JSON an toàn, không đưa stack trace hoặc SQL query ra client.

### Authentication và authorization

~~~mermaid
sequenceDiagram
  participant B as Browser
  participant A as Express
  participant D as SQL Server
  B->>A: GET /api/auth/csrf
  A-->>B: token JSON + HttpOnly nonce cookie
  B->>A: POST /api/auth/login + Origin + CSRF
  A->>D: kiểm tra password hash
  A-->>B: DTO user + HttpOnly JWT session cookie
  B->>A: request protected
  A->>A: verify JWT, registry và expiry
  A->>D: đọc User/Role hiện thời
  A-->>B: dữ liệu hoặc 401/403
~~~

- Password được chuẩn bị bằng HMAC-SHA384 pepper rồi bcrypt cost 12.
- JWT HS256 có TTL cố định 15 phút; session/CSRF/rate-limit store đang ở memory của một process.
- Mutation auth/cá nhân/Admin yêu cầu JSON, Origin allowlist và X-CSRF-Token.
- Admin API yêu cầu role Admin lấy từ SQL ở mỗi request; client guard chỉ cải thiện điều hướng, không là biện pháp phân quyền duy nhất.
- Chi tiết chính sách ở [AUTHENTICATION.md](AUTHENTICATION.md) và [AUTHORIZATION.md](AUTHORIZATION.md).

## Database

SmartCookDB có 12 bảng: Users, Categories, Ingredients, Recipes, RecipeIngredients, CookingSteps, Favorites, Reviews, UserIngredients, SearchHistory, MealPlans và MealPlanItems. Hai bảng cuối từ migration 001 đã áp dụng ngày 27/10/2026; các bảng nền/seed giữ nguyên. FK dùng NO ACTION; aggregate Admin và mutation Meal Planner dùng transaction để tránh ghi dở. Xem [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

## Meal Planner và Shopping List

API lịch dùng UserID trong phiên, kể cả với Admin. Repository khóa chủ sở hữu trước khi tìm/tạo tuần và ghi item trong transaction SERIALIZABLE; chuyển tuần giữ cùng chủ lịch. UNIQUE ngăn tạo hai lịch cùng User/tuần và ngăn lặp recipe trong cùng ngày/bữa. Deadlock 1205 được retry toàn transaction tối đa hai lần sau rollback. GET chỉ đọc, không tự tạo lịch rỗng.

Shopping List đọc theo lô các nguyên liệu bắt buộc, giữ SQL DECIMAL dưới dạng text và cộng phân số BigInt theo từng khẩu phần. Chỉ gộp cùng IngredientID + đúng Unit, làm tròn lên một lần ở tổng cuối tới 6 chữ số và trả chuỗi decimal. Không N+1 theo từng món, không đổi đơn vị, không trừ Pantry. Quy tắc/schema chi tiết ở [MEAL_PLANNER.md](MEAL_PLANNER.md), [SHOPPING_LIST.md](SHOPPING_LIST.md) và [MEAL_PLANNER_DATABASE.md](MEAL_PLANNER_DATABASE.md).

## Gợi ý công thức

~~~mermaid
flowchart LR
  S[ingredientIds đã chọn] --> V[Validate + loại trùng]
  V --> E[Kiểm tra IngredientID tồn tại]
  E --> Q[SQL CTE: đếm required/matched]
  Q --> R[Xếp hạng: tỷ lệ, thiếu, thời gian, ID]
  R --> B[Bulk load nguyên liệu cho trang]
  B --> O[matched / missing / optional + adjustedQuantity]
~~~

Chỉ IngredientID bắt buộc góp vào tỷ lệ. Công thức cần có ít nhất một required ingredient đã chọn mới là ứng viên. Thứ tự xếp hạng là percentage giảm dần, số required thiếu tăng dần, tổng thời gian tăng dần, rồi RecipeID. Với requested servings 1–20, quantity được tỉ lệ theo khẩu phần gốc; API không có thông tin stock quantity.

## Pantry

Pantry là dữ liệu riêng theo UserID. Mỗi cặp UserID/IngredientID có tối đa một dòng. Khi chuyển sang Suggestions, client loại nguyên liệu hết hạn dựa theo ngày Việt Nam và chỉ chuyển ID; không quy đổi đơn vị, tự trừ kho hay khẳng định đủ lượng.

Navbar hiện mở Lịch nấu ăn tại `/meal-planner`; `/pantry` được bảo vệ rồi redirect replace. Trang tương thích `/legacy-pantry`, API `/api/pantry` và UserIngredients giữ nguyên, không chuyển hoặc xóa dữ liệu khi đổi điều hướng.

## Vận hành và giới hạn

- Pool mssql được kết nối lazy và dùng chung promise cho kết nối đầu tiên đồng thời.
- Public health không phụ thuộc SQL; health/db kiểm tra database.
- Restart backend hủy session hiện hữu vì registry ở memory. Nhiều instance cần shared session/CSRF/rate-limit store.
- HTTPS, reverse proxy, secret manager, backup/restore, observability và scale production không nằm trong source hiện tại.
d