import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "vi" | "ko";

const ko: Record<string, string> = {
  "Chào mừng trở lại": "다시 오신 것을 환영합니다",
  "Đăng nhập bằng tài khoản do quản trị viên công ty cấp.": "회사 관리자가 발급한 계정으로 로그인하세요.",
  "Mật khẩu": "비밀번호", "Nhập mật khẩu": "비밀번호를 입력하세요", "Đăng nhập": "로그인",
   "Chưa có tài khoản? Liên hệ quản trị viên công ty để được cấp.": "계정이 없으신가요? 회사 관리자에게 문의하세요.",
  "BẢO MẬT TÀI KHOẢN": "계정 보안", "Đổi mật khẩu để tiếp tục": "계속하려면 비밀번호를 변경하세요",
  "Mật khẩu hiện tại": "현재 비밀번호", "Mật khẩu mới": "새 비밀번호", "Xác nhận mật khẩu mới": "새 비밀번호 확인",
  "Đổi mật khẩu": "비밀번호 변경", "Đang cập nhật…": "업데이트 중…",
  "Chọn mật khẩu mới dài ít nhất 8 ký tự và không dùng chung với mật khẩu ở nơi khác.": "8자 이상의 새 비밀번호를 설정하고 다른 서비스와 같은 비밀번호는 사용하지 마세요.",
  "Đang xác thực phiên đăng nhập…": "로그인 세션 확인 중…", "Đang tải dữ liệu…": "데이터를 불러오는 중…",
  "QUẢN LÝ TÀI KHOẢN": "계정 관리", "QUẢN LÝ LỊCH": "예약 관리", "LỊCH ĐẶT PHÒNG": "회의실 예약",
  "Tổng quan": "대시보드", "Tìm phòng trống": "빈 회의실 찾기", "Lịch phòng": "회의실 일정",
  "Quản lý đặt phòng": "예약 관리", "Lịch đặt phòng": "예약 일정", "Đặt phòng của tôi": "내 예약",
  "Quản lý phòng": "회의실 관리", "Danh sách phòng": "회의실 목록", "Quản lý tài khoản": "계정 관리", "Báo cáo sử dụng": "이용 보고서",
  "Quản trị viên": "관리자", "Thành viên": "구성원", "Đăng xuất": "로그아웃", "Cần hỗ trợ?": "도움이 필요하신가요?",
  "Nhấn để kết bạn Zalo với quản trị viên.": "Zalo에서 관리자에게 친구 요청을 보내세요.", "Liên hệ hỗ trợ qua Zalo": "Zalo 고객 지원",
  "Kết bạn để được quản trị viên hỗ trợ.": "친구를 추가하여 관리자에게 지원을 요청하세요.",
  "Gửi lời mời kết bạn tới Zalo của quản trị viên:": "관리자 Zalo 계정으로 친구 요청을 보내세요:", "Mở Zalo và kết bạn": "Zalo 열고 친구 추가",
  "Đặt phòng mới": "회의실 예약", "Workspace": "워크스페이스", "Điều hướng chính": "주 메뉴", 
  "Chào bạn 👋": "안녕하세요 👋", 
  "PHÒNG ĐANG HOẠT ĐỘNG": "사용 가능한 회의실", "trên tổng": "전체", "phòng": "개 회의실",
  "LỊCH ĐẶT HÔM NAY": "오늘의 예약", "lượt đặt trong ngày": "건 예약", "LỊCH SẮP TỚI": "다가오는 예약",
  "lượt đã xác nhận": "건 확정됨", "LƯỢT ĐẶT TUẦN NÀY": "이번 주 예약", "tất cả phòng họp": "전체 회의실",
  "Lịch sắp tới": "다가오는 예약", "Các cuộc họp đã được xác nhận": "확정된 회의", "Xem tất cả": "모두 보기",
   
  "Thao tác nhanh": "빠른 작업", "Bắt đầu chỉ với một chạm": "한 번의 클릭으로 시작하세요", "Đặt phòng họp": "회의실 예약",
  "Tìm phòng và chọn thời gian": "회의실과 시간을 선택하세요", "Xem lịch phòng": "회의실 일정 보기", "Kiểm tra phòng còn trống": "사용 가능한 회의실 확인",
   "phòng sẵn sàng": "개 사용 가능", "Mẹo nhỏ": "팁",
  "Bạn có thể đặt lịch họp lặp lại hàng ngày, hàng tuần hoặc hàng tháng.": "회의를 매일, 매주 또는 매월 반복 예약할 수 있습니다.",
  "Lịch phòng họp": "회의실 일정", 
  "Hôm nay": "오늘", "Tuần trước": "이전 주", "Tuần sau": "다음 주", "PHÒNG": "회의실",
   "Đã hủy": "취소됨", "ĐÃ HỦY": "취소됨", "NGƯỜI ĐẶT": "예약자",
  "SỐ NGƯỜI": "참석 인원", "NGÀY & GIỜ": "날짜 및 시간", "PHÒNG HỌP": "회의실", "THAO TÁC": "작업",
  "LƯỢT ĐẶT": "예약 수", "TRẠNG THÁI": "상태", "Tất cả trạng thái": "모든 상태", "Đang xác nhận": "확정됨",
  "Tìm phòng hoặc người đặt": "회의실 또는 예약자 검색", "Tìm phòng, người đặt...": "회의실 또는 예약자 검색...",
  "Tìm kiếm, theo dõi và quản lý lượt đặt phòng của tất cả người dùng.": "모든 사용자의 회의실 예약을 검색하고 관리합니다.",
  "Xem lịch đặt phòng của mọi người. Bạn có thể tạo lịch mới, chỉnh sửa và hủy lịch của chính mình.": "모든 사용자의 예약 일정을 볼 수 있습니다. 본인의 예약은 생성, 수정 또는 취소할 수 있습니다.",
  "Đặt phòng": "예약", "Đặt phòng này": "이 회의실 예약", "Không tìm thấy lượt đặt": "예약을 찾을 수 없습니다",
   "Chỉnh sửa": "수정", "Hủy đặt": "예약 취소", "Hủy": "취소",
  "Đang tải tài khoản…": "계정을 불러오는 중…", 
  "Danh sách tài khoản": "계정 목록", "Danh sách người dùng": "사용자 목록", "BỘ PHẬN LÀM VIỆC": "부서",
  "Bộ phận làm việc": "부서", "Sửa bộ phận": "부서 수정", "EMAIL": "이메일", "Email": "이메일", "TÊN": "이름",
  "VAI TRÒ": "역할", "TÀI KHOẢN": "계정", "MẬT KHẨU": "비밀번호", "MẬT KHẨU BAN ĐẦU": "초기 비밀번호",
  "Khóa": "계정 정지", "Mở khóa": "계정 활성화", "Đặt lại": "재설정",  "Thêm hàng loạt": "일괄 추가",
  "Thêm tài khoản hàng loạt": "계정 일괄 추가", "Nhập mỗi người dùng trên một dòng, tối đa 50 tài khoản.": "한 줄에 사용자 한 명씩 입력하세요. 한 번에 최대 50명까지 추가할 수 있습니다.",
  "Tên, email, bộ phận làm việc": "이름, 이메일, 부서", "Nguyễn Văn An, an@congty.vn, Kế toán": "홍길동, hong@example.kr, 회계팀",
  "Trần Thị Bình, binh@congty.vn, Nhân sự": "김민수, kim@example.kr, 인사팀", "Định dạng danh sách": "입력 형식",
  "Tất cả tài khoản do admin tạo có mật khẩu ban đầu": "관리자가 만든 모든 계정의 초기 비밀번호는 다음과 같습니다",
  "Mật khẩu ban đầu là 12345678; người dùng sẽ phải đổi sau khi đăng nhập.": "초기 비밀번호는 12345678이며 로그인 후 변경해야 합니다.",
  "Hãy gửi mật khẩu này cho người dùng qua kênh riêng tư. Không sử dụng mật khẩu mặc định cho tài khoản quản trị viên.": "이 비밀번호는 사용자에게 비공개로 전달하세요. 관리자 계정에는 기본 비밀번호를 사용하지 마세요.",
  "Sao chép": "복사", "Sao chép danh sách": "목록 복사", "Xem báo cáo": "보고서 보기", "Chi tiết theo phòng": "회의실별 세부 정보",
  "GIỜ SỬ DỤNG": "사용 시간", "TỶ LỆ SỬ DỤNG": "이용률", "Tỷ lệ sử dụng = giờ đặt đã xác nhận / tổng giờ lịch phòng đang hoạt động.": "이용률 = 확정 예약 시간 / 운영 중인 회의실의 전체 시간.",
  "Ghi chú": "메모", "Ghi chú (không bắt buộc)": "메모 (선택 사항)", "Tên phòng": "회의실 이름", "Vị trí": "위치", "Sức chứa": "수용 인원",
  "Tiện nghi": "편의 시설", "Tiện nghi cần có": "필요한 편의 시설", "Chưa khai báo tiện nghi.": "등록된 편의 시설이 없습니다.",
  "Phân cách từng tiện nghi bằng dấu phẩy.": "편의 시설은 쉼표로 구분하세요.", "Thêm phòng": "회의실 추가", "Tối đa 2.000 ký tự. Có thể để trống.": "최대 2,000자까지 입력할 수 있으며 비워 둘 수 있습니다.",
  "Chọn phòng": "회의실 선택", "Phòng họp": "회의실", "Số người tham dự": "참석 인원", "Giờ bắt đầu": "시작 시간", "Giờ kết thúc": "종료 시간",
  "Lịch họp lặp lại": "반복 회의", "Chọn thứ trong tuần": "요일 선택", "Cách lặp hàng tháng": "월간 반복 방식", "Theo ngày trong tháng": "매월 같은 날짜",
  "Theo thứ và tuần trong tháng": "매월 같은 주와 요일", "Ngày trong tháng": "날짜", "Tháng không có ngày đã chọn (ví dụ ngày 31) sẽ được bỏ qua.": "선택한 날짜가 없는 달(예: 31일)은 건너뜁니다.",
       "Tuần trong tháng": "주차", "Thứ": "요일",
  "Kết thúc lặp lại": "반복 종료", "Đến ngày": "날짜까지", "Sau số buổi họp": "반복 횟수", "Ngày kết thúc": "종료 날짜", "Số buổi họp": "회의 횟수",
  "Mỗi chuỗi có tối đa 200 buổi trong 6 tháng tính từ ngày bắt đầu.": "반복 예약은 시작일로부터 6개월 동안 최대 200회까지 가능합니다.",
  "Phạm vi chỉnh sửa": "수정 범위", "Phạm vi hủy": "취소 범위", "Buổi đang chọn": "선택한 회의", "Ngày bắt đầu": "시작 날짜",
  "Với nhiều buổi, ngày họp được giữ nguyên; phòng, giờ và số người được áp dụng cho các buổi đã chọn.": "여러 회의를 수정할 때 날짜는 유지되며 선택한 회의에 회의실, 시간 및 참석 인원이 적용됩니다.",
  "Không giới hạn số giờ đặt trong ngày. Thời gian hiển thị theo múi giờ thiết bị.": "하루 예약 시간에는 제한이 없습니다. 시간은 기기의 시간대를 기준으로 표시됩니다.",
  "Xem trước và kiểm tra": "미리보기 및 확인", "Xem trước": "미리보기", "Sửa cấu hình": "설정 수정", "Kiểm tra lại": "다시 확인",
  "Có thay đổi chưa kiểm tra. Nhấn “Kiểm tra lại” trước khi xác nhận.": "확인되지 않은 변경 사항이 있습니다. 확정하기 전에 다시 확인하세요.",
  "Bỏ qua các ngày bị trùng": "시간이 겹치는 날짜 건너뛰기", "Bỏ qua": "건너뛰기", "Đổi phòng/giờ": "회의실/시간 변경",
  "Phòng cho ngày này": "이 날짜의 회의실",  "Kết thúc": "종료", "Áp dụng cho ngày này": "이 날짜에 적용",
  "Đã bỏ qua": "건너뜀", "Phòng còn trống": "예약 가능", "Còn trống": "예약 가능",
  "Lịch được kiểm tra lại khi xác nhận. Nếu có xung đột, không có buổi nào được lưu.": "확정 시 일정을 다시 확인합니다. 시간이 겹치면 예약이 저장되지 않습니다.",
  "Bạn muốn hủy lượt đặt phòng này?": "이 회의실 예약을 취소하시겠습니까?", "Lịch đã hủy vẫn được giữ trong lịch sử.": "취소된 예약은 기록에 보관됩니다.",
  "Xác nhận hủy": "취소 확인",  "Quay lại": "뒤로", "Một lần": "한 번", "Hàng ngày": "매일", "Hàng tuần": "매주", "Hàng tháng": "매월",
  "Đã xác nhận": "확정", "Hợp lệ": "예약 가능", "Xung đột": "시간 중복", "bỏ qua": "건너뜀", "hợp lệ ·": "예약 가능 ·", "xung đột ·": "시간 중복 ·",
  "Tối đa": "최대", "Tìm phòng": "회의실 검색", "Từ ngày": "시작일", "Bắt đầu": "시작", 
  "Hiển thị": "표시", "trong": "중", "Trang": "페이지", "Trước": "이전", "Tiếp": "다음", "buổi ·": "회 ·", "người": "명", "giờ": "시간", "chỗ": "석",
  "Mã bảo mật": "보안 코드", "Xác nhận đặt phòng": "예약 확정",   "Đang xử lý…": "처리 중…",
  "Đặt đúng phòng. Họp đúng giờ.": "회의실은 정확하게, 회의는 정시에.", "Không gian dành cho ý tưởng lớn.": "더 큰 아이디어를 위한 공간.",
  "Đặt chỗ nhanh chóng, xem lịch phòng trực quan và dành thời gian cho điều quan trọng.": "간편하게 예약하고 일정을 확인하여 중요한 일에 집중하세요.", "Một không gian tốt": "좋은 공간은", "bắt đầu từ": "시작됩니다",
  "một lịch tốt.": "좋은 일정에서.", "Bảo vệ tài khoản": "계정 보호", "bằng": "으로", "mật khẩu riêng.": "나만의 비밀번호를 설정하세요.",
  "Chỉ mất một phút để bắt đầu.": "시작하는 데 1분이면 충분합니다.", "ROOMLY · BẢO MẬT": "MYUNGBO CABLE · 계정 보안", "ROOMLY · MEETING SPACE": "MYUNGBO CABLE · 회의 공간",
  "Chưa có lịch đặt sắp tới": "다가오는 예약이 없습니다", "Tạo lịch mới để bắt đầu sử dụng phòng họp.": "회의실을 예약하여 시작하세요.", "Khám phá phòng": "회의실 둘러보기",
  "Đã tạo": "생성됨", "người dùng trên một dòng": "한 줄에 한 명씩", "Đóng": "닫기", "Lọc trạng thái": "상태 필터",
  "Lịch đặt hôm nay": "오늘의 예약", "Lượt đặt tuần này": "이번 주 예약", "Phòng đang hoạt động": "사용 가능한 회의실",
  "Đây là những gì đang diễn ra trong không gian của bạn hôm nay.": "오늘의 회의실 이용 현황입니다.", "Theo dõi lịch sử dụng phòng theo tuần.": "주간 회의실 이용 일정을 확인하세요.",
  "Tìm phòng còn trống": "빈 회의실 찾기", "TÌM KIẾM THÔNG MINH": "스마트 검색", "KHÔNG GIAN CỦA BẠN": "내 워크스페이스",
  "KHÔNG GIAN LÀM VIỆC": "워크스페이스", "QUẢN TRỊ HỆ THỐNG": "시스템 관리", "Báo cáo sử dụng phòng": "회의실 이용 보고서", "PHÂN TÍCH VẬN HÀNH": "운영 분석",
  "Chọn thời gian và tiện nghi cần có để tìm phòng phù hợp.": "시간과 필요한 편의 시설을 선택하여 회의실을 검색하세요.", "Tìm phòng phù hợp cho cuộc họp tiếp theo.": "다음 회의에 적합한 회의실을 찾아보세요.",
  "Theo dõi số lượt đặt, giờ sử dụng và tỷ lệ khai thác theo phòng.": "회의실별 예약 횟수, 이용 시간 및 이용률을 확인하세요.", "Tài khoản người dùng": "사용자 계정",
  "Tìm, khóa/mở tài khoản, đặt lại mật khẩu hoặc tạo thành viên mới.": "계정을 검색하고 활성화 또는 정지하거나 비밀번호를 재설정하고 구성원을 추가합니다.",
  "Tìm tên, email hoặc bộ phận": "이름, 이메일 또는 부서 검색", "Tìm tên, email hoặc bộ phận...": "이름, 이메일 또는 부서 검색...",
  "Không có tài khoản phù hợp.": "일치하는 계정이 없습니다.", "Không tìm thấy tài khoản": "계정을 찾을 수 없습니다", "Không thể tải tài khoản.": "계정을 불러올 수 없습니다.",
  "Vui lòng nhập bộ phận làm việc.": "부서를 입력하세요.", "Không thể cập nhật bộ phận làm việc.": "부서를 업데이트할 수 없습니다.", "Cập nhật bộ phận làm việc": "부서 수정",
  "Cập nhật phòng họp": "회의실 수정", "Chỉnh sửa thông tin của phòng.": "회의실 정보를 수정합니다.", "Bổ sung không gian mới vào danh sách.": "회의실 목록에 새 공간을 추가합니다.",
  "Chưa có phòng nào": "회의실이 없습니다", "Chưa có phòng để thống kê": "보고할 회의실이 없습니다", "Chưa tìm thấy phòng phù hợp": "조건에 맞는 회의실이 없습니다", "Không có phòng phù hợp": "조건에 맞는 회의실이 없습니다",
  "Thêm phòng họp đầu tiên vào hệ thống.": "첫 회의실을 추가하세요.", "Vui lòng liên hệ quản trị viên để bổ sung phòng họp.": "회의실 추가를 위해 관리자에게 문의하세요.", "Thêm phòng để xem báo cáo sử dụng.": "회의실을 추가하면 이용 보고서를 볼 수 있습니다.",
  "Thử giảm số người hoặc bỏ bớt tiện nghi cần có.": "참석 인원을 줄이거나 필요한 편의 시설을 줄여 보세요.", "Thử thay đổi bộ lọc hoặc tạo một lượt đặt mới.": "필터를 바꾸거나 새 예약을 만들어 보세요.", "Thử tìm bằng tên, email hoặc bộ phận khác.": "다른 이름, 이메일 또는 부서로 검색해 보세요.",
  "Hoạt động": "사용 중",    "Sẵn sàng": "사용 가능", 
  "Chưa cập nhật": "미등록", "Chưa cập nhật bộ phận": "부서 미등록", "Màn hình": "모니터", "Máy chiếu": "프로젝터", "Bảng trắng": "화이트보드", "Họp trực tuyến": "화상 회의", "Loa và micro": "스피커 및 마이크", "Cổng HDMI": "HDMI 포트",
  "Ví dụ: Orchid": "예: Orchid", "Ví dụ: Tầng 2": "예: 2층", "Số người tối đa": "최대 인원", "Máy chiếu, Màn hình, Bảng trắng": "프로젝터, 모니터, 화이트보드", "Ví dụ: Liên hệ lễ tân để lấy chìa khóa; sắp xếp lại bàn ghế sau khi sử dụng.": "예: 열쇠는 안내 데스크에 문의하고 사용 후 책상과 의자를 정리해 주세요.",
  "Chỉ buổi này": "이 회의만", "Buổi này và các buổi sau": "이 회의와 이후 회의", "Toàn bộ chuỗi": "전체 반복 일정", "Chỉnh sửa lịch đặt phòng": "예약 수정", "Hủy lịch đặt phòng": "예약 취소",
  "Chọn phạm vi thay đổi và kiểm tra lại phòng trước khi lưu.": "변경 범위를 선택하고 저장하기 전에 회의실을 다시 확인하세요.", "Chọn lịch họp và kiểm tra tất cả các buổi trước khi xác nhận.": "회의 일정을 선택하고 확정 전에 모든 회의를 확인하세요.", "Chọn ít nhất một thứ trong tuần.": "요일을 하나 이상 선택하세요.",
  "Không thể kiểm tra lịch họp.": "일정을 확인할 수 없습니다.", "Không thể lưu lịch họp.": "일정을 저장할 수 없습니다.", "Không thể hủy lịch.": "예약을 취소할 수 없습니다.", "Giờ điều chỉnh chưa hợp lệ.": "변경한 시간이 올바르지 않습니다.",
  "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.": "종료 날짜는 시작 날짜와 같거나 이후여야 합니다.", "Chủ nhật": "일요일", "Không thể đăng nhập.": "로그인할 수 없습니다.", "Không thể đổi mật khẩu.": "비밀번호를 변경할 수 없습니다.",
  "Mật khẩu mới và xác nhận mật khẩu không khớp.": "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.", "Vui lòng đăng nhập lại.": "다시 로그인하세요.", "Đã xảy ra lỗi.": "오류가 발생했습니다.",
  "Không thể sao chép tự động. Hãy chọn mật khẩu đang hiển thị để sao chép.": "자동으로 복사할 수 없습니다. 표시된 비밀번호를 선택하여 복사하세요.", "Không thể sao chép tự động. Hãy chọn và sao chép nội dung trong bảng.": "자동으로 복사할 수 없습니다. 표의 내용을 선택하여 복사하세요.", "Đã sao chép danh sách mật khẩu.": "비밀번호 목록을 복사했습니다.",
  "Mỗi lần có thể tạo tối đa 50 tài khoản.": "한 번에 최대 50개의 계정을 만들 수 있습니다.", "Nhập ít nhất một dòng theo định dạng: Tên, email, bộ phận làm việc.": "이름, 이메일, 부서 형식으로 한 줄 이상 입력하세요.", "Có dòng chưa hợp lệ. Mỗi dòng cần có tên (2–80 ký tự), email hợp lệ và bộ phận làm việc (1–120 ký tự), phân cách bằng dấu phẩy.": "일부 입력이 올바르지 않습니다. 각 줄에 이름(2~80자), 유효한 이메일, 부서(1~120자)를 쉼표로 구분하여 입력하세요.", "Danh sách có email bị lặp. Hãy bỏ email trùng trước khi tạo.": "중복된 이메일이 있습니다. 중복 항목을 제거한 후 다시 만드세요.",
  "Đã cập nhật lịch đặt phòng.": "예약을 수정했습니다.", "Đã tạo chuỗi lịch họp.": "반복 일정을 만들었습니다.", "Đã tạo lượt đặt phòng.": "회의실을 예약했습니다.", "Đã hủy lịch theo phạm vi đã chọn.": "선택한 범위의 예약을 취소했습니다.", "Đã cập nhật phòng họp.": "회의실 정보를 수정했습니다.", "Đã thêm phòng họp.": "회의실을 추가했습니다.", "Đổi mật khẩu thành công.": "비밀번호를 변경했습니다.", "Đã khóa": "정지됨", "Đã kích hoạt": "활성화됨",
  "Đang tìm…": "검색 중…", "Đang tải…": "불러오는 중…", "Đang lưu…": "저장 중…", "Đang hủy…": "취소 중…", "Đang kiểm tra…": "확인 중…", "Đang tạo tài khoản…": "계정 생성 중…", "Lưu thay đổi": "변경 사항 저장", "Tạo tài khoản": "계정 만들기",
  "Lượt đặt đã xác nhận": "확정된 예약", "Tổng giờ sử dụng": "총 이용 시간", "trong khoảng thời gian": "선택 기간", "trên tổng giờ phòng hoạt động": "운영 시간 대비", "Đầu tiên": "첫째", "Thứ hai": "둘째", "Thứ ba": "셋째", "Thứ tư": "넷째", "Cuối cùng": "마지막",
  "KHÔNG GIAN LÀM VIỆC CỦA BẠN": "나의 워크스페이스", "MYUNGBO CABLE · BẢO MẬT": "MYUNGBO CABLE · 계정 보안",
  "Mật khẩu mặc định ban đầu": "기본 비밀번호", "Tài khoản mới luôn có quyền thành viên, không thể tự cấp quyền quản trị.": "새 계정은 구성원 권한으로 생성되며 관리자 권한을 직접 부여할 수 없습니다.",
  "Thời gian bắt đầu": "시작 시간", "Thời gian kết thúc": "종료 시간", "Lặp lại mỗi (": "반복 간격 (", "Số người": "참석 인원",
  "Cần đổi": "변경 필요",  "tài khoản": "계정", "lịch": "예약 일정", "Đã đặt lại mật khẩu cho": "비밀번호를 재설정했습니다:",
  "Đang đăng nhập với tài khoản": "로그인 계정", "Xin chào": "안녕하세요", "Phòng họp ·": "회의실 ·",
  ". Người dùng bắt buộc phải đổi mật khẩu ngay lần đầu đăng nhập.": ". 사용자는 첫 로그인 시 비밀번호를 변경해야 합니다.",
  ". Vì bạn đang sử dụng mật khẩu mặc định, hãy tạo mật khẩu mới trước khi sử dụng Roomly.": ". 기본 비밀번호를 사용 중입니다. Roomly를 이용하기 전에 새 비밀번호를 설정하세요.",
  "· Mật khẩu chỉ hiển thị lần này; người dùng phải đổi sau khi đăng nhập.": "· 비밀번호는 이번에만 표시됩니다. 로그인 후 변경해야 합니다.", "· Thời gian hiển thị theo múi giờ thiết bị": "· 기기의 시간대를 기준으로 표시됩니다.",
  "T2": "월", "T3": "화", "T4": "수", "T5": "목", "T6": "금", "T7": "토", "CN": "일", "ngày": "일", "tuần": "주", "tháng": "개월",
  "Đặt theo giờ": "시간별 예약", "Phòng họp · ": "회의실 · ", "ROOM ": "회의실 ", "Ví dụ: Kế toán": "예: 회계팀",
  "Đang hoạt động": "사용 중", "Tạm ngưng": "중지됨", "Ngừng sử dụng": "사용 중지", "Kích hoạt": "활성화", "Đã thiết lập": "설정됨",
  "Phòng đã ngừng hoạt động.": "사용이 중지된 회의실입니다.", 
  "Giờ kết thúc phải sau giờ bắt đầu.": "종료 시간은 시작 시간보다 늦어야 합니다.", "Một lượt đặt phải bắt đầu và kết thúc trong cùng một ngày.": "예약 시작과 종료는 같은 날짜여야 합니다.",
  "Phòng đã có lịch trong khoảng thời gian này.": "해당 시간에 이미 회의실 예약이 있습니다.", "Không tìm thấy lượt đặt.": "예약을 찾을 수 없습니다.", "Bạn không có quyền quản lý lượt đặt này.": "이 예약을 관리할 권한이 없습니다.",
  "Lượt đặt này đã được hủy.": "취소된 예약입니다.", "Có buổi họp chưa hợp lệ. Không có thay đổi nào được lưu.": "유효하지 않은 회의가 있습니다. 변경 사항은 저장되지 않았습니다.",
  "Phòng không tồn tại hoặc đang ngừng hoạt động.": "회의실이 없거나 사용이 중지되었습니다.", "Không tìm thấy phòng để đặt.": "예약할 회의실을 찾을 수 없습니다.",
  "Ngày kết thúc phải sau ngày bắt đầu.": "종료 시간은 시작 시간보다 늦어야 합니다.", "Bạn cần đổi mật khẩu trước khi tiếp tục.": "계속하려면 비밀번호를 변경하세요.",
  "Tên phòng (tiếng Hàn, không bắt buộc)": "회의실 이름 (한국어, 선택 사항)",
  "Ví dụ: 오키드 회의실": "예: 오키드 회의실"
};

