# API documentation SmartCook

Base URL local: http://127.0.0.1:5000/api. API trả JSON và dùng camelCase. Đây là tài liệu tham chiếu gọn; hợp đồng chi tiết hiện hành ở [API.md](API.md). Thay đổi Meal Planner sau bàn giao Bước 12 được bổ sung bên dưới, với kết quả riêng tại [MEAL_PLANNER_VERIFICATION.md](MEAL_PLANNER_VERIFICATION.md).

## Quy ước

- Public endpoint không yêu cầu session, trừ review private.
- Endpoint User yêu cầu JWT HttpOnly Cookie còn hiệu lực. Endpoint Admin yêu cầu thêm role Admin lấy từ SQL Server.
- POST/PATCH/DELETE có xác thực yêu cầu Content-Type application/json, Origin thuộc CLIENT_ORIGIN và X-CSRF-Token lấy từ GET /auth/csrf. DELETE gửi body JSON rỗng.
- List thường dùng page/limit; page mặc định 1, limit mặc định 20, tối đa 100, trừ Suggestions tối đa 50 và mặc định 12.
- Lỗi validation/ID: 400; thiếu/hết hạn session: 401; Origin/CSRF sai hoặc User vào Admin: 403; không có resource/không sở hữu: 404; trùng/tham chiếu: 409; rate limit: 429; SQL/config/service: 5xx.

## Public API

| Method | Endpoint | Query/body chính | Response thành công |
| --- | --- | --- | --- |
| GET | /health | – | 200 trạng thái service, timestamp |
| GET | /health/db | – | 200 trạng thái SmartCook Database, timestamp |
| GET | /categories | – | 200 {data:[category]} |
| GET | /ingredients | search, ingredientCategory, page, limit | 200 {data,pagination} |
| GET | /recipes | search, categoryId, maxTime, difficulty, sort, page, limit | 200 {data,pagination} |
| GET | /recipes/:id | recipe ID | 200 {data:recipe} |
| POST | /recipes/suggest | ingredientIds, servings?, page?, limit? | 200 {data,pagination} |
| GET | /recipes/:id/reviews | page, limit | 200 {data,pagination,summary} |

sort của recipes chỉ nhận newest, name_asc, name_desc, time_asc hoặc time_desc. difficulty chỉ nhận Dễ, Trung bình hoặc Khó.

Ví dụ request gợi ý:

~~~json
{
  "ingredientIds": [1, 2, 3],
  "servings": 4,
  "page": 1,
  "limit": 12
}
~~~

Ví dụ response gợi ý rút gọn:

~~~json
{
  "data": [{
    "recipeId": 8,
    "recipeName": "Tên món",
    "servings": 2,
    "requestedServings": 4,
    "matchPercentage": 67,
    "status": "missing",
    "matchedIngredients": [],
    "missingIngredients": [],
    "optionalIngredients": []
  }],
  "pagination": {"page": 1, "limit": 12, "total": 1, "totalPages": 1}
}
~~~

Ingredient của suggestion chứa quantity gốc và adjustedQuantity theo requestedServings. Score chỉ tính IngredientID bắt buộc; không là bằng chứng Pantry đủ số lượng.

## Authentication và profile

| Method | Endpoint | Quyền | Body / kết quả |
| --- | --- | --- | --- |
| GET | /auth/csrf | Public, Origin hợp lệ nếu có | 200 {csrfToken}, set nonce HttpOnly cookie |
| POST | /auth/register | Public + CSRF | fullName, email, password; 201 {data:user}, luôn Role User |
| POST | /auth/login | Public + CSRF | email, password; 200 {data:user}, set session cookie |
| POST | /auth/logout | Session/anonymous + CSRF | {}; 200 {message}, thu hồi/xóa cookie |
| GET | /auth/me | Session | 200 {data:user} |
| PATCH | /auth/profile | Session + CSRF | fullName và/hoặc phone; 200 {data:user} |

User DTO chỉ gồm userId, fullName, email, phone nullable, avatar nullable, role và createdAt. PasswordHash, plaintext password, JWT và pepper không bao giờ có trong response.

Ví dụ đăng ký:

~~~json
{
  "fullName": "Nguyễn Văn A",
  "email": "nguoidung@example.com",
  "password": "mat-khau-dai-it-nhat-12-ky-tu"
}
~~~

Password phải 12–1024 Unicode code point, tối đa 4096 byte và không chứa NUL. Không trim/normalize password. Xem [AUTHENTICATION.md](AUTHENTICATION.md).

## API cá nhân

