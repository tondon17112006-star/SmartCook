# Báo cáo Bước 3 — Backend đọc dữ liệu SQL Server

Kiểm tra ngày **16/10/2026**, giờ Việt Nam, tại `C:\Users\MyPC\Desktop\SmartCook`.

## Kết nối đã chọn và phiên bản

| Thành phần | Giá trị thực tế |
| --- | --- |
| Node.js | 26.6.0, Windows x64, N-API 10 |
| Express | 5.3.0 |
| mssql | 12.7.9; import `mssql/msnodesqlv8.js` |
| Native binding | msnodesqlv8 5.6.0, binary Windows x64 có sẵn trong package |
| ODBC đang dùng | SQL Server Native Client 11.0 x64, DLL 11.0.7462.6 |
| SQL Server | 2019, 15.0.2000.5 |
| Database | SmartCookDB |
| Authentication | Windows Authentication, tài khoản đang chạy Node |
| Server / transport | `lpc:localhost` / Shared memory |
| Mã hóa truy vấn thực tế | `encrypt_option = TRUE` |

Đã kiểm tra `msnodesqlv8` yêu cầu Node >=18 và tải native binding thành công trên Node 26.6.0. Không cần biên dịch lại hoặc đổi phiên bản Node. Package và lockfile được cập nhật trong `server`; cache npm nằm trong workspace.

