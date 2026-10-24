import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, CircleHelp, MessageCircle,
  Clock3, Copy, DoorOpen, LayoutDashboard, LogOut, Plus, Search, Settings2, ShieldCheck, Users,
  UserPlus, X, CalendarSearch, ChartNoAxesCombined, UserRoundCog, RotateCcw, Ban, CheckCircle2
} from "lucide-react";
import {
  addDays, addWeeks, format, isSameDay, isToday, startOfWeek, subWeeks
} from "date-fns";
import { vi } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { Booking, BookingInput, Room, User } from "./types";

type AuthResponse = { user: User; token: string };
type View = "overview" | "availability" | "calendar" | "bookings" | "rooms" | "users" | "reports";
type Notice = { kind: "success" | "error"; text: string };
type CreatedAccount = { name: string; email: string; department: string };
type AvailableRoomSearch = { startTime: string; endTime: string; attendeeCount: number; amenities: string[] };
type AccountRecord = Pick<User, "id" | "name" | "email" | "department" | "role" | "isActive" | "mustChangePassword"> & { createdAt: string };

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
  const [bookingDefaults, setBookingDefaults] = useState<Partial<BookingInput>>();
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showZaloContact, setShowZaloContact] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[]>([]);
  const [week, setWeek] = useState(new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const isAdmin = user?.role === "ADMIN";

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
      const me = await api<{ user: User }>("/api/auth/me", {}, token);
      setUser(me.user);
      if (me.user.mustChangePassword) {
        setRooms([]);
        setBookings([]);
        return;
      }
      const [roomData, bookingData] = await Promise.all([
        api<{ rooms: Room[] }>("/api/rooms", {}, token),
        api<{ bookings: Booking[] }>("/api/bookings", {}, token)
      ]);
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

  const visibleBookings = useMemo(
    () => isAdmin ? bookings : bookings.filter((booking) => booking.userId === user?.id),
    [bookings, isAdmin, user?.id]
  );
  const upcoming = useMemo(
    () => visibleBookings.filter((booking) => booking.status === "CONFIRMED" && new Date(booking.endTime) >= new Date()),
    [visibleBookings]
  );
  const filteredBookings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return visibleBookings.filter((booking) => {
      const matchesStatus = statusFilter === "ALL" || booking.status === statusFilter;
      const matchesSearch = !query || [
        booking.room.name, booking.room.location, booking.user.name, booking.user.email
      ].some((value) => value.toLocaleLowerCase("vi").includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [visibleBookings, search, statusFilter]);

  async function completeLogin(result: AuthResponse) {
    localStorage.setItem("roomly-token", result.token);
    setToken(result.token);
    setUser(result.user);
    setView("overview");
    setRooms([]);
    setBookings([]);
  }

  function logout() {
    localStorage.removeItem("roomly-token");
    setToken(null);
    setUser(null);
    setRooms([]);
    setBookings([]);
    setCreatedAccounts([]);
    setView("overview");
    setShowBooking(false);
    setShowRoomForm(false);
    setEditingRoom(null);
    setSearch("");
    setStatusFilter("ALL");
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
    if (!token || !isAdmin) return;
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

  async function createUsers(users: CreatedAccount[]) {
    if (!token) return false;
    setCreatedAccounts([]);
    try {
      const result = await api<{ created: CreatedAccount[] }>("/api/users/bulk", {
        method: "POST",
        body: JSON.stringify({ users })
      }, token);
      setCreatedAccounts(result.created);
      setNotice({ kind: "success", text: `Đã tạo ${result.created.length} tài khoản người dùng.` });
      return true;
    } catch (error) {
      handleError(error);
      return false;
    }
  }

  function openBooking(defaults?: Partial<BookingInput>) {
    setBookingDefaults(defaults);
    setShowBooking(true);
  }

  async function searchAvailableRooms(input: AvailableRoomSearch) {
    if (!token) return [];
    const query = new URLSearchParams({
      startTime: input.startTime,
      endTime: input.endTime,
      attendeeCount: String(input.attendeeCount)
    });
    input.amenities.forEach((amenity) => query.append("amenities", amenity));
    const result = await api<{ rooms: Room[] }>(`/api/rooms/available?${query.toString()}`, {}, token);
    return result.rooms;
  }

  async function updateAccountStatus(account: AccountRecord, isActive: boolean) {
    if (!token) return false;
    try {
      await api(`/api/users/${encodeURIComponent(account.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive })
      }, token);
      setNotice({ kind: "success", text: `${isActive ? "Đã kích hoạt" : "Đã khóa"} tài khoản ${account.email}.` });
      return true;
    } catch (error) {
      handleError(error);
      return false;
    }
  }

  async function resetAccountPassword(account: AccountRecord) {
    if (!token) return null;
    try {
      return await api<{ temporaryPassword: string }>(`/api/users/${encodeURIComponent(account.id)}/reset-password`, {
        method: "POST"
      }, token);
    } catch (error) {
      handleError(error);
      return null;
    }
  }

  function navigate(nextView: View) {
    if (nextView !== "users") setCreatedAccounts([]);
    setView(nextView);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api<AuthResponse>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
      }, token);
      localStorage.setItem("roomly-token", result.token);
      setToken(result.token);
      setUser(result.user);
      const [roomData, bookingData] = await Promise.all([
        api<{ rooms: Room[] }>("/api/rooms", {}, result.token),
        api<{ bookings: Booking[] }>("/api/bookings", {}, result.token)
      ]);
      setRooms(roomData.rooms);
      setBookings(bookingData.bookings);
      setNotice({ kind: "success", text: "Đổi mật khẩu thành công." });
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <LoginScreen onLogin={completeLogin} onError={handleError} />;
  }
  if (user?.mustChangePassword) {
    return <ChangePasswordScreen user={user} onSubmit={changePassword} />;
  }
  if (!user) return <div className="loading-state"><span className="spinner" /> Đang xác thực phiên đăng nhập…</div>;

  const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "availability", label: "Tìm phòng trống", icon: CalendarSearch },
    { id: "calendar", label: "Lịch phòng", icon: CalendarDays },
    { id: "bookings", label: isAdmin ? "Quản lý đặt phòng" : "Đặt phòng của tôi", icon: Clock3 },
    { id: "rooms", label: isAdmin ? "Quản lý phòng" : "Danh sách phòng", icon: DoorOpen },
    ...(isAdmin ? [
      { id: "users" as const, label: "Quản lý tài khoản", icon: UserRoundCog },
      { id: "reports" as const, label: "Báo cáo sử dụng", icon: ChartNoAxesCombined }
    ] : [])
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate("overview"); }}>
          <span className="brand-mark"><DoorOpen size={21} /></span>
          <span>roomly<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Điều hướng chính">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
              {id === "bookings" && <span className="nav-count">{upcoming.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" className="help-card" onClick={() => setShowZaloContact(true)}>
            <span className="help-icon"><CircleHelp size={18} /></span>
            <strong>Cần hỗ trợ?</strong>
            <span>Nhấn để kết bạn Zalo với quản trị viên.</span>
          </button>
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
            <button className="button button-primary button-small" onClick={() => openBooking()}><Plus size={16} /> Đặt phòng mới</button>
            <button className="avatar avatar-small" title="Đăng xuất" onClick={logout}>{user.name.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <div className="page-content">
          {loading ? <div className="loading-state"><span className="spinner" /> Đang tải dữ liệu…</div> : (
            <>
              {view === "overview" && <Overview rooms={rooms} upcoming={upcoming} onCreate={() => openBooking()} onNavigate={navigate} onCancel={cancel} />}
              {view === "availability" && <AvailabilityView
                onSearch={searchAvailableRooms}
                amenities={Array.from(new Set([...roomAmenityOptions, ...rooms.flatMap((room) => room.amenities)]))}
                onBook={(room, input) => openBooking({ roomId: room.id, startTime: input.startTime, endTime: input.endTime, attendeeCount: input.attendeeCount })}
                onError={handleError}
              />}
              {view === "calendar" && <CalendarView bookings={visibleBookings} week={week} rooms={rooms} onWeekChange={setWeek} onCreate={() => openBooking()} />}
              {view === "bookings" && (
                <BookingsView
                  bookings={filteredBookings}
                  canManageAll={isAdmin}
                  search={search}
                  statusFilter={statusFilter}
                  onSearch={setSearch}
                  onStatus={setStatusFilter}
                  onCancel={cancel}
                  onCreate={() => openBooking()}
                />
              )}
              {view === "rooms" && <RoomsView rooms={rooms} canManage={isAdmin} onCreate={() => setShowRoomForm(true)} onEdit={setEditingRoom} onUpdate={async (room) => {
                if (!isAdmin) return;
                try {
                  await api(`/api/rooms/${room.id}`, { method: "PATCH", body: JSON.stringify({ ...room, status: room.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }, token);
                  setNotice({ kind: "success", text: `Đã ${room.status === "ACTIVE" ? "ngừng sử dụng" : "kích hoạt"} phòng ${room.name}.` });
                  await refresh();
                } catch (error) {
                  handleError(error);
                }
              }} />}
              {view === "users" && user.role === "ADMIN" && <UsersView
                createdAccounts={createdAccounts}
                onCreate={createUsers}
                onClearCredentials={() => setCreatedAccounts([])}
                token={token}
                currentUserId={user.id}
                onUpdateStatus={updateAccountStatus}
                onResetPassword={resetAccountPassword}
              />}
              {view === "reports" && user.role === "ADMIN" && <ReportsView token={token} onError={handleError} />}
            </>
          )}
        </div>
      </main>

      {notice && <div role="status" className={`toast ${notice.kind}`}><span>{notice.kind === "success" ? <Check size={17} /> : <AlertCircle size={17} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="Đóng"><X size={16} /></button></div>}
      {showBooking && <BookingModal rooms={rooms} initialValues={bookingDefaults} onClose={() => setShowBooking(false)} onSubmit={submitBooking} />}
      {showRoomForm && isAdmin && <RoomModal onClose={() => setShowRoomForm(false)} onSubmit={saveRoom} />}
      {editingRoom && isAdmin && <RoomModal room={editingRoom} onClose={() => setEditingRoom(null)} onSubmit={saveRoom} />}
      {showZaloContact && <Modal title="Liên hệ hỗ trợ qua Zalo" subtitle="Kết bạn để được quản trị viên hỗ trợ." onClose={() => setShowZaloContact(false)}>
        <div className="zalo-contact">
          <span className="zalo-contact-icon"><MessageCircle size={25} /></span>
          <p>Gửi lời mời kết bạn tới Zalo của quản trị viên:</p>
          <strong className="zalo-phone">0855 799 066</strong>
          <a className="button button-primary button-wide" href="https://zalo.me/0855799066" target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> Mở Zalo và kết bạn
          </a>
        </div>
      </Modal>}
    </div>
  );
}

function LoginScreen({ onLogin, onError }: { onLogin: (data: AuthResponse) => void; onError: (error: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      setErrorMessage("");
      const result = await api<AuthResponse>("/api/auth/login", {
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
        <h1>Chào mừng trở lại</h1>
        <p className="muted">Đăng nhập bằng tài khoản do quản trị viên công ty cấp.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Email<input name="email" required type="email" placeholder="ban@congty.vn" autoComplete="email" /></label>
          <label>Mật khẩu<input name="password" required type="password" minLength={1} placeholder="Nhập mật khẩu" autoComplete="current-password" /></label>
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "Đang xử lý…" : "Đăng nhập"} <ArrowRight size={17} /></button>
        </form>
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
        <p className="auth-switch">Chưa có tài khoản? Liên hệ quản trị viên công ty để được cấp.</p>
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

function ChangePasswordScreen({ user, onSubmit }: {
  user: User;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmPassword")) {
      setErrorMessage("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(currentPassword, newPassword);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể đổi mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <a className="brand auth-brand" href="/"><span className="brand-mark"><DoorOpen size={21} /></span><span>roomly<span className="brand-dot">.</span></span></a>
        <div className="eyebrow">BẢO MẬT TÀI KHOẢN</div>
        <h1>Đổi mật khẩu để tiếp tục</h1>
        <p className="muted">Xin chào {user.name}. Vì bạn đang sử dụng mật khẩu mặc định, hãy tạo mật khẩu mới trước khi sử dụng Roomly.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Mật khẩu hiện tại<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
          <label>Mật khẩu mới<input name="newPassword" type="password" required minLength={8} maxLength={100} autoComplete="new-password" /></label>
          <label>Xác nhận mật khẩu mới<input name="confirmPassword" type="password" required minLength={8} maxLength={100} autoComplete="new-password" /></label>
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "Đang cập nhật…" : "Đổi mật khẩu"} <ArrowRight size={17} /></button>
        </form>
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
        <p className="auth-switch">Đang đăng nhập với tài khoản <strong>{user.email}</strong></p>
      </div>
      <div className="auth-aside">
        <div className="aside-decoration deco-one" /><div className="aside-decoration deco-two" />
        <div className="aside-copy"><span className="eyebrow light">ROOMLY · BẢO MẬT</span><h2>Bảo vệ tài khoản<br />bằng <em>mật khẩu riêng.</em></h2><p>Chọn mật khẩu mới dài ít nhất 8 ký tự và không dùng chung với mật khẩu ở nơi khác.</p></div>
        <div className="aside-footer"><span>Chỉ mất một phút để bắt đầu.</span><span>01 — 04</span></div>
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

export function BookingsView({ bookings, canManageAll, search, statusFilter, onSearch, onStatus, onCancel, onCreate }: {
  bookings: Booking[]; canManageAll: boolean; search: string; statusFilter: string; onSearch: (value: string) => void;
  onStatus: (value: string) => void; onCancel: (booking: Booking, fromHere: boolean) => void; onCreate: () => void;
}) {
  return (
    <>
      <PageHeading eyebrow="QUẢN LÝ LỊCH" title={canManageAll ? "Quản lý đặt phòng" : "Đặt phòng của tôi"} description={canManageAll ? "Tìm kiếm, theo dõi và quản lý lượt đặt phòng của tất cả người dùng." : "Tìm kiếm, theo dõi và quản lý các lượt đặt phòng của chính bạn."} action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> Đặt phòng mới</button>} />
      <div className="panel table-panel">
        <div className="table-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Tìm phòng hoặc người đặt" placeholder="Tìm phòng, người đặt..." value={search} onChange={(event) => onSearch(event.target.value)} /></div><select aria-label="Lọc trạng thái" value={statusFilter} onChange={(event) => onStatus(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="CONFIRMED">Đã xác nhận</option><option value="CANCELLED">Đã hủy</option></select></div>
        {bookings.length ? <div className="table-wrap"><table><thead><tr><th>PHÒNG HỌP</th><th>NGƯỜI ĐẶT</th><th>NGÀY & GIỜ</th><th>SỐ NGƯỜI</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><strong>{booking.room.name}</strong><small>{booking.room.location}</small></td><td><strong>{booking.user.name}</strong><small>{booking.user.email}</small></td><td><strong>{prettyDate(booking.startTime, { day: "numeric", month: "short", year: "numeric" })}</strong><small>{clock(booking.startTime)} – {clock(booking.endTime)}{booking.series && ` · Định kỳ (${booking.series.recurrenceCount})`}</small></td><td>{booking.attendeeCount} người</td><td><span className={`status-pill ${booking.status === "CONFIRMED" ? "confirmed" : "cancelled"}`}>{booking.status === "CONFIRMED" ? "Đã xác nhận" : "Đã hủy"}</span></td><td>{booking.status === "CONFIRMED" && <button className="table-action" onClick={() => onCancel(booking, Boolean(booking.series))}>Hủy đặt</button>}</td></tr>)}</tbody></table></div> : <EmptyState title="Không tìm thấy lượt đặt" text="Thử thay đổi bộ lọc hoặc tạo một lượt đặt mới." action={<button className="button button-outline button-small" onClick={onCreate}><Plus size={15} /> Đặt phòng</button>} />}
      </div>
    </>
  );
}

const roomAmenityOptions = [
  "Máy chiếu", "Màn hình", "Bảng trắng", "Họp trực tuyến", "Loa và micro", "Cổng HDMI"
];

function AvailabilityView({ onSearch, amenities, onBook, onError }: {
  onSearch: (input: AvailableRoomSearch) => Promise<Room[]>;
  amenities: string[];
  onBook: (room: Room, input: AvailableRoomSearch) => void;
  onError: (error: unknown) => void;
}) {
  const [results, setResults] = useState<Room[] | null>(null);
  const [query, setQuery] = useState<AvailableRoomSearch | null>(null);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startTime = new Date(String(form.get("startTime"))).toISOString();
    const endTime = new Date(String(form.get("endTime"))).toISOString();
    const input = {
      startTime,
      endTime,
      attendeeCount: Number(form.get("attendeeCount")),
      amenities: selectedAmenities
    };
    setBusy(true);
    try {
      setQuery(input);
      setResults(await onSearch(input));
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  function toggleAmenity(amenity: string) {
    setSelectedAmenities((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity]
    );
  }

  return (
    <>
      <PageHeading eyebrow="TÌM KIẾM THÔNG MINH" title="Tìm phòng còn trống" description="Chọn thời gian và tiện nghi cần có để tìm phòng phù hợp." />
      <section className="panel availability-panel">
        <form className="availability-form" onSubmit={submit}>
          <label>Thời gian bắt đầu<input name="startTime" type="datetime-local" required defaultValue={`${today()}T09:00`} /></label>
          <label>Thời gian kết thúc<input name="endTime" type="datetime-local" required defaultValue={`${today()}T10:00`} /></label>
          <label>Số người<input name="attendeeCount" type="number" min="1" max="500" required defaultValue="4" /></label>
          <button className="button button-primary" disabled={busy}>{busy ? "Đang tìm…" : <><Search size={16} /> Tìm phòng</>}</button>
          <fieldset className="amenity-filter">
            <legend>Tiện nghi cần có</legend>
            {amenities.map((amenity) => <label key={amenity}>
              <input type="checkbox" checked={selectedAmenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />
              <span>{amenity}</span>
            </label>)}
          </fieldset>
        </form>
      </section>
      {results !== null && <section className="availability-results">
        <div className="section-title"><h2>{results.length ? `Tìm thấy ${results.length} phòng phù hợp` : "Không có phòng phù hợp"}</h2>
          {query && <p>{prettyDate(query.startTime, { day: "numeric", month: "long" })} · {clock(query.startTime)}–{clock(query.endTime)} · {query.attendeeCount} người</p>}
        </div>
        {results.length ? <div className="rooms-grid">{results.map((room, index) => <article className={`room-card room-art-${index % 3}`} key={room.id}>
          <div className="room-art"><span className="room-art-label">ROOM {String(index + 1).padStart(2, "0")}</span><DoorOpen size={52} strokeWidth={1.2} /><span className="room-art-shape" /></div>
          <div className="room-card-body"><div className="room-card-title"><div><h2>{room.name}</h2><span>{room.location}</span></div><span className="room-status active"><i />Còn trống</span></div>
            <div className="room-features"><span><Users size={16} /> Tối đa {room.capacity} người</span></div>
            <AmenityBadges amenities={room.amenities} />
            <button className="button button-primary button-wide" onClick={() => query && onBook(room, query)}><Plus size={16} /> Đặt phòng này</button>
          </div>
        </article>)}</div> : <div className="panel"><EmptyState title="Chưa tìm thấy phòng phù hợp" text="Thử giảm số người hoặc bỏ bớt tiện nghi cần có." /></div>}
      </section>}
    </>
  );
}

function AmenityBadges({ amenities }: { amenities: string[] }) {
  if (!amenities.length) return <p className="amenity-empty">Chưa khai báo tiện nghi.</p>;
  return <div className="amenity-badges">{amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div>;
}

export function RoomsView({ rooms, canManage, onCreate, onEdit, onUpdate }: {
  rooms: Room[]; canManage: boolean; onCreate: () => void; onEdit: (room: Room) => void; onUpdate: (room: Room) => void;
}) {
  return (
    <>
      <PageHeading eyebrow="KHÔNG GIAN LÀM VIỆC" title="Danh sách phòng" description="Tìm phòng phù hợp cho cuộc họp tiếp theo." action={canManage ? <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Thêm phòng</button> : undefined} />
      <div className="rooms-grid">{rooms.map((room, index) => <article key={room.id} className={`room-card room-art-${index % 3}`}><div className="room-art"><span className="room-art-label">ROOM {String(index + 1).padStart(2, "0")}</span><DoorOpen size={52} strokeWidth={1.2} /><span className="room-art-shape" /></div><div className="room-card-body"><div className="room-card-title"><div><h2>{room.name}</h2><span>{room.location}</span></div><span className={`room-status ${room.status === "ACTIVE" ? "active" : "inactive"}`}><i />{room.status === "ACTIVE" ? "Sẵn sàng" : "Tạm ngưng"}</span></div><div className="room-features"><span><Users size={16} /> Tối đa {room.capacity} người</span><span><CalendarDays size={16} /> Đặt theo giờ</span></div><AmenityBadges amenities={room.amenities} /><div className="room-card-foot"><span>Phòng họp · {room.location}</span>{canManage && <div className="room-admin-actions"><button className="table-action" onClick={() => onEdit(room)}>Chỉnh sửa</button><button className="table-action" onClick={() => onUpdate(room)}>{room.status === "ACTIVE" ? "Ngừng sử dụng" : "Kích hoạt"}</button></div>}</div></div></article>)}</div>
      {!rooms.length && <div className="panel"><EmptyState title="Chưa có phòng nào" text={canManage ? "Thêm phòng họp đầu tiên vào hệ thống." : "Vui lòng liên hệ quản trị viên để bổ sung phòng họp."} action={canManage ? <button className="button button-primary button-small" onClick={onCreate}><Plus size={15} /> Thêm phòng</button> : undefined} /></div>}
    </>
  );
}

function UsersView({ createdAccounts, onCreate, onClearCredentials, token, currentUserId, onUpdateStatus, onResetPassword }: {
  createdAccounts: CreatedAccount[];
  onCreate: (users: CreatedAccount[]) => Promise<boolean>;
  onClearCredentials: () => void;
  token: string;
  currentUserId: string;
  onUpdateStatus: (account: AccountRecord, isActive: boolean) => Promise<boolean>;
  onResetPassword: (account: AccountRecord) => Promise<{ temporaryPassword: string } | null>;
}) {
  const [tab, setTab] = useState<"accounts" | "create">("accounts");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountRevision, setAccountRevision] = useState(0);
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null);
  const [department, setDepartment] = useState("");
  const [departmentBusy, setDepartmentBusy] = useState(false);
  const [departmentError, setDepartmentError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [resetResult, setResetResult] = useState<{ name: string; email: string; password: string } | null>(null);

  useEffect(() => {
    if (tab !== "accounts") return;
    let cancelled = false;
    setAccountBusy(true);
    setAccountError("");
    const params = new URLSearchParams();
    if (accountSearch.trim()) params.set("search", accountSearch.trim());
    api<{ users: AccountRecord[] }>(`/api/users?${params.toString()}`, {}, token)
      .then((result) => { if (!cancelled) setAccounts(result.users); })
      .catch((requestError: unknown) => {
        if (!cancelled) setAccountError(requestError instanceof Error ? requestError.message : "Không thể tải tài khoản.");
      })
      .finally(() => { if (!cancelled) setAccountBusy(false); });
    return () => { cancelled = true; };
  }, [accountSearch, tab, token, accountRevision]);

  async function saveDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAccount) return;
    setDepartmentError("");
    if (!department.trim()) {
      setDepartmentError("Vui lòng nhập bộ phận làm việc.");
      return;
    }
    setDepartmentBusy(true);
    try {
      await api(`/api/users/${encodeURIComponent(editingAccount.id)}/department`, {
        method: "PATCH",
        body: JSON.stringify({ department: department.trim() })
      }, token);
      setEditingAccount(null);
      setAccountRevision((current) => current + 1);
      setAccountMessage(`Đã cập nhật bộ phận làm việc cho ${editingAccount.name}.`);
    } catch (requestError) {
      setDepartmentError(requestError instanceof Error ? requestError.message : "Không thể cập nhật bộ phận làm việc.");
    } finally {
      setDepartmentBusy(false);
    }
  }

  async function toggleAccount(account: AccountRecord) {
    const action = account.isActive ? "khóa" : "mở khóa";
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản ${account.email}?`)) return;
    if (await onUpdateStatus(account, !account.isActive)) {
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, isActive: !item.isActive } : item));
    }
  }

  async function resetPassword(account: AccountRecord) {
    if (!window.confirm(`Đặt lại mật khẩu cho ${account.email}? Người dùng sẽ phải đổi mật khẩu sau lần đăng nhập tiếp theo.`)) return;
    const result = await onResetPassword(account);
    if (result) {
      setResetResult({ name: account.name, email: account.email, password: result.temporaryPassword });
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, mustChangePassword: true } : item));
    }
  }

  async function copyResetPassword() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
    } catch {
      setAccountError("Không thể sao chép tự động. Hãy chọn mật khẩu đang hiển thị để sao chép.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rows = lines.filter((line, index) =>
      !(index === 0 && /^(name|tên)\s*,\s*(e-?mail)\s*,\s*(department|bộ phận|bộ phận làm việc)$/i.test(line))
    );
    if (!rows.length) {
      setError("Nhập ít nhất một dòng theo định dạng: Tên, email, bộ phận làm việc.");
      return;
    }
    if (rows.length > 50) {
      setError("Mỗi lần có thể tạo tối đa 50 tài khoản.");
      return;
    }
    const users = rows.map((line) => {
      const columns = line.split(",").map((value) => value.trim());
      if (columns.length !== 3) return null;
      const [name, rawEmail, department] = columns;
      const email = rawEmail.toLowerCase();
      if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !department || department.length > 120) return null;
      return { name, email, department };
    });
    if (users.some((user) => user === null)) {
      setError("Có dòng chưa hợp lệ. Mỗi dòng cần có tên (2–80 ký tự), email hợp lệ và bộ phận làm việc (1–120 ký tự), phân cách bằng dấu phẩy.");
      return;
    }
    const validUsers = users.filter((user): user is CreatedAccount => user !== null);
    const emailSet = new Set(validUsers.map((user) => user.email));
    if (emailSet.size !== validUsers.length) {
      setError("Danh sách có email bị lặp. Hãy bỏ email trùng trước khi tạo.");
      return;
    }
    setBusy(true);
    if (await onCreate(validUsers)) {
      setInput("");
      setCopyMessage("");
    }
    setBusy(false);
  }

  async function copyCredentials() {
    const csv = [
      "Tên,Email,Bộ phận làm việc,Mật khẩu ban đầu",
      ...createdAccounts.map(({ name, email, department }) =>
        [name, email, department, "12345678"].map((value) => `"${value.replaceAll('"', '""')}"`).join(",")
      )
    ].join("\n");
    try {
      await navigator.clipboard.writeText(csv);
      setCopyMessage("Đã sao chép danh sách mật khẩu.");
    } catch {
      setCopyMessage("Không thể sao chép tự động. Hãy chọn và sao chép nội dung trong bảng.");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Tài khoản người dùng"
        description="Tìm, khóa/mở tài khoản, đặt lại mật khẩu hoặc tạo thành viên mới."
      />
      <div className="admin-tabs" role="tablist" aria-label="Quản lý tài khoản">
        <button role="tab" aria-selected={tab === "accounts"} className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}><Users size={16} /> Danh sách tài khoản</button>
        <button role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><UserPlus size={16} /> Thêm hàng loạt</button>
      </div>
      {tab === "accounts" && <>
        <section className="panel table-panel admin-accounts">
          <div className="table-toolbar">
            <div className="search-field"><Search size={17} /><input aria-label="Tìm tên, email hoặc bộ phận" placeholder="Tìm tên, email hoặc bộ phận..." value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></div>
            <span className="account-count">{accounts.length} tài khoản</span>
          </div>
          {accountError && <p className="form-error account-error" role="alert">{accountError}</p>}
          {accountMessage && <p className="copy-message" role="status">{accountMessage}</p>}
          {accountBusy ? <div className="loading-state"><span className="spinner" /> Đang tải tài khoản…</div> :
            <div className="table-wrap"><table><thead><tr><th>TÀI KHOẢN</th><th>BỘ PHẬN LÀM VIỆC</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>MẬT KHẨU</th><th>THAO TÁC</th></tr></thead><tbody>
              {accounts.map((account) => <tr key={account.id}>
                <td><strong>{account.name}</strong><small>{account.email}</small></td>
                <td>{account.department || "Chưa cập nhật"}</td>
                <td>{account.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</td>
                <td><span className={`status-pill ${account.isActive ? "confirmed" : "cancelled"}`}>{account.isActive ? "Đang hoạt động" : "Đã khóa"}</span></td>
                <td>{account.mustChangePassword ? <span className="password-change-required">Cần đổi</span> : "Đã thiết lập"}</td>
                <td><div className="account-actions">
                  <button className="table-action" onClick={() => { setEditingAccount(account); setDepartment(account.department ?? ""); setDepartmentError(""); setAccountMessage(""); }}>Sửa bộ phận</button>
                  <button className="table-action" onClick={() => void resetPassword(account)}><RotateCcw size={14} /> Đặt lại</button>
                  <button className="table-action" disabled={account.id === currentUserId} onClick={() => void toggleAccount(account)}>
                    {account.isActive ? <><Ban size={14} /> Khóa</> : <><CheckCircle2 size={14} /> Mở khóa</>}
                  </button>
                </div></td>
              </tr>)}
            </tbody></table></div>}
          {!accountBusy && accounts.length === 0 && <EmptyState title="Không tìm thấy tài khoản" text="Thử tìm bằng tên, email hoặc bộ phận khác." />}
        </section>
        {resetResult && <section className="panel reset-password-result">
          <div><strong>Đã đặt lại mật khẩu cho {resetResult.name}</strong><p>{resetResult.email} · Mật khẩu chỉ hiển thị lần này; người dùng phải đổi sau khi đăng nhập.</p></div>
          <code>{resetResult.password}</code>
          <button className="button button-outline button-small" onClick={() => void copyResetPassword()}><Copy size={14} /> Sao chép</button>
          <button className="icon-button" aria-label="Ẩn mật khẩu" onClick={() => setResetResult(null)}><X size={16} /></button>
        </section>}
      </>}
      {tab === "create" && <>
      <div className="users-admin-grid">
        <section className="panel users-import-panel">
          <div className="panel-heading">
            <div><h2>Thêm tài khoản hàng loạt</h2><p>Nhập mỗi người dùng trên một dòng, tối đa 50 tài khoản.</p></div>
            <span className="quick-icon lavender"><UserPlus size={18} /></span>
          </div>
          <div className="import-example">
            <strong>Định dạng danh sách</strong>
            <code>Tên, email, bộ phận làm việc</code>
            <code>Nguyễn Văn An, an@congty.vn, Kế toán</code>
            <code>Trần Thị Bình, binh@congty.vn, Nhân sự</code>
          </div>
          <form className="form-stack" onSubmit={submit}>
            <label>Danh sách người dùng
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={"Tên, email, bộ phận làm việc\nNguyễn Văn An, an@congty.vn, Kế toán\nTrần Thị Bình, binh@congty.vn, Nhân sự"}
                rows={9}
                maxLength={15000}
                required
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="form-hint"><ShieldCheck size={16} /> Tài khoản mới luôn có quyền thành viên, không thể tự cấp quyền quản trị.</p>
            <button className="button button-primary" disabled={busy}>
              <UserPlus size={16} /> {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
            </button>
          </form>
        </section>
        <aside className="panel users-security-panel">
          <span className="users-security-icon"><ShieldCheck size={24} /></span>
          <h2>Mật khẩu mặc định ban đầu</h2>
          <p>Tất cả tài khoản do admin tạo có mật khẩu ban đầu <code>12345678</code>. Người dùng bắt buộc phải đổi mật khẩu ngay lần đầu đăng nhập.</p>
          <p>Hãy gửi mật khẩu này cho người dùng qua kênh riêng tư. Không sử dụng mật khẩu mặc định cho tài khoản quản trị viên.</p>
        </aside>
      </div>
      {createdAccounts.length > 0 && (
        <section className="panel credentials-panel">
          <div className="panel-heading">
            <div><h2>Đã tạo {createdAccounts.length} tài khoản</h2><p>Mật khẩu ban đầu là 12345678; người dùng sẽ phải đổi sau khi đăng nhập.</p></div>
            <div className="credentials-actions">
              <button className="button button-outline button-small" onClick={() => void copyCredentials()}><Copy size={15} /> Sao chép danh sách</button>
              <button className="icon-button" aria-label="Ẩn mật khẩu" onClick={onClearCredentials}><X size={17} /></button>
            </div>
          </div>
          <div className="table-wrap"><table><thead><tr><th>TÊN</th><th>EMAIL</th><th>BỘ PHẬN LÀM VIỆC</th><th>MẬT KHẨU BAN ĐẦU</th></tr></thead><tbody>{createdAccounts.map((account) => <tr key={account.email}><td><strong>{account.name}</strong></td><td>{account.email}</td><td>{account.department}</td><td><code className="temporary-password">12345678</code></td></tr>)}</tbody></table></div>
          {copyMessage && <p className="copy-message" role="status">{copyMessage}</p>}
        </section>
      )}
      </>}
      {editingAccount && <Modal title="Cập nhật bộ phận làm việc" subtitle={`${editingAccount.name} · ${editingAccount.email}`} onClose={() => { if (!departmentBusy) setEditingAccount(null); }}>
        <form className="form-stack" onSubmit={saveDepartment}>
          <label>Bộ phận làm việc<input value={department} onChange={(event) => setDepartment(event.target.value)} required maxLength={120} placeholder="Ví dụ: Kế toán" autoFocus disabled={departmentBusy} /></label>
          {departmentError && <p className="form-error" role="alert">{departmentError}</p>}
          <div className="modal-actions"><button type="button" className="button button-outline" disabled={departmentBusy} onClick={() => setEditingAccount(null)}>Hủy</button><button className="button button-primary" disabled={departmentBusy}>{departmentBusy ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
        </form>
      </Modal>}
    </>
  );
}

type RoomReport = {
  range: { from: string; to: string };
  summary: {
    activeRoomCount: number;
    totalBookings: number;
    totalCancelled: number;
    bookedHours: number;
    utilizationPercent: number;
  };
  rooms: {
    room: Pick<Room, "id" | "name" | "location" | "status">;
    bookingCount: number;
    cancelledCount: number;
    bookedHours: number;
    utilizationPercent: number;
  }[];
};

function ReportsView({ token, onError }: { token: string; onError: (error: unknown) => void }) {
  const now = new Date();
  const [from, setFrom] = useState(format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<RoomReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadReport(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!from || !to || to < from) {
      onError(new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu."));
      return;
    }
    const rangeStart = new Date(`${from}T00:00:00`);
    const rangeEnd = addDays(new Date(`${to}T00:00:00`), 1);
    const query = new URLSearchParams({ from: rangeStart.toISOString(), to: rangeEnd.toISOString() });
    setBusy(true);
    try {
      setReport(await api<RoomReport>(`/api/reports/rooms?${query.toString()}`, {}, token));
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadReport(); }, []);

  return <>
    <PageHeading eyebrow="PHÂN TÍCH VẬN HÀNH" title="Báo cáo sử dụng phòng" description="Theo dõi số lượt đặt, giờ sử dụng và tỷ lệ khai thác theo phòng." />
    <form className="panel report-filters" onSubmit={(event) => void loadReport(event)}>
      <label>Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
      <label>Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
      <button className="button button-primary" disabled={busy}>{busy ? "Đang tải…" : <><Search size={16} /> Xem báo cáo</>}</button>
    </form>
    {report && <>
      <section className="stats-grid report-stats">
        <StatCard icon={<DoorOpen size={19} />} label="Phòng đang hoạt động" value={String(report.summary.activeRoomCount)} sub="được tính trong công suất" tone="lavender" />
        <StatCard icon={<CalendarDays size={19} />} label="Lượt đặt đã xác nhận" value={String(report.summary.totalBookings)} sub="trong khoảng thời gian" tone="peach" />
        <StatCard icon={<Clock3 size={19} />} label="Tổng giờ sử dụng" value={`${report.summary.bookedHours} giờ`} sub={`${report.summary.totalCancelled} lượt đã hủy`} tone="mint" />
        <StatCard icon={<ChartNoAxesCombined size={19} />} label="Tỷ lệ sử dụng" value={`${report.summary.utilizationPercent}%`} sub="trên tổng giờ phòng hoạt động" tone="sky" />
      </section>
      <section className="panel table-panel report-table">
        <div className="panel-heading"><div><h2>Chi tiết theo phòng</h2><p>Tỷ lệ sử dụng = giờ đặt đã xác nhận / tổng giờ lịch phòng đang hoạt động.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>PHÒNG</th><th>TRẠNG THÁI</th><th>LƯỢT ĐẶT</th><th>GIỜ SỬ DỤNG</th><th>ĐÃ HỦY</th><th>TỶ LỆ SỬ DỤNG</th></tr></thead><tbody>
          {report.rooms.map((item) => <tr key={item.room.id}>
            <td><strong>{item.room.name}</strong><small>{item.room.location}</small></td>
            <td>{item.room.status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}</td>
            <td>{item.bookingCount}</td><td>{item.bookedHours} giờ</td><td>{item.cancelledCount}</td><td><strong>{item.utilizationPercent}%</strong></td>
          </tr>)}
        </tbody></table></div>
        {!report.rooms.length && <EmptyState title="Chưa có phòng để thống kê" text="Thêm phòng để xem báo cáo sử dụng." />}
      </section>
    </>}
  </>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><CalendarDays size={21} /></span><strong>{title}</strong><p>{text}</p>{action}</div>;
}

function BookingModal({ rooms, initialValues, onClose, onSubmit }: {
  rooms: Room[]; initialValues?: Partial<BookingInput>; onClose: () => void;
  onSubmit: (input: BookingInput, recurrence: number) => void;
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
  const initialDate = initialValues?.startTime ? format(new Date(initialValues.startTime), "yyyy-MM-dd") : today();
  const initialStart = initialValues?.startTime ? format(new Date(initialValues.startTime), "HH:mm") : "09:00";
  const initialEnd = initialValues?.endTime ? format(new Date(initialValues.endTime), "HH:mm") : "10:00";
  return <Modal title="Đặt phòng họp" subtitle="Điền thông tin để giữ chỗ cho cuộc họp." onClose={onClose}><form className="form-stack" onSubmit={submit}>
    <label>Phòng họp<select name="roomId" required defaultValue={initialValues?.roomId ?? ""}><option value="" disabled>Chọn phòng</option>{activeRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.location} · {room.capacity} chỗ</option>)}</select></label>
    <label>Ngày họp<input name="date" type="date" required min={today()} defaultValue={initialDate} /></label>
    <div className="form-row"><label>Giờ bắt đầu<input name="start" type="time" required defaultValue={initialStart} /></label><label>Giờ kết thúc<input name="end" type="time" required defaultValue={initialEnd} /></label></div>
    <div className="form-row"><label>Số người tham dự<input name="attendeeCount" type="number" required min="1" max="500" defaultValue={initialValues?.attendeeCount ?? 4} /></label><label>Hình thức đặt<select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="1">Một lần</option><option value="2">2 buổi hàng tuần</option><option value="3">3 buổi hàng tuần</option><option value="4">4 buổi hàng tuần</option><option value="5">5 buổi hàng tuần</option><option value="6">6 buổi hàng tuần</option><option value="7">7 buổi hàng tuần</option><option value="8">8 buổi hàng tuần</option></select></label></div>
    <p className="form-hint"><Clock3 size={14} /> Không giới hạn tổng thời gian đặt trong ngày. Thời gian theo múi giờ thiết bị.</p>
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
      amenities: String(form.get("amenities") ?? "").split(",").map((amenity) => amenity.trim()).filter(Boolean),
      status: room?.status ?? "ACTIVE"
    }, room?.id);
    setBusy(false);
  }
  return <Modal title={room ? "Cập nhật phòng họp" : "Thêm phòng họp"} subtitle={room ? "Chỉnh sửa thông tin của phòng." : "Bổ sung không gian mới vào danh sách."} onClose={onClose}><form className="form-stack" onSubmit={submit}>
    <label>Tên phòng<input name="name" required minLength={2} maxLength={80} placeholder="Ví dụ: Orchid" defaultValue={room?.name} /></label>
    <label>Vị trí<input name="location" required maxLength={120} placeholder="Ví dụ: Tầng 2" defaultValue={room?.location} /></label>
    <label>Sức chứa<input name="capacity" type="number" required min="1" max="500" placeholder="Số người tối đa" defaultValue={room?.capacity} /></label>
    <label>Tiện nghi<input name="amenities" placeholder="Máy chiếu, Màn hình, Bảng trắng" defaultValue={room?.amenities.join(", ")} /><span className="form-hint">Phân cách từng tiện nghi bằng dấu phẩy.</span></label>
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