| Method | Endpoint | Body/query | Kết quả |
| --- | --- | --- | --- |
| GET | /favorites | page, limit | Favorite recipes của session |
| GET | /favorites/ids | – | {data:[recipeId]} |
| POST | /favorites | {recipeId} | 201 favorite |
| DELETE | /favorites/:recipeId | {} | 200 message |
| GET | /recipes/:id/reviews/mine | – | review của session hoặc null |
| POST | /recipes/:id/reviews | {rating,comment?} | 201 review |
| PATCH | /reviews/:reviewId | rating và/hoặc comment | 200 review của chính mình |
| DELETE | /reviews/:reviewId | {} | 200 message |
| GET | /pantry | page, limit | pantry của session |
| POST | /pantry | ingredientId, quantity?, unit?, expiryDate? | 201 pantry item |
| PATCH | /pantry/:id | quantity, unit và/hoặc expiryDate | 200 pantry item |
| DELETE | /pantry/:id | {} | 200 message |
| GET | /meal-plans | weekStart: thứ Hai dạng YYYY-MM-DD | 200 lịch riêng gồm 7 ngày/3 bữa và summary |
| GET | /meal-plans/shopping-list | weekStart | 200 tổng nguyên liệu bắt buộc của tuần |
| POST | /meal-plans/items | recipeId, mealDate, mealType, servings, sortOrder? | 201 item |
| PATCH | /meal-plans/items/:id | ít nhất một trong mealDate, mealType, servings, sortOrder | 200 item; có thể chuyển tuần |
| DELETE | /meal-plans/items/:id | {} | 200 message |

Review rating là số nguyên 1–5, comment tối đa 2.000 ký tự sau chuẩn hóa. Pantry quantity là null hoặc số dương tối đa hai chữ số thập phân; unit bắt buộc nếu có quantity; expiryDate là null hoặc YYYY-MM-DD. Ownership luôn lấy từ session, không nhận UserID trong request.

Meal Planner dùng cùng JWT/CSRF/Origin và chỉ cho phép chủ lịch, kể cả khi người gọi có role Admin. `mealType` đúng `Breakfast`, `Lunch` hoặc `Dinner`; servings là số nguyên 1–20. GET không tạo bản ghi lịch. Shopping List gộp IngredientID + đúng Unit, cộng chính xác `Quantity × PlannedServings / Recipes.Servings`, rồi làm tròn lên một lần ở tổng cuối tối đa 6 chữ số thập phân; `totalQuantity` là chuỗi. Không quy đổi đơn vị hoặc trừ Pantry. Chi tiết DTO/lỗi và miền ngày tại mục Meal Planner trong [API.md](API.md).

API `/pantry` và UserIngredients được giữ nguyên; chỉ route giao diện `/pantry` chuyển tới `/meal-planner`. Giao diện Pantry cũ còn ở `/legacy-pantry`. Admin không được xóa recipe đang có MealPlanItems tham chiếu (409).

Ví dụ Pantry:

~~~json
{
  "ingredientId": 64,
  "quantity": 6,
  "unit": "quả",
  "expiryDate": null
}
~~~

## Admin API

Mọi endpoint dưới đây yêu cầu session Admin. Mutation cần CSRF/Origin như phần quy ước. Không có endpoint đổi role hoặc xóa tài khoản User.

| Method | Endpoint | Body/query chính | Kết quả |
| --- | --- | --- | --- |
| GET | /admin/check | – | Xác nhận quyền |
| GET | /admin/dashboard | – | totals, mostFavorited, mostReviewed, newestRecipes |
| GET | /admin/recipes | search, categoryId, sort, page, limit | list recipe |
| GET | /admin/recipes/:id | – | recipe aggregate |
| POST | /admin/recipes | recipe aggregate | 201 recipe |
| PATCH | /admin/recipes/:id | một phần/full aggregate | 200 recipe |
| DELETE | /admin/recipes/:id | {} | 200; 409 nếu còn Favorites/Reviews/MealPlanItems |
| GET/POST | /admin/categories | list query / category payload | list hoặc 201 category |
| PATCH/DELETE | /admin/categories/:id | update payload / {} | 200; delete 409 nếu đang có recipe |
| GET/POST | /admin/ingredients | list query / ingredient payload | list hoặc 201 ingredient |
| PATCH/DELETE | /admin/ingredients/:id | update payload / {} | 200; delete 409 nếu đang tham chiếu |
| GET | /admin/users | search, role, page, limit | list User DTO, chỉ đọc |
| GET | /admin/users/:id | – | User DTO |
| GET | /admin/reviews | search, recipeId, rating, page, limit | list review |
| DELETE | /admin/reviews/:id | {} | 200 message |

Recipe create/update nhận metadata, ingredients và steps. Ingredients có 1–200 dòng, IngredientID không lặp, quantity dương, ít nhất một isRequired=true. Steps có 1–100 dòng, stepNumber liên tiếp từ 1. Service dùng transaction để recipe, ingredient rows và cooking steps cùng commit hoặc rollback.

Ví dụ create recipe tối thiểu:

~~~json
{
  "recipeName": "Món demo",
  "categoryId": 1,
  "prepTime": 10,
  "cookTime": 15,
  "servings": 2,
  "difficulty": "Dễ",
  "ingredients": [
    {"ingredientId": 1, "quantity": 100, "unit": "g", "isRequired": true}
  ],
  "steps": [
    {"stepNumber": 1, "instruction": "Chuẩn bị và chế biến theo hướng dẫn."}
  ]
}
~~~

## Error response

Error handler trả thông điệp tiếng Việt an toàn. Hình thức điển hình:

~~~json
{"message": "Nội dung yêu cầu không hợp lệ."}
~~~

Không dựa vào nội dung thông điệp để lập trình nhánh bảo mật; sử dụng HTTP status. Không log hoặc gửi cookie/CSRF/JWT/password trong ví dụ, issue hay báo cáo.
d