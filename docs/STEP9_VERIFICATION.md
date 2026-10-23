# Kiểm chứng Bước 9 — Favorites, Reviews và My Pantry

Ngày kiểm chứng cuối: **22/10/2026**, workspace `C:\Users\MyPC\Desktop\SmartCook`.

**Bước 9 đã hoàn thành trong phạm vi lập trình và kiểm thử tự động được yêu cầu.** Không chuyển Bước 10, không Admin Dashboard hoặc tạo/nâng quyền Admin. Chưa báo Passed kiểm thử trực quan/browser thật.

## Trạng thái trước lần tiếp tục cuối

Đã đọc attachment yêu cầu, README, PLAN, API, tài liệu auth, schema và các nguồn/test Favorites/Reviews/Pantry. Favorites Backend/Frontend, Reviews Backend/Frontend cùng test đã được lưu đầy đủ, kể cả ReviewList/Form/Card/StarRating/service và phần tích hợp RecipeDetail. Live React/SQL test đã bao phủ Favorites và Reviews. Giữ các phần này, không tạo lại React/Express hoặc viết lại chức năng.

Pantry đã có repository/service/controller/router/validator, nhưng chưa mount trong app, chưa có unit/SQL test riêng. Frontend MyPantry/service/form/utility/test, route và cầu nối sang Suggestions còn thiếu. README/PLAN/API vẫn phản ánh Bước 8, hai tài liệu FAVORITES/REVIEWS đã có; MY_PANTRY/STEP9_VERIFICATION chưa có.

Git vẫn toàn bộ untracked và chưa có commit: `git diff --stat`/`--name-only` trống không có nghĩa source không đổi. Đã dùng snapshot SHA-256 để đối chiếu tệp/dữ liệu, không reset hoặc khởi tạo lại Git, không stage/commit/push. `.env`, node_modules, dist, cache và log đều bị ignore.

## Phần vừa hoàn thiện

- Nối Pantry router với cùng security instance của auth/Favorites/Reviews, thêm cache no-store và dùng middleware hiện có. Bổ sung unit/service/HTTP và SQL tests; Pantry source đã lưu trước đó không cần viết lại.
- Tạo MyPantry, PantryForm, service tải đủ trang và utility ngày/validation. CRUD SQL thật, xác nhận xóa, thông báo API, trạng thái rỗng/lỗi/loading và bảo vệ state/draft theo tài khoản/phiên.
- Route `/pantry` nằm trong ProtectedRoute và PantryProvider lựa chọn có sẵn. Thêm Navbar, `replaceSelection(ids)` kiểm tra danh mục/giới hạn, giữ khẩu phần; không đổi thuật toán Backend.
- Loại hàng hết hạn theo ngày Việt Nam; cùng ngày và 3 ngày tới là sắp hết hạn; không ghi hạn vẫn được chọn với lời nhắc kiểm tra chất lượng. CTA tính lại ngày ngay lúc nhấn, không dùng ngày cũ khi vừa qua nửa đêm.
- Bổ sung regression cho GET own-review401; cập nhật test fixture auth cũ để xếp hàng truy vấn trong transaction ODBC một kết nối khi các phần UI gọi API đồng thời. Production vẫn dùng pool và truy vấn đồng thời bình thường.
- Hoàn thiện README, PLAN, API, MY_PANTRY và báo cáo này; rà soát FAVORITES/REVIEWS, cập nhật phạm vi interceptor/phân quyền trong tài liệu auth.

## API của toàn Bước 9

| Nhóm | Endpoint |
| --- | --- |
| Favorites | GET/POST `/api/favorites`; GET `/api/favorites/ids`; DELETE `/api/favorites/:recipeId` |
| Reviews | GET/POST `/api/recipes/:id/reviews`; GET `/api/recipes/:id/reviews/mine`; PATCH/DELETE `/api/reviews/:reviewId` |
| Pantry | GET/POST `/api/pantry`; PATCH/DELETE `/api/pantry/:id` |

Chỉ GET danh sách reviews là công khai. API còn lại lấy UserID từ phiên, không tin body/query. Mutation có JSON, Origin và CSRF; DELETE gửi `{}`. Cross-owner review/pantry trả404; xóa Favorites chỉ tác động liên kết của chính mình. Không có quyền Admin vượt ownership ở Bước 9.

Tài liệu: [API.md](API.md), [FAVORITES.md](FAVORITES.md), [REVIEWS.md](REVIEWS.md), [MY_PANTRY.md](MY_PANTRY.md).

## Kết quả thực tế

| Vị trí | Lệnh | Kết quả cuối |
| --- | --- | --- |
| client | `npm run lint` | Đạt, không cảnh báo |
| client | `npm run build` | Đạt, Vite production bundle |
| client | `npm test` | **158/158** unit/DOM đạt |
| client | `npm run test:integration` | **12/12** đạt, HTTP/SQL thật |
| server | `npm test` | **127/127** unit/HTTP đạt |
| server | `npm run test:integration` | **160/160** đạt |
| server | `npm run check:db` | SmartCookDB, 20 món, Shared memory, encrypted TRUE |

