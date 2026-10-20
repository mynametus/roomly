import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, CircleHelp,
  Clock3, DoorOpen, LayoutDashboard, LogOut, Plus, Search, Settings2, Users, X
} from "lucide-react";
import {
  addDays, addWeeks, format, isSameDay, isToday, startOfWeek, subWeeks
} from "date-fns";
import { vi } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { Booking, BookingInput, Room, User } from "./types";

type AuthResponse = { user: User; token: string };
type View = "overview" | "calendar" | "bookings" | "rooms";
type Notice = { kind: "success" | "error"; text: string };

const today = () => format(new Date(), "yyyy-MM-dd");
const prettyDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("vi-VN", options).format(new Date(date));
const clock = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("roomly-token"));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("overview");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [week, setWeek] = useState(new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      localStorage.removeItem("roomly-token");
      setToken(null);
      setUser(null);
    }
    setNotice({ kind: "error", text: error instanceof Error ? error.message : "Đã xảy ra lỗi." });
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [me, roomData, bookingData] = await Promise.all([
        api<{ user: User }>("/api/auth/me", {}, token),
        api<{ rooms: Room[] }>("/api/rooms", {}, token),
        api<{ bookings: Booking[] }>("/api/bookings", {}, token)
      ]);
      setUser(me.user);
      setRooms(roomData.rooms);
      setBookings(bookingData.bookings);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError, token]);

  useEffect(() => {
    if (token) void refresh();
    else setLoading(false);
  }, [refresh, token]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const upcoming = useMemo(
    () => bookings.filter((booking) => booking.status === "CONFIRMED" && new Date(booking.endTime) >= new Date()),
    [bookings]
  );
  const filteredBookings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === "ALL" || booking.status === statusFilter;
      const matchesSearch = !query || [
        booking.room.name, booking.room.location, booking.user.name, booking.user.email
      ].some((value) => value.toLocaleLowerCase("vi").includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [bookings, search, statusFilter]);

  async function completeLogin(result: AuthResponse) {
    localStorage.setItem("roomly-token", result.token);
    setToken(result.token);
    setUser(result.user);
  }

  function logout() {
    localStorage.removeItem("roomly-token");
    setToken(null);
    setUser(null);
    setRooms([]);
    setBookings([]);
  }

  async function submitBooking(input: BookingInput, recurrenceCount: number) {
    if (!token) return;
    try {
      if (recurrenceCount > 1) {
        await api("/api/bookings/recurring", {
          method: "POST",
          body: JSON.stringify({ ...input, recurrenceCount })
        }, token);
      } else {
        await api("/api/bookings", { method: "POST", body: JSON.stringify(input) }, token);
      }
      setShowBooking(false);
      setNotice({ kind: "success", text: recurrenceCount > 1 ? "Đã đặt lịch định kỳ thành công." : "Đã tạo lượt đặt phòng." });
      await refresh();
    } catch (error) {
      handleError(error);
    }
  }

  async function cancel(booking: Booking, fromHere: boolean) {
    if (!token) return;
    let cancelRemaining = false;
    if (fromHere && booking.series) {
      cancelRemaining = window.confirm(
        "Hủy buổi này và toàn bộ các buổi tiếp theo trong chuỗi? Chọn Hủy để chỉ hủy buổi này."
      );
    } else if (!window.confirm("Bạn có chắc muốn hủy lượt đặt này?")) {
      return;
    }
    try {
      if (cancelRemaining && booking.series) {
        await api(`/api/booking-series/${encodeURIComponent(booking.series.id)}/cancel-from`, {
          method: "POST",
          body: JSON.stringify({ bookingId: booking.id })
        }, token);
      } else {
        await api(`/api/bookings/${encodeURIComponent(booking.id)}`, { method: "DELETE" }, token);
      }
      setNotice({ kind: "success", text: "Đã hủy lượt đặt." });
      await refresh();
    } catch (error) {
      handleError(error);
    }
  }

  async function saveRoom(input: Omit<Room, "id">, roomId?: string) {
    if (!token) return;
    try {
      await api(roomId ? `/api/rooms/${roomId}` : "/api/rooms", {
        method: roomId ? "PATCH" : "POST",
        body: JSON.stringify(input)
      }, token);
      setShowRoomForm(false);
      setEditingRoom(null);
      setNotice({ kind: "success", text: roomId ? "Đã cập nhật phòng họp." : "Đã thêm phòng họp." });
      await refresh();
    } catch (error) {
      handleError(error);
    }
  }

  if (!token) {
    return <LoginScreen onLogin={completeLogin} onError={handleError} />;
  }
  if (!user) return <div className="loading-state"><span className="spinner" /> Đang xác thực phiên đăng nhập…</div>;

  const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "calendar", label: "Lịch phòng", icon: CalendarDays },
    { id: "bookings", label: "Quản lý đặt phòng", icon: Clock3 },
    { id: "rooms", label: "Danh sách phòng", icon: DoorOpen }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setView("overview"); }}>
          <span className="brand-mark"><DoorOpen size={21} /></span>
          <span>roomly<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Điều hướng chính">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
              <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
              {id === "bookings" && <span className="nav-count">{upcoming.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={18} /></div>
            <strong>Cần hỗ trợ?</strong>
            <span>Liên hệ quản trị viên nếu bạn cần giúp đỡ.</span>
          </div>
          <div className="profile">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div className="profile-info"><strong>{user.name}</strong><span>{user.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</span></div>
            <button className="icon-button profile-logout" title="Đăng xuất" onClick={logout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><DoorOpen size={20} /> roomly<span className="brand-dot">.</span></div>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{navigation.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions">
            <span className="today-label">{prettyDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</span>
            <button className="button button-primary button-small" onClick={() => setShowBooking(true)}><Plus size={16} /> Đặt phòng mới</button>
            <button className="avatar avatar-small" title="Đăng xuất" onClick={logout}>{user.name.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <div className="page-content">
          {loading ? <div className="loading-state"><span className="spinner" /> Đang tải dữ liệu…</div> : (
            <>
              {view === "overview" && <Overview rooms={rooms} upcoming={upcoming} onCreate={() => setShowBooking(true)} onNavigate={setView} onCancel={cancel} />}
              {view === "calendar" && <CalendarView bookings={bookings} week={week} rooms={rooms} onWeekChange={setWeek} onCreate={() => setShowBooking(true)} />}
              {view === "bookings" && (
                <BookingsView
                  bookings={filteredBookings}
                  search={search}
                  statusFilter={statusFilter}
                  onSearch={setSearch}
                  onStatus={setStatusFilter}
                  onCancel={cancel}
                  onCreate={() => setShowBooking(true)}
                />
              )}
              {view === "rooms" && <RoomsView rooms={rooms} canManage={user.role === "ADMIN"} onCreate={() => setShowRoomForm(true)} onEdit={setEditingRoom} onUpdate={async (room) => {
                try {
                  await api(`/api/rooms/${room.id}`, { method: "PATCH", body: JSON.stringify({ ...room, status: room.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }, token);
                  setNotice({ kind: "success", text: `Đã ${room.status === "ACTIVE" ? "ngừng sử dụng" : "kích hoạt"} phòng ${room.name}.` });
                  await refresh();
                } catch (error) {
                  handleError(error);
                }
              }} />}
            </>
          )}
        </div>
      </main>

      {notice && <div role="status" className={`toast ${notice.kind}`}><span>{notice.kind === "success" ? <Check size={17} /> : <AlertCircle size={17} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="Đóng"><X size={16} /></button></div>}
      {showBooking && <BookingModal rooms={rooms} onClose={() => setShowBooking(false)} onSubmit={submitBooking} />}
      {showRoomForm && <RoomModal onClose={() => setShowRoomForm(false)} onSubmit={saveRoom} />}
      {editingRoom && <RoomModal room={editingRoom} onClose={() => setEditingRoom(null)} onSubmit={saveRoom} />}
    </div>
  );
}

function LoginScreen({ onLogin, onError }: { onLogin: (data: AuthResponse) => void; onError: (error: unknown) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      setErrorMessage("");
      const result = await api<AuthResponse>(`/api/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      onLogin(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể đăng nhập.");
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-card">
        <a className="brand auth-brand" href="/"><span className="brand-mark"><DoorOpen size={21} /></span><span>roomly<span className="brand-dot">.</span></span></a>
        <div className="eyebrow">KHÔNG GIAN LÀM VIỆC CỦA BẠN</div>
        <h1>{register ? "Tạo tài khoản" : "Chào mừng trở lại"}</h1>
        <p className="muted">{register ? "Đăng ký để bắt đầu đặt phòng họp." : "Đăng nhập để quản lý lịch phòng họp."}</p>
        <form className="form-stack" onSubmit={submit}>
          {register && <label>Họ và tên<input name="name" required minLength={2} maxLength={80} placeholder="Nguyễn Văn An" autoComplete="name" /></label>}
          <label>Email<input name="email" required type="email" placeholder="ban@congty.vn" autoComplete="email" /></label>
          <label>Mật khẩu<input name="password" required type="password" minLength={register ? 8 : 1} placeholder={register ? "Tối thiểu 8 ký tự" : "Nhập mật khẩu"} autoComplete={register ? "new-password" : "current-password"} /></label>
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"} <ArrowRight size={17} /></button>
        </form>
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
        <p className="auth-switch">{register ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <button onClick={() => setRegister((value) => !value)}>{register ? "Đăng nhập" : "Đăng ký"}</button></p>
        <div className="auth-foot">Đặt đúng phòng. Họp đúng giờ.</div>
      </div>
      <div className="auth-aside">
        <div className="aside-decoration deco-one" /><div className="aside-decoration deco-two" />
        <div className="aside-copy"><span className="eyebrow light">ROOMLY · MEETING SPACE</span><h2>Một không gian tốt<br />bắt đầu từ <em>một lịch tốt.</em></h2><p>Đặt chỗ nhanh chóng, xem lịch phòng trực quan và dành thời gian cho điều quan trọng.</p></div>
        <div className="aside-footer"><span>Không gian dành cho ý tưởng lớn.</span><span>01 — 04</span></div>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ rooms, upcoming, onCreate, onNavigate, onCancel }: {
  rooms: Room[]; upcoming: Booking[]; onCreate: () => void; onNavigate: (view: View) => void;
  onCancel: (booking: Booking, fromHere: boolean) => void;
}) {
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE").length;
  const todayBookings = upcoming.filter((booking) => isSameDay(new Date(booking.startTime), new Date()));
  const nextBookings = upcoming.slice(0, 4);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const thisWeek = upcoming.filter((booking) => {
    const start = new Date(booking.startTime);
    return start >= weekStart && start < weekEnd;
  }).length;
  return (
    <>
      <PageHeading eyebrow={`THỨ ${format(new Date(), "EEEE", { locale: vi }).toLocaleUpperCase("vi")} · ${format(new Date(), "dd/MM/yyyy")}`} title="Chào bạn 👋" description="Đây là những gì đang diễn ra trong không gian của bạn hôm nay." action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> Đặt phòng mới</button>} />
      <section className="stats-grid">
        <StatCard icon={<DoorOpen size={19} />} label="Phòng đang hoạt động" value={`${activeRooms}`} sub={`trên tổng ${rooms.length} phòng`} tone="lavender" />
        <StatCard icon={<CalendarDays size={19} />} label="Lịch đặt hôm nay" value={`${todayBookings.length}`} sub="lượt đặt trong ngày" tone="peach" />
        <StatCard icon={<Clock3 size={19} />} label="Lịch sắp tới" value={`${upcoming.length}`} sub="lượt đã xác nhận" tone="mint" />
        <StatCard icon={<Users size={19} />} label="Lượt đặt tuần này" value={`${thisWeek}`} sub="tất cả phòng họp" tone="sky" />
      </section>
      <section className="overview-grid">
        <div className="panel upcoming-panel">
          <div className="panel-heading"><div><h2>Lịch sắp tới</h2><p>Các cuộc họp đã được xác nhận</p></div><button className="text-link" onClick={() => onNavigate("bookings")}>Xem tất cả <ArrowRight size={15} /></button></div>
          {nextBookings.length ? <div className="upcoming-list">{nextBookings.map((booking) => <BookingRow key={booking.id} booking={booking} onCancel={onCancel} />)}</div> : <EmptyState title="Chưa có lịch đặt sắp tới" text="Tạo lịch mới để bắt đầu sử dụng phòng họp." action={<button className="button button-outline button-small" onClick={onCreate}><Plus size={15} /> Đặt phòng</button>} />}
        </div>
        <div className="panel quick-panel">
          <div className="panel-heading"><div><h2>Thao tác nhanh</h2><p>Bắt đầu chỉ với một chạm</p></div><Settings2 size={18} className="muted-icon" /></div>
          <button className="quick-action" onClick={onCreate}><span className="quick-icon lavender"><Plus size={18} /></span><span><strong>Đặt phòng họp</strong><small>Tìm phòng và chọn thời gian</small></span><ArrowRight size={16} /></button>
          <button className="quick-action" onClick={() => onNavigate("calendar")}><span className="quick-icon mint"><CalendarDays size={18} /></span><span><strong>Xem lịch phòng</strong><small>Kiểm tra phòng còn trống</small></span><ArrowRight size={16} /></button>
          <button className="quick-action" onClick={() => onNavigate("rooms")}><span className="quick-icon peach"><DoorOpen size={18} /></span><span><strong>Khám phá phòng</strong><small>{activeRooms} phòng sẵn sàng</small></span><ArrowRight size={16} /></button>
          <div className="tip-box"><span className="tip-symbol">✳</span><span><strong>Mẹo nhỏ</strong> Bạn có thể đặt định kỳ hàng tuần tối đa 8 buổi.</span></div>
        </div>
      </section>
    </>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub: string; tone: string }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-sub">{sub}</span></div>;
}

function BookingRow({ booking, onCancel }: { booking: Booking; onCancel: (booking: Booking, fromHere: boolean) => void }) {
  return (
    <div className="booking-row">
      <div className="date-block"><strong>{format(new Date(booking.startTime), "dd")}</strong><span>{format(new Date(booking.startTime), "MMM", { locale: vi })}</span></div>
      <span className="booking-color" />
      <div className="booking-main"><strong>{booking.room.name}</strong><span>{booking.room.location} · {clock(booking.startTime)}–{clock(booking.endTime)}</span><small>{booking.user.name} · {booking.attendeeCount} người</small></div>
      <div className="booking-end"><span className={`status-pill ${booking.status === "CONFIRMED" ? "confirmed" : "cancelled"}`}>{booking.status === "CONFIRMED" ? "Đã xác nhận" : "Đã hủy"}</span>{booking.status === "CONFIRMED" && <button className="text-link cancel-link" onClick={() => onCancel(booking, Boolean(booking.series))}>Hủy</button>}</div>
    </div>
  );
}

function CalendarView({ bookings, week, rooms, onWeekChange, onCreate }: {
  bookings: Booking[]; week: Date; rooms: Room[]; onWeekChange: (date: Date) => void; onCreate: () => void;
}) {
  const start = startOfWeek(week, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const weekBookings = bookings.filter((booking) =>
    booking.status === "CONFIRMED" && new Date(booking.startTime) >= start && new Date(booking.startTime) < addWeeks(start, 1)
  );
  const roomIds = rooms.filter((room) => room.status === "ACTIVE").map((room) => room.id);
  return (
    <>
      <PageHeading eyebrow="KHÔNG GIAN CỦA BẠN" title="Lịch phòng họp" description="Theo dõi lịch sử dụng phòng theo tuần." action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> Đặt phòng</button>} />
      <div className="panel calendar-panel">
        <div className="calendar-toolbar"><div className="calendar-month">{format(start, "MMMM yyyy", { locale: vi })}</div><div className="calendar-controls"><button className="icon-button" aria-label="Tuần trước" onClick={() => onWeekChange(subWeeks(week, 1))}><ArrowLeft size={17} /></button><button className="button button-outline button-small" onClick={() => onWeekChange(new Date())}>Hôm nay</button><button className="icon-button" aria-label="Tuần sau" onClick={() => onWeekChange(addWeeks(week, 1))}><ArrowRight size={17} /></button></div></div>
        <div className="calendar-grid">
          <div className="calendar-room-head">PHÒNG</div>
          {days.map((day) => <div key={day.toISOString()} className={`calendar-day-head ${isToday(day) ? "today" : ""}`}><span>{format(day, "EEE", { locale: vi })}</span><strong>{format(day, "dd")}</strong></div>)}
          {roomIds.map((roomId) => {
            const room = rooms.find((item) => item.id === roomId)!;
            return <div className="calendar-room-row" key={roomId}><div className="calendar-room-name"><strong>{room.name}</strong><span>{room.capacity} chỗ</span></div>{days.map((day) => {
              const dayBookings = weekBookings.filter((booking) => booking.roomId === roomId && isSameDay(new Date(booking.startTime), day));
              return <div key={day.toISOString()} className={`calendar-cell ${isToday(day) ? "today-cell" : ""}`}>{dayBookings.map((booking) => <div className="calendar-event" key={booking.id} title={`${clock(booking.startTime)}–${clock(booking.endTime)} · ${booking.user.name}`}><strong>{clock(booking.startTime)}–{clock(booking.endTime)}</strong><span>{booking.user.name}</span></div>)}</div>;
            })}</div>;
          })}
        </div>
        <div className="calendar-foot"><span className="legend-dot" /> Đã xác nhận <span className="muted">· Thời gian hiển thị theo múi giờ thiết bị</span></div>
      </div>
    </>
  );
}

function BookingsView({ bookings, search, statusFilter, onSearch, onStatus, onCancel, onCreate }: {
  bookings: Booking[]; search: string; statusFilter: string; onSearch: (value: string) => void;
  onStatus: (value: string) => void; onCancel: (booking: Booking, fromHere: boolean) => void; onCreate: () => void;
}) {
  return (
    <>
      <PageHeading eyebrow="QUẢN LÝ LỊCH" title="Đặt phòng của bạn" description="Tìm kiếm, theo dõi và quản lý các lượt đặt phòng." action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> Đặt phòng mới</button>} />
      <div className="panel table-panel">
        <div className="table-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Tìm phòng hoặc người đặt" placeholder="Tìm phòng, người đặt..." value={search} onChange={(event) => onSearch(event.target.value)} /></div><select aria-label="Lọc trạng thái" value={statusFilter} onChange={(event) => onStatus(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="CONFIRMED">Đã xác nhận</option><option value="CANCELLED">Đã hủy</option></select></div>
        {bookings.length ? <div className="table-wrap"><table><thead><tr><th>PHÒNG HỌP</th><th>NGƯỜI ĐẶT</th><th>NGÀY & GIỜ</th><th>SỐ NGƯỜI</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><strong>{booking.room.name}</strong><small>{booking.room.location}</small></td><td><strong>{booking.user.name}</strong><small>{booking.user.email}</small></td><td><strong>{prettyDate(booking.startTime, { day: "numeric", month: "short", year: "numeric" })}</strong><small>{clock(booking.startTime)} – {clock(booking.endTime)}{booking.series && ` · Định kỳ (${booking.series.recurrenceCount})`}</small></td><td>{booking.attendeeCount} người</td><td><span className={`status-pill ${booking.status === "CONFIRMED" ? "confirmed" : "cancelled"}`}>{booking.status === "CONFIRMED" ? "Đã xác nhận" : "Đã hủy"}</span></td><td>{booking.status === "CONFIRMED" && <button className="table-action" onClick={() => onCancel(booking, Boolean(booking.series))}>Hủy đặt</button>}</td></tr>)}</tbody></table></div> : <EmptyState title="Không tìm thấy lượt đặt" text="Thử thay đổi bộ lọc hoặc tạo một lượt đặt mới." action={<button className="button button-outline button-small" onClick={onCreate}><Plus size={15} /> Đặt phòng</button>} />}
      </div>
    </>
  );
}

function RoomsView({ rooms, canManage, onCreate, onEdit, onUpdate }: {
  rooms: Room[]; canManage: boolean; onCreate: () => void; onEdit: (room: Room) => void; onUpdate: (room: Room) => void;
}) {
  return (
    <>
      <PageHeading eyebrow="KHÔNG GIAN LÀM VIỆC" title="Danh sách phòng" description="Tìm phòng phù hợp cho cuộc họp tiếp theo." action={canManage ? <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Thêm phòng</button> : undefined} />
      <div className="rooms-grid">{rooms.map((room, index) => <article key={room.id} className={`room-card room-art-${index % 3}`}><div className="room-art"><span className="room-art-label">ROOM {String(index + 1).padStart(2, "0")}</span><DoorOpen size={52} strokeWidth={1.2} /><span className="room-art-shape" /></div><div className="room-card-body"><div className="room-card-title"><div><h2>{room.name}</h2><span>{room.location}</span></div><span className={`room-status ${room.status === "ACTIVE" ? "active" : "inactive"}`}><i />{room.status === "ACTIVE" ? "Sẵn sàng" : "Tạm ngưng"}</span></div><div className="room-features"><span><Users size={16} /> Tối đa {room.capacity} người</span><span><CalendarDays size={16} /> Đặt theo giờ</span></div><div className="room-card-foot"><span>Phòng họp · {room.location}</span>{canManage && <div className="room-admin-actions"><button className="table-action" onClick={() => onEdit(room)}>Chỉnh sửa</button><button className="table-action" onClick={() => onUpdate(room)}>{room.status === "ACTIVE" ? "Ngừng sử dụng" : "Kích hoạt"}</button></div>}</div></div></article>)}</div>
      {!rooms.length && <div className="panel"><EmptyState title="Chưa có phòng nào" text="Thêm phòng họp đầu tiên vào hệ thống." action={<button className="button button-primary button-small" onClick={onCreate}><Plus size={15} /> Thêm phòng</button>} /></div>}
    </>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><CalendarDays size={21} /></span><strong>{title}</strong><p>{text}</p>{action}</div>;
}

function BookingModal({ rooms, onClose, onSubmit }: {
  rooms: Room[]; onClose: () => void; onSubmit: (input: BookingInput, recurrence: number) => void;
}) {
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE");
  const [recurrence, setRecurrence] = useState("1");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startTime = new Date(String(form.get("date")) + "T" + String(form.get("start"))).toISOString();
    const endTime = new Date(String(form.get("date")) + "T" + String(form.get("end"))).toISOString();
    setBusy(true);
    await onSubmit({
      roomId: String(form.get("roomId")),
      startTime,
      endTime,
      attendeeCount: Number(form.get("attendeeCount"))
    }, Number(recurrence));
    setBusy(false);
  }
  return <Modal title="Đặt phòng họp" subtitle="Điền thông tin để giữ chỗ cho cuộc họp." onClose={onClose}><form className="form-stack" onSubmit={submit}>
    <label>Phòng họp<select name="roomId" required defaultValue=""><option value="" disabled>Chọn phòng</option>{activeRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.location} · {room.capacity} chỗ</option>)}</select></label>
    <label>Ngày họp<input name="date" type="date" required min={today()} defaultValue={today()} /></label>
    <div className="form-row"><label>Giờ bắt đầu<input name="start" type="time" required defaultValue="09:00" /></label><label>Giờ kết thúc<input name="end" type="time" required defaultValue="10:00" /></label></div>
    <div className="form-row"><label>Số người tham dự<input name="attendeeCount" type="number" required min="1" max="500" defaultValue="4" /></label><label>Hình thức đặt<select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="1">Một lần</option><option value="2">2 buổi hàng tuần</option><option value="3">3 buổi hàng tuần</option><option value="4">4 buổi hàng tuần</option><option value="5">5 buổi hàng tuần</option><option value="6">6 buổi hàng tuần</option><option value="7">7 buổi hàng tuần</option><option value="8">8 buổi hàng tuần</option></select></label></div>
    <p className="form-hint"><Clock3 size={14} /> Tối đa 4 giờ/ngày cho mỗi người. Thời gian theo múi giờ thiết bị.</p>
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Hủy</button><button className="button button-primary" disabled={busy || activeRooms.length === 0}>{busy ? "Đang lưu…" : "Xác nhận đặt phòng"} <ArrowRight size={16} /></button></div>
  </form></Modal>;
}

function RoomModal({ room, onClose, onSubmit }: {
  room?: Room; onClose: () => void; onSubmit: (room: Omit<Room, "id">, roomId?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    await onSubmit({
      name: String(form.get("name")),
      location: String(form.get("location")),
      capacity: Number(form.get("capacity")),
      status: room?.status ?? "ACTIVE"
    }, room?.id);
    setBusy(false);
  }
  return <Modal title={room ? "Cập nhật phòng họp" : "Thêm phòng họp"} subtitle={room ? "Chỉnh sửa thông tin của phòng." : "Bổ sung không gian mới vào danh sách."} onClose={onClose}><form className="form-stack" onSubmit={submit}>
    <label>Tên phòng<input name="name" required minLength={2} maxLength={80} placeholder="Ví dụ: Orchid" defaultValue={room?.name} /></label>
    <label>Vị trí<input name="location" required maxLength={120} placeholder="Ví dụ: Tầng 2" defaultValue={room?.location} /></label>
    <label>Sức chứa<input name="capacity" type="number" required min="1" max="500" placeholder="Số người tối đa" defaultValue={room?.capacity} /></label>
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Hủy</button><button className="button button-primary" disabled={busy}>{busy ? "Đang lưu…" : room ? "Lưu thay đổi" : "Thêm phòng"} <ArrowRight size={16} /></button></div>
  </form></Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="modal-card"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Đóng" onClick={onClose}><X size={19} /></button></div>{children}</section></div>;
}
