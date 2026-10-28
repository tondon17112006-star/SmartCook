# GitHub workflow SmartCook

Repository: https://github.com/tondon17112006-star/SmartCook

GitHub lưu source, tài liệu và SQL scripts. GitHub không tự đồng bộ dữ liệu trong SQL Server đang chạy trên máy cá nhân.

## Clone và tạo nhánh

~~~powershell
git clone https://github.com/tondon17112006-star/SmartCook.git
Set-Location .\SmartCook
git switch -c feat/mo-ta-ngan
~~~

Dùng tên nhánh thể hiện mục đích, ví dụ feat/pantry-export, fix/auth-error-message hoặc docs/handoff. Không phát triển trực tiếp trên main.

## Vòng đời thay đổi

1. Cập nhật từ remote theo chính sách nhóm trước khi bắt đầu.
2. Thay đổi trong nhánh riêng; không đưa .env, node_modules, dist, cache, log hoặc backup SQL vào index.
3. Chạy lint/build/test có liên quan, kiểm tra git diff và git status.
4. Commit nhỏ, mô tả rõ phạm vi.
5. Push nhánh và mở Pull Request vào main.
6. Reviewer kiểm tra code, test, security và tài liệu; giải quyết comment trước merge.

Ví dụ:

~~~powershell
git status --short
git add client/src/components/Example.jsx client/tests/example.test.js
git commit -m "feat: improve example flow"
git push -u origin feat/mo-ta-ngan
~~~

Không thêm tất cả file một cách mù quáng bằng git add . khi chưa kiểm tra status.

## Pull Request checklist

- Mô tả mục tiêu, route/API/schema bị ảnh hưởng và cách kiểm thử.
- Đính kèm kết quả test thực tế; nêu rõ phần chưa test.
- Không có secret, personal database backup hoặc screenshot chứa dữ liệu nhạy cảm.
- Cập nhật README/API/schema/docs khi thay đổi contract.
- Với migration hoặc data change, có kế hoạch backup/rollback đã được review; không chạy destructive SQL tự phát.

## Xử lý conflict

1. Dừng và đọc diff/conflict marker; không nhận cả hai phía theo thói quen.
2. Đồng bộ theo chính sách nhóm, giải quyết từng file, chạy test phù hợp.
3. Ghi rõ khi conflict thay đổi API/schema/auth.
4. Nhờ owner/reviewer quyết định nếu conflict làm thay đổi nghiệp vụ hoặc dữ liệu.

Không dùng git reset --hard hoặc git clean -fd để xử lý conflict trên workspace chứa thay đổi chưa xác định.

## Bảo vệ main

- main chỉ nhận thay đổi qua Pull Request đã review.
- Yêu cầu checks phù hợp trước merge: lint/build/unit/integration trong phạm vi thay đổi.
- Không force-push main, không merge khi test đang lỗi hoặc evidence bị thiếu.
- Tag/release chỉ sau khi review security, deployment và backup policy.

## Hygiene

.gitignore đã loại .env, node_modules, cache, logs, build outputs và SQL Server data/backup files. Chỉ các .env.example có placeholder được track. Trước push, kiểm tra:

~~~powershell
git status --short
git diff --check
git ls-files | Select-String -Pattern '(^|/)\.env($|\.)|node_modules|\.bak$|\.log$'
~~~

Nếu phát hiện secret đã commit, dừng phát hành, thu hồi/rotate secret theo quy trình và thông báo owner; xóa file khỏi working tree không đủ vì lịch sử Git có thể còn dữ liệu.
d