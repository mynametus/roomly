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

Mở `http://localhost:5173`. Đăng nhập bằng email và mật khẩu quản trị viên đã khai báo trong `.env`. Người dùng khác có thể tự đăng ký từ màn hình đăng nhập.

`db:seed` tạo ba phòng mẫu. Nếu có `ADMIN_EMAIL` và `ADMIN_PASSWORD`, lệnh cũng tạo hoặc nâng tài khoản đó lên quyền quản trị viên. Không dùng mật khẩu mẫu khi triển khai thật.

## Quy tắc nghiệp vụ

- Không cho phép hai lượt đặt giao nhau trong cùng phòng; giờ kết thúc của lượt trước có thể trùng giờ bắt đầu của lượt kế tiếp.
- Một lượt đặt không dài quá 4 giờ và một người không đặt tổng cộng quá 4 giờ trong một ngày, tính trên tất cả phòng. Múi giờ ngày nghiệp vụ cấu hình bằng `BUSINESS_TIME_ZONE` (mặc định `Asia/Ho_Chi_Minh`).
- Đặt định kỳ gồm 2–8 buổi hàng tuần. Toàn bộ buổi được kiểm tra và ghi trong một transaction; chỉ cần một buổi không hợp lệ, cả yêu cầu bị từ chối.
- Hủy một buổi giữ lại lịch sử. Với lịch định kỳ, người dùng có thể chọn hủy riêng buổi hiện tại hoặc hủy buổi đó và tất cả buổi tiếp theo.
- Quản trị viên có thể thêm, chỉnh sửa, tạm ngưng/kích hoạt phòng; xem/hủy lịch của mọi người; và tạo tối đa 50 tài khoản thành viên mỗi lượt. Mật khẩu tạm được tạo ngẫu nhiên, chỉ hiển thị một lần sau khi tạo thành công. Người dùng thường chỉ xem và hủy lịch của mình.

## Kiểm thử và build

```powershell
npm test
npm run build
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

Tài khoản quản trị được tạo bởi lệnh seed. Mật khẩu quản trị production hiện được lưu cục bộ trong `apps/api/.env` ở biến `ADMIN_PASSWORD`; không commit hoặc chia sẻ file này.
