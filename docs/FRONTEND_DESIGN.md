# Thiết kế Frontend SmartCook — Bước 5

Ngày cập nhật: 17/10/2026. Phạm vi: giao diện khám phá công thức kết nối API đã có. Không thay đổi Backend, SQL Server hoặc thuật toán gợi ý; không mở chức năng Bước 6.

## Hệ thống giao diện

| Thành phần | Quy ước |
| --- | --- |
| Xanh chính | `#2F7D5C` — nút chính, đường dẫn, trạng thái active |
| Xanh đậm | `#1F4D3A` — tiêu đề và Footer |
| Kem | `#FFF9F1` — hero, khu vực nhấn mạnh |
| Cam | `#F59E42` — điểm nhấn và trạng thái đang phát triển |
| Nền trắng / chữ | `#FFFFFF` / `#25342C` |
| Font | Segoe UI và system font, hỗ trợ tiếng Việt, không gọi dịch vụ font bên ngoài |
| Bố cục | Khung tối đa 1280px; padding 20/32/40px; nhịp khoảng trắng theo section |
| Card | Bo góc 16–24px; viền nhẹ; hover di chuyển nhẹ; ảnh tỷ lệ 4:3 |

Token màu nằm trong `client/src/index.css`, Tailwind CSS 4 qua `@tailwindcss/vite`. Các class dùng chung: `container-shell`, `button-primary`, `button-secondary`, `button-ghost`, `eyebrow`, `section-title`, `field`, `surface-card`, `recipe-grid`.

Home đi từ cảm hứng bữa cơm đến danh mục, công thức mới, cách dùng 3 bước và CTA nguyên liệu. Nội dung 3 bước mô tả hướng phát triển; có dòng thông báo chọn nguyên liệu/gợi ý chưa mở. Không có số người dùng, đánh giá hoặc thống kê tiếp thị giả.

## Các trang

| Route | Nội dung hiện tại |
| --- | --- |
| `/` | Hero với hai CTA; 8 danh mục và 8 món mới nhất từ API; giới thiệu 3 bước; CTA |
| `/recipes` | Tìm tên, danh mục, tổng thời gian tối đa, độ khó, sắp xếp, phân trang 12 món |
| `/recipes/:id` | Thông tin thật, định lượng gốc theo khẩu phần, nguyên liệu tùy chọn/ghi chú, các bước nấu |
| `/ingredients`, `/suggestions` | Thông báo đang phát triển; dành cho Bước 6 |
| `/login`, `/register`, `/favorites`, `/profile`, `/admin` | Thông báo chức năng chưa mở; không có form hoặc thao tác giả |
| `*` | Trang 404 với liên kết về Home/Recipes |

Navbar sticky có logo ChefHat, active link, menu hamburger, nút “Tìm món ngay”. Khi điều hướng, Navbar remount theo location key để đóng menu; Escape đóng menu và đưa focus về nút mở. Footer chỉ dùng route đã khai báo.

## Component và luồng dữ liệu

- `MainLayout`, `Navbar`, `Footer`, `ScrollToTop`: khung trang, menu và cuộn đầu trang khi đổi pathname.
- `RecipeCard`: ảnh/fallback, tên, danh mục, phút, độ khó, liên kết “Xem công thức”. Toàn thẻ là một liên kết, không lồng nút vào liên kết.
- `CategoryCard`: tên, mô tả và image/icon trung tính từ dữ liệu danh mục; liên kết query `categoryId`.
- `RecipeImage`: ảnh hợp lệ hoặc hình nồi/lá trung tính kèm “Ảnh đang cập nhật”; xử lý cả NULL và lỗi tải ảnh.
- `SearchBar`, `Pagination`: input có nhãn, submit tìm kiếm, trạng thái trang hiện tại và nút trước/sau.
- `LoadingSpinner`, `RecipeSkeleton`, `EmptyState`, `ErrorState`: trạng thái tiếng Việt, status/alert và thử lại.

`services/api.js` giữ Axios base URL `/api`, timeout 8 giây. `catalogService.js` đọc `response.data` của Axios, giữ nguyên envelope `{data, pagination?}` của Backend. Home gọi danh mục/công thức độc lập; lỗi một phần không che phần còn lại. Detail chỉ gọi API sau khi kiểm tra ID hợp lệ.

