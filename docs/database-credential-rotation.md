# Thay credential database Prisma

File `apps/api/.env.example` đã được thay bằng placeholder. Database credential không còn xuất hiện trong nội dung hiện tại của các file được Git theo dõi. Thay đổi này không thu hồi credential cũ và không xóa giá trị đó khỏi lịch sử Git.

## Kết quả thực hiện ngày 24/10/2026

- Đã xác thực Prisma CLI mới vào workspace `room-booking`, project `roomly`.
- Đã tạo credential `roomly-api-runtime-20261024` cho database hiện có, không tạo lại/reset dữ liệu.
- Đã đối chiếu kết nối cũ/mới đọc cùng dữ liệu: 20 tài khoản, 4 phòng, 0 lịch đặt tại thời điểm kiểm tra.
- Đã cập nhật `DATABASE_URL` ở local và backend Vercel Production; khởi động lại local và triển khai backend thành công (`dpl_6tJheu5xuEXyq6nw63SPqNFvNus2`).
- Đã kiểm tra đăng nhập, danh sách tài khoản, danh sách phòng và trường ghi chú ở cả local/production.
- Sau khi chủ tài khoản đối chiếu credential cũ trong Console, đã thu hồi đúng `console-connection-string` (`con_thss3dehxem5347kaop9tc7m`). Credential `Prisma Postgres API Key` khác được giữ nguyên.
- Kết nối mới bằng credential cũ thất bại (`P1001` từ proxy), trong khi credential mới cùng host đọc dữ liệu thành công. API local và production được kiểm tra lại sau thu hồi.
- Bổ sung `.vercelignore` để các file `.env` và trạng thái chứa credential không được tải lên qua Vercel CLI.

## Thứ tự thực hiện

1. Đăng nhập tài khoản quản trị có quyền với database hiện tại.
2. Xác định đúng database từ cấu hình đang sử dụng; không tạo database khác hoặc reset dữ liệu.
3. Tạo credential thay thế, giữ credential cũ tạm thời trong lúc chuyển kết nối.
4. Cập nhật `DATABASE_URL` ở local và các môi trường của backend trên Vercel sử dụng database đó. Không lưu credential trong file được Git theo dõi và không in giá trị ra log/chat.
5. Khởi động lại API local và triển khai lại backend với biến môi trường mới. Kiểm tra đăng nhập và một truy vấn đọc dữ liệu.
6. Thu hồi/xóa credential đã lộ tại nơi quản lý database, sau khi các ứng dụng sử dụng credential mới hoạt động.
7. Thử credential cũ bằng một kết nối mới và xác nhận bị từ chối. Không chỉ dựa vào việc credential mới hoạt động để kết luận credential cũ đã hết hiệu lực.

Nếu database được tạo qua Vercel Marketplace, cần dùng luồng quản lý Prisma integration của Vercel cho credential mà integration quản lý. Các credential được tạo riêng trong Prisma Console cần quản lý tại Prisma Console.

Không dùng `ALTER USER` hoặc chỉ thay nội dung `DATABASE_URL` để giả lập việc đổi credential tại nhà cung cấp. Không rewrite/force-push lịch sử Git khi chưa đánh giá ảnh hưởng đến các bản checkout khác.

## Nguồn chính thức

- [Prisma: thay hoặc xóa credential database](https://www.prisma.io/docs/postgres/database/connecting-to-your-database#rotate-or-delete-a-credential)
- [Prisma: thay secret của integration trên Vercel](https://www.prisma.io/docs/guides/postgres/vercel#rotating-your-prisma-integration-secrets-in-vercel)