let activeLanguage: Language = "vi";
export function getLanguage(): Language { return activeLanguage; }
export function translate(text: string, language: Language = activeLanguage): string {
  const key = text.replace(/\s+/g, " ").trim();
  if (language !== "ko") return key;
  const dynamic: [RegExp, (...match: string[]) => string][] = [
    [/^trên tổng (\d+) phòng$/, (_match, count) => `전체 ${count}개 회의실`],
    [/^Tìm thấy (\d+) phòng phù hợp$/, (_match, count) => `조건에 맞는 회의실 ${count}개를 찾았습니다`],
    [/^Đã tạo (\d+) tài khoản người dùng\.$/, (_match, count) => `사용자 계정 ${count}개를 만들었습니다.`],
    [/^(.+) · (\d+) buổi$/, (_match, frequency, count) => `${ko[frequency] ?? frequency} · ${count}회`],
    [/^\d+ phòng phù hợp$/, (match) => match.replace("phòng phù hợp", "개의 회의실이 조건에 맞습니다")]
  ];
  for (const [pattern, render] of dynamic) {
    const match = key.match(pattern);
    if (match) return render(...match);
  }
  return ko[key] ?? key;
}

type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (text: string) => string };
const defaultValue: I18nValue = { language: "vi", setLanguage: () => {}, t: (text) => translate(text, "vi") };
const I18nContext = createContext<I18nValue>(defaultValue);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem("roomly-language");
    activeLanguage = saved === "ko" ? "ko" : "vi";
    return activeLanguage;
  });
  const setLanguage = (next: Language) => {
    activeLanguage = next;
    if (typeof window !== "undefined") window.localStorage.setItem("roomly-language", next);
    setLanguageState(next);
  };
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "ko" ? "명보 케이블 — 회의실 예약" : "Myungbo Cable — Quản lý phòng họp";
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => translate(text, language) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }

export function RoomName({ room }: { room: { name: string; nameKo?: string | null } }) {
  const { language } = useI18n();
  return <>{language === "ko" && room.nameKo?.trim() ? room.nameKo : room.name}</>;
}

export function T({ children }: { children: string }) {
  const { t } = useI18n();
  const leading = /^\s/.test(children);
  const trailing = /\s$/.test(children);
  const value = t(children);
  return <>{leading ? " " : ""}{value}{trailing ? " " : ""}</>;
}

export function LanguageSelector() {
  const { language, setLanguage } = useI18n();
  return <label className="language-control"><span className="sr-only">언어 / Ngôn ngữ</span><select className="language-selector" aria-label="언어 / Ngôn ngữ" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="vi">Tiếng Việt</option><option value="ko">한국어</option></select></label>;
}