Tổng **457/457**, không fail/skip ở lần cuối: 357 test Bước 8 giữ lại và 100 test thêm trong Bước 9. Backend mới gồm Favorites11 unit+5 SQL, Reviews12 unit+5 SQL, Pantry16 unit+6 SQL. Frontend mới gồm Favorites12, Reviews11, Pantry21 unit/DOM, cùng một luồng integration tổng hợp Favorites→Reviews→Pantry→Suggestions. Các subtest được Node đếm trong tổng cũ như trước.

Một lần integration auth cũ thất bại vì concurrent request trên một transaction ODBC, đã sửa fixture và chạy lại toàn bộ Frontend integration đạt12/12. Một test SQL injection-like unit lúc viết có chuỗi dài hơn30 ký tự nên đúng ra bị400; đã sửa dữ liệu test thành chuỗi hợp lệ theo giới hạn rồi kiểm tra bind SQL thành công. Không che/bỏ qua test thất bại hoặc thay auth thật bằng fixture production.

Môi trường: Node26.6.0/npm11.18.0, React19.3.1, Vite8.3.4, Tailwind4.3.3, Express5.3.0, mssql12.7.9/msnodesqlv8 5.6.0, SQL Server2019. Không cài/thay dependency mới trong Bước 9.

## Bao phủ nghiệp vụ và bảo mật

| Tình huống | Bằng chứng |
| --- | --- |
| Favorites thêm/list/IDs/xóa/duplicate | Unit, HTTP, SQL và React thật; trạng thái giữa card/detail/page và reload khớp SQL |
| Favorites quyền sở hữu | Hai User riêng, A không xóa liên kết B; UID body/query bị từ chối; Recipes còn nguyên |
| Reviews công khai, điểm trung bình | SQL hai lượt5+2 sao cho3.5 toàn tập dù page size1; sửa/xóa cập nhật summary |
| Reviews ownership/một dòng | Duplicate409, sửa/xóa review người khác404, `/mine` tìm riêng không phụ thuộc page |
| Reviews XSS/privacy | Nội dung giống script/HTML được lưu text và React không tạo img/script node, không thực thi; không lộ email/phone/hash |
| Pantry CRUD | Đọc lại SQL sau thêm/sửa, reload React giữ dữ liệu, xác nhận xóa mới gửi DELETE |
| Pantry ownership/duplicate | Hai User cùng IngredientID độc lập; A không sửa/xóa B, body UID/IngredientID khi PATCH bị400 |
| Quantity/Unit | Âm/0/chuỗi/quá lớn/quá2 số thập phân bị400; null hợp lệ; sửa đơn vị không đổi lượng; merged state và SQL CHECK race được kiểm tra |
| ExpiryDate | Ngày không tồn tại/0000/năm nhuận; SQL trả nguyên chuỗi cả0001-01-01; past cho phép; UI Việt Nam gồm same-day/3days/noexpiry và mốc nửa đêm |
| Pantry→Suggestions | SQL thật: trứng+dầu+cà chua và hàng hết hạn; CTA gửi đúng3 ID dùng được, giữ4 người, nhận13 món; hiện rõ chỉ đủ loại, không đủ lượng |
| CSRF/Origin/JSON/JWT | HTTP/SQL từ chối guest, thiếu/sai token/Origin, token hết hạn và cookie đã logout; không tự đổi kiến trúc auth |
| SQL injection | ID/field sai bị chặn, comment/unit chứa chuỗi SQL là dữ liệu tham số, các bảng gốc giữ nguyên |
| Lỗi/pending/cross-session | Không gửi lặp khi pending, API lỗi không báo thành công, GET trang sau lỗi không dùng dữ liệu thiếu; đổi phiên hủy GET/CSRF/mutation/draft cũ |
| Hồi quy | Đăng ký/login/profile/logout, recipe APIs, thuật toán gợi ý, servings, checklist và Cooking Mode cũ đều đạt |

Unit/DOM dùng fixture có kiểm soát trong test. Runtime sử dụng API/mssql thực tế. `personal.integration.test.js` mount App và Axios thật, cookie jar HTTP cùng transaction SQL; không thay Backend bằng dữ liệu giả. SQL test chạy tuần tự, transaction dùng hàng đợi query riêng để tương thích một ODBC connection; mọi truy vấn vẫn thực thi thật.

## Schema và dữ liệu

Đã kiểm tra SQL Server có UNIQUE bật, không filter trên Favorites(UserID,RecipeID), Reviews(UserID,RecipeID) và UserIngredients(UserID,IngredientID); không có nhóm trùng. **Không cần/tạo/chạy migration.** Không thay schema.sql/seed.sql/verify.sql, thuật toán matcher/service, JWT config, password helper, session-store hoặc `.env` theo hash.

