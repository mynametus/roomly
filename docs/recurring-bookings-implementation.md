# Lịch đặt phòng định kỳ

Nguồn yêu cầu: `docs/traodoi.docx`, gồm nội dung cuộc trao đổi và hai hình minh họa.

Phạm vi triển khai:

- Một lần, hàng ngày, hàng tuần chọn nhiều thứ, hàng tháng theo ngày hoặc thứ thứ n/cuối tháng.
- Chu kỳ lặp theo số ngày/tuần/tháng; kết thúc theo ngày hoặc số buổi. Tối đa 6 tháng và 200 buổi mỗi chuỗi, không đặt vô thời hạn.
- Ngày 29–31 không tồn tại ở tháng tương ứng được bỏ qua, có hướng dẫn rõ trên giao diện.
- Xem trước mọi buổi, kiểm tra phòng đang hoạt động, sức chứa và xung đột. Có thể bỏ riêng một ngày hoặc đổi giờ/phòng cho ngày đó rồi kiểm tra lại.
- Xác nhận kiểm tra lại trong transaction với khóa phòng; không lưu một phần nếu vẫn có xung đột.
- Sửa/hủy một buổi, buổi đó và các buổi sau, hoặc toàn bộ chuỗi. Sửa nhiều buổi áp dụng phòng/giờ/số người và giữ ngày của từng buổi.
- Giữ quyền user chỉ quản lý lịch của mình; admin quản lý tất cả. Giữ ghi chú phòng và không khôi phục giới hạn 4 giờ.
- Giữ khả năng đọc lịch cũ và API `recurrenceCount` cũ cho các client đang dùng.

Không sửa nội dung tài liệu nguồn và không reset dữ liệu thật.

Đã bổ sung migration `20261024020000_recurring_booking_rules` (cột JSON nullable trên `BookingSeries`). Các lịch cũ giữ nguyên và hiển thị như lịch hàng tuần khi chưa có cấu hình JSON.

Tạo và cập nhật nhiều buổi được ghi theo lô trong transaction. Xem trước chỉ đọc dữ liệu; khi xác nhận sẽ khóa các phòng theo thứ tự cố định và kiểm tra lại. Sửa/hủy cùng chuỗi được đồng bộ bằng khóa transaction theo chuỗi.

Kiểm chứng: kiểm thử tự động cho ngày/tuần/tháng, năm nhuận, giới hạn chuỗi, xung đột, ngoại lệ, ba phạm vi và quyền sở hữu; kiểm tra SQL thực tế trên bảng tạm rồi rollback; API local đã xem trước thành công cho cả admin và user.

Kết quả cuối: 140 kiểm thử toàn bộ ứng dụng đạt; sau khi thêm trường hợp chuỗi dài 180 buổi, toàn bộ 18 kiểm thử của nhóm kế hoạch/phạm vi cũng đạt (tổng 141 trường hợp hiện có đã được kiểm chứng). TypeScript API và build giao diện đạt. Các script kiểm tra tạm đã được xóa.

Giao diện đã được kiểm tra bằng render React và build TypeScript/Vite. Trình duyệt điều khiển tự động chưa được kết nối trong môi trường hiện tại, nên chưa có kiểm thử tương tác đầy đủ trên desktop/mobile.

## Sửa lỗi xác nhận trên production ngày 24/10/2026

Log Vercel xác nhận Prisma `P2010` khi đọc kết quả `void` của `pg_advisory_xact_lock`. Bước xem trước không chạy khóa nên thành công, còn tạo/sửa/hủy lịch có thể lỗi 500.

Đã gom khóa phòng/chuỗi vào `acquireBookingLock`, ép riêng kết quả hàm khóa sang `text` để Prisma đọc được. Khóa vẫn giữ nguyên phạm vi transaction và cơ chế chống trùng lịch.

Bổ sung kiểm thử HTTP với PostgreSQL thật: tạo chuỗi trả 201, trùng lịch trả 409, sửa/hủy trả 200; toàn bộ bản ghi thử được rollback. Kiểm thử hai giao dịch xác nhận khóa vẫn độc quyền và được nhả khi transaction kết thúc. Toàn bộ **143 kiểm thử đạt**, kiểm tra TypeScript API đạt.

Backend đã được triển khai lên production trong deployment `dpl_69Zii1d38pTwqtiGikVqb1nZJ1pg`. Đối chiếu cùng yêu cầu với phòng không tồn tại: trước sửa trả 500 ở câu lệnh khóa, sau sửa trả 409 đúng kiểm tra nghiệp vụ; không tạo bản ghi kiểm thử trên production.
