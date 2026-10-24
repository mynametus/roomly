# Rà soát ứng dụng Roomly — 24/10/2026

## Nhận xét tổng quan

Phân quyền phòng họp và lịch đặt đã đúng theo yêu cầu trong phạm vi kiểm tra. User chỉ xem danh sách phòng, tạo lịch cho chính mình và xem/hủy lịch của mình. Admin quản lý phòng, lịch của mọi người, tài khoản và báo cáo. Giới hạn 4 giờ đã được bỏ ở cả từng lượt đặt và tổng thời gian trong ngày.

Ứng dụng còn các vấn đề về thông tin kết nối database, hiệu lực phiên sau đổi mật khẩu, ngày đặt trong quá khứ và công thức báo cáo cần xử lý trước khi vận hành với dữ liệu thật.

## Phạm vi và phương pháp

- Đọc mã giao diện React, toàn bộ nhóm REST API, middleware xác thực/phân quyền, quy tắc đặt phòng và schema dữ liệu.
- Kiểm thử API với database giả lập: đăng nhập, bắt buộc đổi mật khẩu, tài khoản bị khóa, quyền admin/user, phòng trống, đặt một lần/định kỳ, hủy lịch, bộ phận và báo cáo.
- Kiểm thử render giao diện để kiểm tra các nút thao tác phòng với admin/user, kể cả khi không có phòng nào.
- Kiểm tra chỉ đọc trên API local và database hiện tại: đăng nhập admin, CORS, phòng, lịch, tài khoản và báo cáo. Kiểm tra quyền user bằng token thử nghiệm ký từ máy chủ cho một user hiện có đã đổi mật khẩu; không thử mật khẩu của user đó.
- Không tạo, sửa, xóa dữ liệu nghiệp vụ thật trong đợt rà soát này. Những tình huống lỗi bên dưới được tái hiện bằng mock.
- Không triển khai lên Vercel trong đợt này.
- Chưa chạy toàn bộ thao tác trên trình duyệt desktop/mobile hoặc kiểm thử tải và cạnh tranh đồng thời trên database thật.

## Ma trận quyền đã kiểm tra

| Chức năng | User | Admin |
| --- | --- | --- |
| Xem danh sách phòng | Có | Có |
| Thêm/sửa/ngừng sử dụng phòng | Bị chặn ở giao diện và API | Có |
| Xóa hẳn phòng | Không | Hiện chưa có chức năng; dùng ngừng sử dụng |
| Tìm phòng trống theo giờ, sức chứa, tiện nghi | Có | Có |
| Đặt một lần hoặc định kỳ | Cho tài khoản đang đăng nhập | Cho tài khoản đang đăng nhập |
| Đặt một buổi trên 4 giờ | Có | Có |
| Tổng lịch trong ngày trên 4 giờ | Có | Có |
| Xem danh sách/chi tiết lịch | Chỉ của mình | Tất cả |
| Hủy một buổi hoặc các buổi tiếp theo trong chuỗi | Chỉ của mình | Của mọi người |
| Thêm tài khoản, sửa bộ phận, khóa/mở khóa, reset mật khẩu | Bị chặn | Có |
| Xem báo cáo sử dụng phòng | Bị chặn | Có |

User không thể vượt quyền bằng cách truyền `userId` của người khác, gọi trực tiếp ID lịch của người khác hoặc sử dụng token cũ có claim ADMIN khi database đã chuyển tài khoản về USER. Middleware lấy vai trò hiện tại từ database.

Các kiểm tra trùng lịch trong cùng phòng, phòng đang hoạt động, sức chứa, giờ kết thúc sau giờ bắt đầu và cùng ngày nghiệp vụ vẫn được giữ. Lượt đặt hàng tuần vẫn giới hạn 2–8 buổi như trước.

## Các chỉnh sửa đã hoàn tất trong đợt làm việc

1. Bỏ giới hạn 4 giờ/lượt và 4 giờ/ngày ở API, truy vấn kiểm tra hạn mức và nội dung hướng dẫn giao diện.
2. Sửa nút **Thêm phòng** từng hiển thị sai cho user khi danh sách phòng trống.
3. User thấy **Danh sách phòng**, admin thấy **Quản lý phòng**. Form thêm/sửa phòng chỉ render với admin và thao tác lưu cũng kiểm tra vai trò.
4. User thấy **Đặt phòng của tôi**, admin thấy **Quản lý đặt phòng**, kèm mô tả đúng phạm vi.
5. Giao diện lọc lịch theo tài khoản cho user; API đã có bộ lọc và kiểm tra sở hữu cho danh sách, chi tiết và hủy lịch.
6. Xóa trạng thái màn hình/form khi đăng xuất để tránh giữ giao diện quản trị khi chuyển tài khoản.

## Vấn đề còn tồn tại, theo mức ưu tiên

### 1. Cao — thông tin kết nối database thật từng nằm trong file mẫu được Git theo dõi