`useApiResource(loader, deps)` nhận loader với AbortSignal; hủy request khi unmount/đổi bộ lọc. Token theo deps/retry loại dữ liệu cũ ngay trong render, không cho response đến muộn ghi đè kết quả mới. Hook giữ lỗi Axios cho trang xử lý 404; `ErrorState` chỉ hiển thị thông báo an toàn bằng React text.

URL là nguồn dữ liệu của bộ lọc. `utilities/recipeFilters.js` chuẩn hóa Unicode NFC, trim, giới hạn search 150 ký tự, kiểm tra số nguyên dương/SQL INT và page tối đa 100000. Query trùng, không hỗ trợ hoặc sai được bỏ và thay URL canonical bằng `replace`. `limit=12` cố định; chỉ dùng sort whitelist `newest`, `name_asc`, `name_desc`, `time_asc`, `time_desc`. Thay bộ lọc/sort đưa page về 1; đổi page giữ các bộ lọc. Backend tìm/lọc/sắp xếp trên toàn database, không lọc riêng trang đang tải.

Provider/card health từ Bước 1 vẫn giữ trong source, không gắn vào cây ứng dụng hiện tại để tránh hiển thị chi tiết kỹ thuật trong luồng khám phá món ăn.

## Responsive và khả năng truy cập

| Viewport yêu cầu | Hero / chi tiết | Recipe grid | Danh mục | Navbar |
| --- | --- | --- | --- | --- |
| 375px | 1 cột | 1 cột | 1 cột | Hamburger, CTA trong menu |
| 768px | 1 cột | 2 cột | 2 cột | Hamburger, CTA ngoài menu |
| 1024px | 2 cột | 3 cột | 4 cột | Hamburger, CTA ngoài menu |
| 1440px | 2 cột | 4 cột | 4 cột | Đủ menu desktop và CTA |

Đây là quy tắc từ CSS, **chưa phải kết quả kiểm thử trực quan**. Dùng breakpoint Tailwind mặc định sm=640, md=768, lg=1024, xl=1280px. Các phần tử nhập/form dùng min-width phù hợp, từ khóa dài có `overflow-wrap:anywhere`. Ảnh giữ aspect ratio và object-fit cover.

Có `lang="vi"`, semantic header/nav/main/footer/article/section, một h1 mỗi route, skip link, aria-current/expanded/controls, nhãn input, alt ảnh, role status/alert, focus outline và hỗ trợ `prefers-reduced-motion`. Không dùng ảnh để thay cho nội dung chữ cần thiết. Các trạng thái và bố cục vẫn cần kiểm tra bằng bàn phím và browser thật theo checklist nghiệm thu.

## Ảnh hero

- Tệp: `client/src/assets/smartcook-hero.png`, 1448×1086, khoảng 2,82 MB.
- Tạo mới bằng công cụ Imagegen tích hợp, nền không trong suốt; đã xem và kiểm tra ảnh đầu ra.
- Là hình thương hiệu bữa cơm Việt cho Home, không ánh xạ tới món hoặc danh mục trong SQL Server. Ảnh công thức hiện NULL vẫn dùng fallback trung tính.
- Chưa tối ưu định dạng WebP/AVIF; có thể tối ưu trong giai đoạn hiệu năng sau.

Prompt đã dùng:

> Create a high-end editorial food photograph for the hero of SmartCook, a Vietnamese home cooking website. A warm, welcoming, authentic Vietnamese family meal on a softly textured warm cream tabletop: one generous ceramic plate with golden pan-fried eggs with scallions, a small bowl of rice, a separate shallow bowl of tomato and pork soup, fresh herbs, sliced cucumber, simple wooden chopsticks. Appetizing natural food textures and steam, soft window daylight from upper left, restrained earthy ceramic dishes in sage green and cream, a small green linen napkin. Overhead to gentle three-quarter angle, art directed magazine photography with realistic generous plating and calm negative space. The food fills the image naturally without clutter, main plate in the center right, harmonious forest green and warm orange accents. Landscape 4:3 framing, suitable for a rounded website hero crop. No people, no hands, no writing, no letters, no text, no logos, no watermarks. This is a general brand hero photograph, not a reference image for any specific recipe record.