Driver ODBC 17/18 chưa có trên máy. Native Client 11.0 đã được cài sẵn cả x86/x64; Node x64 dùng bản x64. Tài liệu [msnodesqlv8](https://github.com/TimelordUK/node-sqlserver-v8) cho biết Native Client cũ vẫn chạy được các đường truy vấn không BCP; việc đọc bằng pool và truy vấn tham số đã được kiểm chứng trên máy này. Native Client là thành phần cũ, [Microsoft không khuyến nghị cho phát triển mới](https://learn.microsoft.com/en-us/sql/relational-databases/native-client/sql-server-native-client?view=sql-server-ver15); cấu hình dự án vì vậy chỉ dùng nó ở development/test và từ chối nó trong production.

Đã tạo `server/.env` local development khi file chưa tồn tại, không chứa SQL password và được `.gitignore` loại trừ. Kết nối dùng `DB_ENCRYPT=true`; `DB_TRUST_SERVER_CERTIFICATE=true` chỉ để chấp nhận chứng chỉ tự ký trên máy local này. Mẫu `.env.example` giữ `false`. Code từ chối ngoại lệ TLS với máy chủ remote hoặc `NODE_ENV=production`; production bắt buộc mã hóa, kiểm tra chứng chỉ và ODBC 17/18. Không đổi Mixed Mode, SQL login, mật khẩu, driver hệ thống hoặc thiết lập SQL Server.

## Truy vấn độc lập

Đã chạy `npm run check:db`, thực thi `SELECT DB_NAME()` và đếm `dbo.Recipes`, đồng thời đọc transport và trạng thái mã hóa. Kết quả:

```json
{
  "status": "ok",
  "node": "v26.6.0",
  "databaseName": "SmartCookDB",
  "recipeCount": 20,
  "transport": "Shared memory",
  "encrypted": "TRUE"
}
```

Pool được mở khi cần, dùng chung một promise cho các request đầu tiên, giới hạn mặc định 10 connection và đóng khi dừng server/test. `/api/health` không phụ thuộc vào việc database đang kết nối được hay không. Không dùng .NET làm cầu nối cho các API; toàn bộ truy vấn HTTP đi qua `mssql/msnodesqlv8` thực tế.

## API và chạy thử bằng npm run dev

Đã khởi động nodemon trên `127.0.0.1:5000` và gọi các URL sau:

| Request | HTTP | Kết quả thực tế |
| --- | ---: | --- |
| `/api/health` | 200 | Hợp đồng cũ `status`, `service`, `timestamp` giữ nguyên |
| `/api/categories` | 200 | 8 danh mục |
| `/api/ingredients` | 200 | 20 dòng trang đầu, tổng 64 |
| `/api/ingredients?search=trứng` | 200 | 1 nguyên liệu |
| `/api/recipes` | 200 | 20 món, tổng 20 |
| `/api/recipes?categoryId=1` | 200 | 2 món thuộc danh mục có ID 1 |
| `/api/recipes?search=trứng` | 200 | 5 món |
| `/api/recipes/1` | 200 | ID dạng số, 8 nguyên liệu và 4 bước nấu |
| `/api/recipes/999999` | 404 | `Không tìm thấy món ăn.` |
| `/api/health/db` | 200 | Database phản hồi, không lộ cấu hình kết nối |

Chi tiết đầy đủ response và query xem [API.md](API.md). Có **6 endpoint GET**, trong đó danh sách món/nguyên liệu có phân trang. Đây là dữ liệu SQL Server, không phải mảng mock. Tiến trình chạy thử ở cổng 5000 đã được dừng sau kiểm tra.

## Kết quả kiểm thử tự động

| Lệnh | Đạt | Lỗi | Bỏ qua |
| --- | ---: | ---: | ---: |
| `npm test` | 33 | 0 | 0 |
| `npm run test:integration` | 62 | 0 | 0 |
| Tổng | **95** | **0** | **0** |

Unit test không cần SQL Server. Integration test tự mở server cổng ngẫu nhiên, dùng SQL Server thật và so dữ liệu HTTP với các truy vấn SQL trực tiếp; không sửa schema hoặc dữ liệu.

### Các bài unit test

Tất cả trường hợp dưới đây đạt; test nhóm xử lý lỗi có các subtest được tính riêng trong tổng 33:

| Bài kiểm tra | Kết quả |
| --- | --- |
| Mặc định Windows Authentication, TLS an toàn | Đạt |
| Dev local có thể chọn trust chứng chỉ, chuỗi ODBC giữ tùy chọn rõ ràng | Đạt |
| Production từ chối tắt mã hóa hoặc trust chứng chỉ | Đạt |
| Remote từ chối ngoại lệ TLS của local | Đạt |
| Production từ chối Native Client 11 và giao thức local `lpc:` | Đạt |
| Driver whitelist, DB_AUTH và các timeout/pool/port sai bị từ chối | Đạt |
| Giá trị ODBC được escape, lỗi cấu hình không echo secrets | Đạt |
| ID chỉ nhận số nguyên dương trong SQL INT, không nhận ép kiểu hoặc mảng | Đạt |
| Page/limit/offset được giới hạn | Đạt |
| Pagination trang rỗng giữ tổng; không có kết quả trả totalPages=0 | Đạt |
| Search tiếng Việt chuẩn hóa NFC, giới hạn độ dài, không nhận nhiều giá trị | Đạt |
| Escape ký tự LIKE `~`, `%`, `_`, `[` | Đạt |
| HttpError validation 400 và không tìm thấy 404 | Đạt từng mã |
| Lỗi thường và SQL EREQUEST trả 500, không lộ thông tin | Đạt từng loại |
| ELOGIN, ESOCKET, ECONNCLOSED, ENOTOPEN, ENOCONN, EINSTLOOKUP, ConnectionError trả 503 | Đạt từng loại |
| ETIMEOUT trả 504 | Đạt |
| HYT00, HYT01, SQLSTATE trong originalError/precedingErrors trả 504 | Đạt từng loại |
| SQLSTATE 08S01 trả 503; lỗi cú pháp 42000 vẫn 500 | Đạt từng loại |
| JSON body không hợp lệ trả 400, không echo body | Đạt |
| Đã gửi headers thì chuyển lỗi cho middleware tiếp theo | Đạt |

### Các bài integration test

| Bài kiểm tra | Kết quả |
| --- | --- |
| Health cũ và health database | Đạt từng endpoint |
| Danh mục khớp toàn bộ SQL, chỉ trả trường công khai | Đạt |
| Nguyên liệu phân trang, tổng và ID dạng số | Đạt |
| Tìm nguyên liệu `trứng` đúng Unicode và đúng dữ liệu SQL | Đạt |
| Lọc nhóm nguyên liệu, các trang không trùng nhau | Đạt |
| Món ăn có totalTime, trường công khai và tổng khớp SQL | Đạt |
| Lọc `categoryId=1`, tìm món `trứng` | Đạt từng bộ lọc |
| Kết hợp maxTime và difficulty | Đạt |
| Sort newest, name_asc, name_desc, time_asc, time_desc khớp SQL | Đạt cả 5 |
| Phân trang món không trùng; trang vượt cuối giữ đúng total | Đạt |
| Chi tiết ID 1 khớp nguyên liệu/định lượng/bước của SQL, kiểu dữ liệu JSON đúng | Đạt |
| ID 999999 và đường dẫn API không tồn tại trả 404 JSON | Đạt |
| Timeout query thực tế với giới hạn 1000 ms và WAITFOR 3 giây trả 504 an toàn | Đạt |
| ID 0, âm, thập phân, vượt SQL INT, chứa chuỗi SQL trả 400 | Đạt từng trường hợp |
| Page 0, âm, lặp, dạng khoa học, vượt 100000 trả 400 | Đạt từng trường hợp |
| Limit 0, thập phân, vượt giới hạn; categoryId/maxTime sai trả 400 | Đạt từng trường hợp |
| Difficulty/sort không thuộc whitelist, sort/search/group lặp trả 400 | Đạt từng trường hợp |
| Search vượt 150, nhóm nguyên liệu vượt 100 ký tự trả 400 | Đạt từng giới hạn |
| Sort chứa `DROP TABLE` trả 400, không thực thi SQL | Đạt |
| Search payload `' OR 1=1;--` trên món và nguyên liệu được coi là dữ liệu thường | Đạt cả 2 |
| Search `%`, `_`, `[`, `~` trên món/nguyên liệu không trở thành wildcard | Đạt cả 8 trường hợp |
| Database đích không tồn tại trong tiến trình test riêng: health 200 → API dữ liệu 503 → health 200 | Đạt, không tạo database thử |

Lỗi 500 được chủ động tạo trong ứng dụng Express của unit test; không thêm endpoint gây lỗi vào API thật. Timeout được chủ động gây trên SQL Server thật trong ứng dụng test riêng. Tất cả thông báo lỗi phía khách và log ứng dụng đều được kiểm tra không chứa chuỗi kết nối/password/SQL/stack trace.

Đã sửa hai khác biệt driver được phát hiện qua kiểm thử: cột IDENTITY có thể được trả dạng chuỗi nên API chuẩn hóa ID sang number; timeout native trả `EREQUEST` + `HYT00` nên middleware nhận diện SQLSTATE, không chỉ `ETIMEOUT`.

## Bảo toàn dữ liệu và phạm vi

- Không thay `database/schema.sql`/`seed.sql`, không chạy lại seed, không tạo database hoặc tài khoản.
- Các test truy vấn chỉ đọc; những payload SQL Injection không được thực thi như câu lệnh.
- Không thay mã nguồn Frontend hoặc hợp đồng `/api/health`.
- Chưa có thuật toán gợi ý, API ghi dữ liệu, đăng nhập hoặc Admin.
- Production dependency audit báo **0 vulnerabilities**. Audit khi cài đặt vẫn báo **3 high** trong chuỗi dev nodemon đã ghi nhận từ Bước 1; không dùng force/downgrade để che cảnh báo.

## File tạo hoặc sửa

Tạo:

- `server/src/config/database.js`.
- `server/src/utilities/database-config.js`, `http-error.js`, `query.js`.
- Ba service, controller và router `category`, `ingredient`, `recipe` trong các thư mục tương ứng, dùng quy ước tên `.service.js`, `.controller.js`, `.routes.js` nhất quán với mã nguồn cũ.
- `server/scripts/check-db.js`.
- `server/tests/query-validation.test.js`, `database-config.test.js`, `error-handler.test.js`, `api.integration.test.js`, `database-failure.integration.test.js`.
- `docs/API.md`, `docs/BACKEND_VERIFICATION.md`.
- `server/.env` local, không được đưa lên Git.

Cập nhật `server/package.json`, `package-lock.json`, `.env.example`, `src/routes/api.routes.js`, `src/middlewares/error-handler.js`, `src/server.js`; `README.md`, `PLAN.md`, `database/README.md`, `docs/architecture.md`.

## Phần còn lại

Không còn lỗi trong phạm vi kiểm tra Bước 3. Native Client 11 chỉ là lựa chọn development có sẵn; để chạy production cần ODBC 17/18 và chứng chỉ đúng, đã có guard để từ chối cấu hình không an toàn. Chưa kiểm tra kết nối production hoặc các môi trường Node/ODBC khác máy hiện tại. `sqlcmd` thiếu ODBC17 và chứng chỉ tự ký của máy vẫn giữ nguyên; chúng không chặn API Node đang dùng driver đã chọn.

Khởi động: vào `server`, chạy `npm run check:db`, sau đó `npm run dev`; API tại `http://127.0.0.1:5000`. Dừng bằng `Ctrl+C`.