- Vị trí: `apps/api/.env.example:1`.
- Tại thời điểm rà soát, chuỗi kết nối chứa credential; kiểm tra trong bộ nhớ xác nhận credential và host khớp database đang cấu hình ở `apps/api/.env`.
- Không có credential nào được chép vào báo cáo này. Chưa xác minh repository công khai hay những ai đã truy cập lịch sử Git.
- Cần thay giá trị trong file mẫu bằng placeholder và thay/thu hồi credential đã đưa vào Git, đồng thời cập nhật cấu hình ứng dụng sử dụng credential đó. Chỉ sửa file hiện tại không xóa credential khỏi lịch sử Git.
- Cập nhật sau rà soát: file mẫu đã được thay bằng placeholder và quét lại các file Git theo dõi không còn thấy mật khẩu database trong nội dung hiện tại. Việc thu hồi credential tại nhà cung cấp đang chờ xác thực tài khoản Prisma; chưa được đánh dấu hoàn tất.

### 2. Cao — đổi mật khẩu không thu hồi token đã phát hành

- Vị trí: `apps/api/src/middleware/auth.ts:30`, `apps/api/src/middleware/auth.ts:64`, `apps/api/src/routes/auth.ts:43`.
- Tái hiện: cấp token, đổi mật khẩu thành công, sau đó gọi `/api/auth/me` bằng token cũ vẫn trả HTTP 200.
- Token có thời hạn 12 giờ và middleware chưa đối chiếu phiên bản phiên hoặc thời điểm đổi mật khẩu. Nếu token cũ bị lộ, thay mật khẩu không chấm dứt quyền truy cập của token đó ngay.
- Khóa tài khoản vẫn chặn truy cập ngay. Reset mật khẩu buộc đổi mật khẩu và tạm chặn tài nguyên, nhưng sau khi chủ tài khoản đổi xong, token cũ chưa hết hạn có thể dùng lại.
- Cần có cơ chế thu hồi phiên như `sessionVersion` hoặc thời điểm vô hiệu hóa token; cập nhật khi đổi/reset mật khẩu.

### 3. Trung bình — API chấp nhận lịch đặt trong quá khứ

- Vị trí: `apps/api/src/services/booking-rules.ts:6`, `apps/web/src/App.tsx` phần `BookingModal`.
- Tái hiện: gửi `POST /api/bookings` với lịch 09:00–17:00 ngày 01/01/2020 vẫn nhận HTTP 201 khi phòng hợp lệ và không trùng.
- Giao diện đặt phòng chặn chọn ngày trước hôm nay nhưng API chỉ kiểm tra thứ tự giờ và cùng ngày nghiệp vụ. Người gọi API trực tiếp có thể bỏ qua ràng buộc trên giao diện.
- Cần thống nhất chính sách: nếu không cho đặt quá khứ thì kiểm tra ở API; nếu admin được nhập lịch sử thì cần quy định rõ quyền đó.

### 4. Trung bình — tỷ lệ sử dụng tổng có thể vượt 100% khi có phòng ngừng sử dụng

- Vị trí: `apps/api/src/routes/reports.ts:24`, `apps/api/src/routes/reports.ts:51`.
- Tử số cộng giờ đặt của mọi phòng, nhưng mẫu số chỉ lấy tổng giờ của các phòng đang ACTIVE tại thời điểm xem báo cáo.
- Tái hiện: một phòng ACTIVE và một phòng INACTIVE, mỗi phòng có 8 giờ đặt trong khoảng báo cáo 8 giờ; tỷ lệ tổng trả về 200%.
- Cần thống nhất tập phòng được tính ở tử số/mẫu số. Muốn báo cáo chính xác công suất lịch sử còn cần thông tin lịch sử thời gian phòng hoạt động/ngừng sử dụng.

## Các giới hạn chức năng cần biết

- Chưa có xóa hẳn phòng; hiện admin có thể ngừng sử dụng để giữ lịch sử.
- Chưa có chỉnh sửa giờ/phòng của một lịch đã tạo; hiện thao tác quản lý là xem và hủy, rồi đặt lại khi cần.
- Chưa có phân trang danh sách tài khoản/lịch đặt; khi dữ liệu tăng, cần kiểm tra hiệu năng và bổ sung phân trang.
- Chưa có cơ chế giới hạn số lần thử đăng nhập ở tầng ứng dụng trong mã nguồn hiện tại; chưa kiểm tra cấu hình bảo vệ ở hạ tầng Vercel.

## Kết quả kiểm chứng

- 85 kiểm thử hồi quy được lưu trong repository, bao gồm quyền API và render giao diện cho hai vai trò.
- 3 kiểm thử tái hiện tạm thời xác nhận các vấn đề token, lịch quá khứ và tỷ lệ báo cáo; đã xóa file kiểm thử tạm sau khi ghi nhận.
- Tổng đợt chạy kiểm tra: **88/88 đạt**, 10 file, chạy với `--maxWorkers=1` sau khi máy thiếu bộ nhớ khi chạy đồng thời nhiều bước.
- Kiểm tra API local chỉ đọc: **admin và user đạt** trong các tuyến đọc đã nêu.
- Kiểm tra TypeScript API (`tsc -p tsconfig.json`): **đạt**. Build giao diện (`npm run build -w @roomly/web`): **đạt**.

## Ưu tiên đề xuất

Xử lý credential database và thu hồi phiên khi đổi/reset mật khẩu trước; sau đó thống nhất chính sách đặt quá khứ và sửa công thức báo cáo. Khi các điểm này được xử lý, nên kiểm thử các luồng đầy đủ trên trình duyệt cho cả hai vai trò trước khi vận hành rộng hơn.
