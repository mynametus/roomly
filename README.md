# Roomly

Roomly là ứng dụng quản lý và đặt phòng họp: giao diện React responsive, REST API Express, PostgreSQL/Prisma, đăng nhập và phân quyền quản trị viên.

## Yêu cầu

- Node.js 20 trở lên
- PostgreSQL (Neon phù hợp khi triển khai serverless trên Vercel)
- npm

## Chạy local trên Windows

1. Tạo database PostgreSQL.
2. Sao chép `apps/api/.env.example` thành `apps/api/.env`, rồi điền `DATABASE_URL`, `JWT_SECRET` (ít nhất 32 ký tự), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Giữ `FRONTEND_URL=http://localhost:5173`.
3. Sao chép `apps/web/.env.example` thành `apps/web/.env`; giữ `VITE_API_URL=http://localhost:4000`.
4. Từ thư mục gốc dự án, chạy:

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Mở `http://localhost:5173`. Đăng nhập bằng email và mật khẩu quản trị viên đã khai báo trong `.env`. Đây là ứng dụng nội bộ: tự đăng ký đã tắt, quản trị viên cấp tài khoản từ mục **Quản lý tài khoản**.

Nếu `.env` của frontend được tải từ Vercel, thêm `VITE_API_URL="http://localhost:4000"` vào `apps/web/.env.local` để local gọi API local. API tự cho phép `http://localhost:5173` và `http://127.0.0.1:5173` khi chạy phát triển; trên production/Vercel chỉ các địa chỉ trong `FRONTEND_URL` được phép. Chạy `npm run dev` từ thư mục gốc để khởi động cả giao diện lẫn API.

`db:seed` chỉ tạo hoặc cập nhật tài khoản quản trị từ `ADMIN_EMAIL` và `ADMIN_PASSWORD`, không tạo phòng mẫu. Có thể cấu hình `ADMIN_NAME` và `ADMIN_DEPARTMENT` (mặc định `Quản trị hệ thống`). Không dùng mật khẩu mẫu khi triển khai thật. Khi cần dữ liệu demo, chạy `npm run db:seed -w @roomly/api -- --demo` để thêm ba phòng mẫu.

Để bắt đầu nhập dữ liệu thật, chạy `npm run db:inspect` để kiểm tra database và số bản ghi, rồi `npm run db:reset`. Lệnh reset xóa toàn bộ lịch đặt, chuỗi định kỳ, phòng và tài khoản, sau đó tạo lại duy nhất tài khoản quản trị đã cấu hình; toàn bộ thao tác diễn ra trong một transaction. Cần có `ADMIN_EMAIL` và `ADMIN_PASSWORD` trước khi chạy. Các phiên đăng nhập cũ sẽ hết hiệu lực; đăng nhập lại bằng tài khoản quản trị. Lệnh dùng database trong `apps/api/.env` hoặc biến môi trường `DATABASE_URL` đang được đặt.

## Quy tắc nghiệp vụ