Cả 10 bảng có hash JSON theo khóa và số dòng giống hệt trước/sau lần tiếp tục cuối và so với đầu Bước 9:

| Bảng | Dòng cuối |
| --- | --- |
| Users | 0 |
| Categories / Ingredients / Recipes | 8 / 64 / 20 |
| RecipeIngredients / CookingSteps | 148 / 80 |
| Favorites / Reviews / UserIngredients / SearchHistory | 0 / 0 / 0 / 0 |

Tài khoản/email thử ngẫu nhiên và dữ liệu riêng được rollback, có kiểm tra không còn tài khoản. Không xóa dữ liệu thật để cleanup. IDENTITY có thể có khoảng trống do INSERT rollback, không reset để lấp. Không tạo/nâng Admin, không ghi secrets vào Git/tài liệu. Snapshot/log tạm chỉ ở `.cache/` bị Git bỏ qua.

## Tệp tạo/sửa ở lần tiếp tục cuối

Tạo mới:

```text
client/src/components/PantryForm.jsx
client/src/pages/MyPantry.jsx
client/src/services/pantryService.js
client/src/utilities/myPantry.js
client/tests/myPantry.test.js
server/tests/pantry.unit.test.js
server/tests/pantry.integration.test.js
docs/MY_PANTRY.md
docs/STEP9_VERIFICATION.md
```

Sửa/nối:

```text
client/src/App.jsx
client/src/components/Navbar.jsx
client/src/context/PantryProvider.jsx
client/tests/integration/auth.integration.test.js
client/tests/integration/personal.integration.test.js
client/tests/reviews.test.js
server/src/app.js
server/package.json
README.md
PLAN.md
docs/API.md
docs/AUTHENTICATION.md
docs/AUTHORIZATION.md
```

Những tệp Favorites/Reviews, backend Pantry và fixture đã có trước lần tiếp tục được giữ lại. Chúng thuộc toàn Bước 9, các nhóm gồm components/services/context Favorite, components/service Review, server controllers/routes/services/validators của3 chức năng và test Favorites/Reviews/SQL fixture. Không xóa hoặc khởi tạo lại tệp cũ. Git vẫn untracked như trước; không commit/push.

## Chạy bằng trình duyệt và phần chưa kiểm chứng

Backend5000/Frontend5173 đã khởi động bằng npm run dev. Smoke đạt health200, health/db200, guest favorites/pantry401, GET reviews200, React entry200 và Vite proxy pantry401. Nếu đã dừng, mở hai terminal tại server và client, chạy `npm run dev` mỗi nơi; giữ `.env` hiện có.

1. Mở `http://127.0.0.1:5173`, tự đăng ký/login. Lưu món qua trái tim, kiểm tra `/favorites` và detail, reload, xác nhận bỏ lưu.
2. Mở món, đánh giá1–5 sao và comment tùy chọn. Thử sửa/xóa của mình, đăng xuất để kiểm tra đọc công khai và login CTA.
3. Vào `/pantry`, tìm nguyên liệu thật, thêm lượng/đơn vị/ngày nếu biết; thử ngày quá khứ, chưa nhập hạn và ngày sắp tới. Sửa rồi reload, kiểm tra xóa có xác nhận.
4. Chọn khẩu phần4, thêm Trứng gà/Dầu ăn/Cà chua chưa hết hạn rồi nhấn nấu từ tủ. Kiểm tra `/suggestions` giữ4 người, nguyên liệu hết hạn bị loại, không khẳng định đủ lượng; thử Cooking Mode cũ.
5. Dùng hai tài khoản User riêng hoặc hai browser profile để kiểm tra dữ liệu riêng; không cấp Admin. Sau15 phút hoặc restart Backend, API cá nhân phải yêu cầu login lại.
6. Khi có browser, kiểm tra thực tế tại375/768/1024/1440px: menu, layout, trường dài, focus bàn phím, radio sao, xác nhận và fallback/loading/error. Đây là checklist **chưa Passed**.

Công cụ computer-use trả `apps:[]`, `browsers:[]`; vì không có browser kết nối, chưa xác minh trực quan hoặc chính sách HttpOnly/Secure/SameSite qua browser/HTTPS thật. jsdom không thay thế kiểm tra này.

Giới hạn giữ nguyên: phiên trong bộ nhớ một process/restart kết thúc phiên; không refresh/remember me. Chưa realtime đa tab; Favorites đọc lại khi phát hiện409/404 và state chung đồng bộ trong phiên ứng dụng. Pantry tối đa10.000 dòng tải client và100 loại/lượt gợi ý; không đổi đơn vị, kiểm đủ lượng, trừ kho, timer dinh dưỡng hoặc chức năng Admin. Không còn lỗi chức năng đã biết trong những luồng đã kiểm tra; các phần ngoài phạm vi chờ yêu cầu tiếp theo.