- Không cho phép hai lượt đặt giao nhau trong cùng phòng; giờ kết thúc của lượt trước có thể trùng giờ bắt đầu của lượt kế tiếp.
- Không giới hạn số giờ của mỗi lượt đặt hoặc tổng số giờ một người đặt trong ngày. Mỗi lượt đặt phải có giờ kết thúc sau giờ bắt đầu và nằm trong cùng ngày nghiệp vụ. Múi giờ ngày nghiệp vụ cấu hình bằng `BUSINESS_TIME_ZONE` (mặc định `Asia/Ho_Chi_Minh`).
- Lịch họp có thể đặt một lần hoặc lặp hàng ngày, hàng tuần (chọn nhiều thứ), hàng tháng theo ngày hoặc thứ thứ n/cuối tháng. Chuỗi cần ngày kết thúc hoặc số buổi, tối đa 6 tháng và 200 buổi; tháng không có ngày 29–31 đã chọn sẽ được bỏ qua.
- Trước khi xác nhận, xem trước danh sách các buổi và xung đột. Có thể bỏ riêng một ngày hoặc đổi phòng/giờ cho ngày đó rồi kiểm tra lại. Khi lưu, hệ thống kiểm tra lại toàn bộ các buổi được giữ và ghi trong một transaction; chỉ cần một buổi không hợp lệ, không có buổi nào được lưu.
- Sửa/hủy lịch định kỳ có ba phạm vi: chỉ buổi này, buổi này và các buổi sau, hoặc toàn bộ chuỗi. Khi sửa nhiều buổi, phòng/giờ/số người mới được áp dụng và ngày của từng buổi được giữ nguyên; các buổi đã hủy không được khôi phục. Lịch hủy vẫn được giữ trong lịch sử.
- Người dùng có thể tìm phòng còn trống theo thời gian, sức chứa và tiện nghi. Lịch đặt vẫn được kiểm tra lại khi xác nhận để tránh đặt trùng.
- Quản trị viên có thể thêm/chỉnh sửa phòng và tiện nghi, tạm ngưng/kích hoạt phòng, xem/hủy lịch của mọi người, tạo tối đa 50 tài khoản mỗi lượt, tìm/khóa/mở tài khoản, đặt lại mật khẩu và xem báo cáo sử dụng phòng.
- Thành viên chỉ xem danh sách phòng để đặt, không được thêm/sửa/ngừng sử dụng phòng. Mục `Đặt phòng của tôi` chỉ hiển thị và cho phép quản lý lịch của chính tài khoản đó; quản trị viên có thể xem và hủy lịch của tất cả người dùng. API kiểm tra quyền cả khi truy cập trực tiếp bằng mã lịch đặt.
- Phòng họp có ghi chú không bắt buộc (tối đa 2.000 ký tự). Admin có thể nhập, sửa hoặc xóa nội dung ghi chú; người dùng xem ghi chú ở danh sách phòng, kết quả tìm phòng trống và khi chọn phòng để đặt.
- Mỗi tài khoản mới cần có bộ phận làm việc (tối đa 120 ký tự). Khi thêm hàng loạt, nhập `Tên, email, bộ phận làm việc` trên từng dòng. Quản trị viên có thể sửa bộ phận và tìm tài khoản theo tên, email hoặc bộ phận. Tài khoản cũ chưa có bộ phận hiển thị `Chưa cập nhật`.
- Tài khoản do admin tạo dùng mật khẩu ban đầu `12345678`; tài khoản được đặt lại dùng mật khẩu ngẫu nhiên chỉ hiển thị một lần. Cả hai trường hợp đều bắt buộc đổi mật khẩu sau khi đăng nhập. Tài khoản bị khóa sẽ mất quyền truy cập ngay cả khi phiên đăng nhập cũ còn hiệu lực.

## Kiểm thử và build

```powershell
npm test
npm run build
```

Kiểm tra luồng tạo/sửa/hủy lịch với PostgreSQL thật (mọi bản ghi thử được rollback):

```powershell
$env:RUN_DATABASE_TESTS = "1"
npm run test -w @roomly/api -- src/booking-database.test.ts --maxWorkers=1
Remove-Item Env:RUN_DATABASE_TESTS
```

## Triển khai Vercel

Tạo hai Vercel Project cùng liên kết repository:

### Frontend

- Root Directory: `apps/web`
- Framework: Vite; Output Directory: `dist`
- Environment Variable: `VITE_API_URL=https://<api-domain>`
- Roomly Production: https://roomly-web-seven.vercel.app

### API

- Root Directory: `apps/api`
- Dùng Node.js Functions; Express entry point là `apps/api/index.ts`.
- Environment Variables: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL=https://<web-domain>`, `BUSINESS_TIME_ZONE=Asia/Ho_Chi_Minh`.
- Backend được Vercel nhận diện là Express app và chạy thành một Node.js Function; endpoint đặt dưới `/api/*`.
- Sau khi thiết lập database, chạy migration production `npm run db:deploy -w @roomly/api` và seed dữ liệu ban đầu `npm run db:seed -w @roomly/api` từ môi trường có cấu hình biến môi trường.
- Roomly API Production: https://roomly-api.vercel.app

`DATABASE_URL` chỉ được cấu hình ở backend, tuyệt đối không thêm tiền tố `VITE_`. Cập nhật `FRONTEND_URL` và `VITE_API_URL` theo domain thực tế của từng deployment.

File `.env.example` chỉ chứa placeholder. Khi credential database bị lộ, thực hiện theo [hướng dẫn thay credential](docs/database-credential-rotation.md): cập nhật kết nối ứng dụng và kiểm tra hoạt động trước khi thu hồi credential cũ tại nhà cung cấp.

Tài khoản quản trị được tạo bởi lệnh seed. Mật khẩu quản trị production hiện được lưu cục bộ trong `apps/api/.env` ở biến `ADMIN_PASSWORD`; không commit hoặc chia sẻ file này.
