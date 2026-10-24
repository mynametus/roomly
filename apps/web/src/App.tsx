import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, CircleHelp, MessageCircle,
  Clock3, Copy, DoorOpen, LayoutDashboard, LogOut, Plus, Search, Settings2, ShieldCheck, Users,
  UserPlus, X, CalendarSearch, ChartNoAxesCombined, UserRoundCog, RotateCcw, Ban, CheckCircle2
} from "lucide-react";
import {
  addDays, addWeeks, format, isSameDay, isToday, startOfWeek, subWeeks
} from "date-fns";
import { ko, vi } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { Booking, BookingInput, BookingPlan, BookingPreview, BookingScope, Room, User } from "./types";
import { BookingModal, CancelBookingModal, recurrenceLabel } from "./components/BookingModal";
import { Modal } from "./components/Modal";
import { RoomNotes } from "./components/RoomNotes";
import { LanguageSelector, RoomName, T, getLanguage, translate } from "./i18n";

type AuthResponse = { user: User; token: string };
type View = "overview" | "availability" | "calendar" | "bookings" | "rooms" | "users" | "reports";
type Notice = { kind: "success" | "error"; text: string };
type CreatedAccount = { name: string; email: string; department: string };
type AvailableRoomSearch = { startTime: string; endTime: string; attendeeCount: number; amenities: string[] };
type AccountRecord = Pick<User, "id" | "name" | "email" | "department" | "role" | "isActive" | "mustChangePassword"> & { createdAt: string };

const dateLocale = () => getLanguage() === "ko" ? ko : vi;
const today = () => format(new Date(), "yyyy-MM-dd");
const prettyDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(getLanguage() === "ko" ? "ko-KR" : "vi-VN", options).format(new Date(date));
const clock = (date: string) =>
  new Intl.DateTimeFormat(getLanguage() === "ko" ? "ko-KR" : "vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date));

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("roomly-token"));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("overview");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
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

  const upcoming = useMemo(
    () => bookings.filter((booking) => booking.status === "CONFIRMED" && new Date(booking.endTime) >= new Date()),
    [bookings]
  );
  const filteredBookings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === "ALL" || booking.status === statusFilter;
      const matchesSearch = !query || [
        booking.room.name, booking.room.nameKo ?? "", booking.room.location, booking.user.name, booking.user.email
      ].some((value) => value.toLocaleLowerCase("vi").includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [bookings, search, statusFilter]);

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
    setEditingBooking(null);
    setCancelTarget(null);
    setShowRoomForm(false);
    setEditingRoom(null);
    setSearch("");
    setStatusFilter("ALL");
  }

  async function submitBooking(input: BookingPlan) {
    if (!token) throw new Error("Vui lòng đăng nhập lại.");
    try {
      const endpoint = editingBooking ? `/api/bookings/${encodeURIComponent(editingBooking.id)}` : input.recurrence ? "/api/bookings/recurring" : "/api/bookings";
      await api(endpoint, { method: editingBooking ? "PATCH" : "POST", body: JSON.stringify(input) }, token);
      setShowBooking(false); setEditingBooking(null);
      setNotice({ kind: "success", text: editingBooking ? "Đã cập nhật lịch đặt phòng." : input.recurrence ? "Đã tạo chuỗi lịch họp." : "Đã tạo lượt đặt phòng." });
      await refresh();
    } catch (error) { handleError(error); throw error; }
  }

  async function previewBooking(input: BookingPlan) {
    if (!token) throw new Error("Vui lòng đăng nhập lại.");
    try { return await api<BookingPreview>(editingBooking ? `/api/bookings/${encodeURIComponent(editingBooking.id)}/preview` : "/api/bookings/preview", { method: "POST", body: JSON.stringify(input) }, token); }
    catch (error) { handleError(error); throw error; }
  }

  function cancel(booking: Booking, _fromHere: boolean) {
    if (!isAdmin && booking.userId !== user?.id) return;
    setCancelTarget(booking);
  }

  async function confirmCancellation(scope: BookingScope) {
    if (!token || !cancelTarget) throw new Error("Vui lòng đăng nhập lại.");
    try {
      await api(`/api/bookings/${encodeURIComponent(cancelTarget.id)}?scope=${scope}`, { method: "DELETE" }, token);
      setCancelTarget(null); setNotice({ kind: "success", text: "Đã hủy lịch theo phạm vi đã chọn." });
      await refresh();
    } catch (error) { handleError(error); throw error; }
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
    setEditingBooking(null);
    setBookingDefaults(defaults);
    setShowBooking(true);
  }

  function openBookingEdit(booking: Booking) {
    if (!isAdmin && booking.userId !== user?.id) return;
    setEditingBooking(booking);
    setBookingDefaults({ roomId: booking.roomId, startTime: booking.startTime, endTime: booking.endTime, attendeeCount: booking.attendeeCount });
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
  if (!user) return <div className="loading-state"><span className="spinner" /> <T>Đang xác thực phiên đăng nhập…</T></div>;

  const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "availability", label: "Tìm phòng trống", icon: CalendarSearch },
    { id: "calendar", label: "Lịch phòng", icon: CalendarDays },
    { id: "bookings", label: isAdmin ? "Quản lý đặt phòng" : "Lịch đặt phòng", icon: Clock3 },
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
          <img src="/myungbo-logo.svg" alt={translate("Myungbo Cable")} />
        </a>
        <div className="workspace-label"><T>WORKSPACE</T></div>
        <nav className="nav-list" aria-label={translate("Điều hướng chính")}>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={1.8} /> <span><T>{label}</T></span>
              {id === "bookings" && <span className="nav-count">{upcoming.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" className="help-card" onClick={() => setShowZaloContact(true)}>
            <span className="help-icon"><CircleHelp size={18} /></span>
            <strong><T>Cần hỗ trợ?</T></strong>
            <span><T>Nhấn để kết bạn Zalo với quản trị viên.</T></span>
          </button>
          <div className="profile">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div className="profile-info"><strong>{user.name}</strong><span><T>{user.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</T></span></div>
            <button className="icon-button profile-logout" title={translate("Đăng xuất")} onClick={logout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><img src="/myungbo-logo.svg" alt={translate("Myungbo Cable")} /></div>
          <div className="breadcrumb"><T>Workspace </T><span><T>/</T></span> <strong><T>{navigation.find((item) => item.id === view)?.label ?? "Tổng quan"}</T></strong></div>
          <div className="topbar-actions">
            <LanguageSelector />
            <span className="today-label">{prettyDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</span>
            <button className="button button-primary button-small" onClick={() => openBooking()}><Plus size={16} /> <T>Đặt phòng mới</T></button>
            <button className="avatar avatar-small" title={translate("Đăng xuất")} onClick={logout}>{user.name.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <div className="page-content">
          {loading ? <div className="loading-state"><span className="spinner" /> <T>Đang tải dữ liệu…</T></div> : (
            <>
              {view === "overview" && <Overview rooms={rooms} upcoming={upcoming} currentUserId={user.id} canManageAll={isAdmin} onCreate={() => openBooking()} onNavigate={navigate} onCancel={cancel} />}
              {view === "availability" && <AvailabilityView
                onSearch={searchAvailableRooms}
                amenities={Array.from(new Set([...roomAmenityOptions, ...rooms.flatMap((room) => room.amenities)]))}
                onBook={(room, input) => openBooking({ roomId: room.id, startTime: input.startTime, endTime: input.endTime, attendeeCount: input.attendeeCount })}
                onError={handleError}
              />}
              {view === "calendar" && <CalendarView bookings={bookings} week={week} rooms={rooms} onWeekChange={setWeek} onCreate={() => openBooking()} />}
              {view === "bookings" && (
                <BookingsView
                  bookings={filteredBookings}
                  canManageAll={isAdmin}
                  currentUserId={user.id}
                  search={search}
                  statusFilter={statusFilter}
                  onSearch={setSearch}
                  onStatus={setStatusFilter}
                  onCancel={cancel}
                  onEdit={openBookingEdit}
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

      {notice && <div role="status" className={`toast ${notice.kind}`}><span>{notice.kind === "success" ? <Check size={17} /> : <AlertCircle size={17} />}</span><T>{notice.text}</T><button onClick={() => setNotice(null)} aria-label={translate("Đóng")}><X size={16} /></button></div>}
      {showBooking && <BookingModal key={editingBooking?.id ?? "new"} rooms={rooms} initialValues={bookingDefaults} editing={editingBooking} onClose={() => { setShowBooking(false); setEditingBooking(null); }} onPreview={previewBooking} onSubmit={submitBooking} />}
      {cancelTarget && <CancelBookingModal booking={cancelTarget} onClose={() => setCancelTarget(null)} onSubmit={confirmCancellation} />}
      {showRoomForm && isAdmin && <RoomModal onClose={() => setShowRoomForm(false)} onSubmit={saveRoom} />}
      {editingRoom && isAdmin && <RoomModal room={editingRoom} onClose={() => setEditingRoom(null)} onSubmit={saveRoom} />}
      {showZaloContact && <Modal title={translate("Liên hệ hỗ trợ qua Zalo")} subtitle={translate("Kết bạn để được quản trị viên hỗ trợ.")} onClose={() => setShowZaloContact(false)}>
        <div className="zalo-contact">
          <span className="zalo-contact-icon"><MessageCircle size={25} /></span>
          <p><T>Gửi lời mời kết bạn tới Zalo của quản trị viên:</T></p>
          <strong className="zalo-phone"><T>0855 799 066</T></strong>
          <a className="button button-primary button-wide" href="https://zalo.me/0855799066" target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> <T>Mở Zalo và kết bạn
          </T></a>
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
        <div className="auth-language"><LanguageSelector /></div>
        <a className="brand auth-brand" href="/"><img src="/myungbo-logo.svg" alt={translate("Myungbo Cable")} /></a>
        <div className="eyebrow"><T>KHÔNG GIAN LÀM VIỆC CỦA BẠN</T></div>
        <h1><T>Chào mừng trở lại</T></h1>
        <p className="muted"><T>Đăng nhập bằng tài khoản do quản trị viên công ty cấp.</T></p>
        <form className="form-stack" onSubmit={submit}>
          <label><T>Email</T><input name="email" required type="email" placeholder={translate("ban@congty.vn")} autoComplete="email" /></label>
          <label><T>Mật khẩu</T><input name="password" required type="password" minLength={1} placeholder={translate("Nhập mật khẩu")} autoComplete="current-password" /></label>
          <button className="button button-primary button-wide" disabled={busy}><T>{busy ? "Đang xử lý…" : "Đăng nhập"}</T> <ArrowRight size={17} /></button>
        </form>
        {errorMessage && <p className="auth-error" role="alert"><T>{errorMessage}</T></p>}
        <p className="auth-switch"><T>Chưa có tài khoản? Liên hệ quản trị viên công ty để được cấp.</T></p>
        <div className="auth-foot"><T>Đặt đúng phòng. Họp đúng giờ.</T></div>
      </div>
      <div className="auth-aside">
        <div className="aside-decoration deco-one" /><div className="aside-decoration deco-two" />
        <div className="aside-copy"><span className="eyebrow light"><T>MYUNGBO CABLE · MEETING SPACE</T></span><h2><T>Một không gian tốt</T><br /><T>bắt đầu từ </T><em><T>một lịch tốt.</T></em></h2><p><T>Đặt chỗ nhanh chóng, xem lịch phòng trực quan và dành thời gian cho điều quan trọng.</T></p></div>
        <div className="aside-footer"><span><T>Không gian dành cho ý tưởng lớn.</T></span><span><T>01 — 04</T></span></div>
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
        <div className="auth-language"><LanguageSelector /></div>
        <a className="brand auth-brand" href="/"><img src="/myungbo-logo.svg" alt={translate("Myungbo Cable")} /></a>
        <div className="eyebrow"><T>BẢO MẬT TÀI KHOẢN</T></div>
        <h1><T>Đổi mật khẩu để tiếp tục</T></h1>
        <p className="muted"><T>Xin chào </T>{user.name}<T>. Vì bạn đang sử dụng mật khẩu mặc định, hãy tạo mật khẩu mới trước khi sử dụng Roomly.</T></p>
        <form className="form-stack" onSubmit={submit}>
          <label><T>Mật khẩu hiện tại</T><input name="currentPassword" type="password" required autoComplete="current-password" /></label>
          <label><T>Mật khẩu mới</T><input name="newPassword" type="password" required minLength={8} maxLength={100} autoComplete="new-password" /></label>
          <label><T>Xác nhận mật khẩu mới</T><input name="confirmPassword" type="password" required minLength={8} maxLength={100} autoComplete="new-password" /></label>
          <button className="button button-primary button-wide" disabled={busy}><T>{busy ? "Đang cập nhật…" : "Đổi mật khẩu"}</T> <ArrowRight size={17} /></button>
        </form>
        {errorMessage && <p className="auth-error" role="alert"><T>{errorMessage}</T></p>}
        <p className="auth-switch"><T>Đang đăng nhập với tài khoản </T><strong>{user.email}</strong></p>
      </div>
      <div className="auth-aside">
        <div className="aside-decoration deco-one" /><div className="aside-decoration deco-two" />
        <div className="aside-copy"><span className="eyebrow light"><T>MYUNGBO CABLE · BẢO MẬT</T></span><h2><T>Bảo vệ tài khoản</T><br /><T>bằng </T><em><T>mật khẩu riêng.</T></em></h2><p><T>Chọn mật khẩu mới dài ít nhất 8 ký tự và không dùng chung với mật khẩu ở nơi khác.</T></p></div>
        <div className="aside-footer"><span><T>Chỉ mất một phút để bắt đầu.</T></span><span><T>01 — 04</T></span></div>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><T>{eyebrow}</T></div><h1><T>{title}</T></h1><p><T>{description}</T></p></div>{action}</div>;
}

export function Overview({ rooms, upcoming, currentUserId, canManageAll, onCreate, onNavigate, onCancel }: {
  rooms: Room[]; upcoming: Booking[]; currentUserId: string; canManageAll: boolean; onCreate: () => void; onNavigate: (view: View) => void;
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
      <PageHeading eyebrow={`${getLanguage() === "ko" ? format(new Date(), "EEEE", { locale: dateLocale() }).toLocaleUpperCase("ko") : `THỨ ${format(new Date(), "EEEE", { locale: dateLocale() }).toLocaleUpperCase("vi")}`} · ${format(new Date(), "dd/MM/yyyy")}`} title={translate("Chào bạn 👋")} description="Đây là những gì đang diễn ra trong không gian của bạn hôm nay." action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> <T>Đặt phòng mới</T></button>} />
      <section className="stats-grid">
        <StatCard icon={<DoorOpen size={19} />} label="Phòng đang hoạt động" value={`${activeRooms}`} sub={`trên tổng ${rooms.length} phòng`} tone="lavender" />
        <StatCard icon={<CalendarDays size={19} />} label="Lịch đặt hôm nay" value={`${todayBookings.length}`} sub="lượt đặt trong ngày" tone="peach" />
        <StatCard icon={<Clock3 size={19} />} label="Lịch sắp tới" value={`${upcoming.length}`} sub="lượt đã xác nhận" tone="mint" />
        <StatCard icon={<Users size={19} />} label="Lượt đặt tuần này" value={`${thisWeek}`} sub="tất cả phòng họp" tone="sky" />
      </section>
      <section className="overview-grid">
        <div className="panel upcoming-panel">
          <div className="panel-heading"><div><h2><T>Lịch sắp tới</T></h2><p><T>Các cuộc họp đã được xác nhận</T></p></div><button className="text-link" onClick={() => onNavigate("bookings")}><T>Xem tất cả </T><ArrowRight size={15} /></button></div>
          {nextBookings.length ? <div className="upcoming-list">{nextBookings.map((booking) => <BookingRow key={booking.id} booking={booking} canManage={canManageAll || booking.userId === currentUserId} onCancel={onCancel} />)}</div> : <EmptyState title={translate("Chưa có lịch đặt sắp tới")} text="Tạo lịch mới để bắt đầu sử dụng phòng họp." action={<button className="button button-outline button-small" onClick={onCreate}><Plus size={15} /> <T>Đặt phòng</T></button>} />}
        </div>
        <div className="panel quick-panel">
          <div className="panel-heading"><div><h2><T>Thao tác nhanh</T></h2><p><T>Bắt đầu chỉ với một chạm</T></p></div><Settings2 size={18} className="muted-icon" /></div>
          <button className="quick-action" onClick={onCreate}><span className="quick-icon lavender"><Plus size={18} /></span><span><strong><T>Đặt phòng họp</T></strong><small><T>Tìm phòng và chọn thời gian</T></small></span><ArrowRight size={16} /></button>
          <button className="quick-action" onClick={() => onNavigate("calendar")}><span className="quick-icon mint"><CalendarDays size={18} /></span><span><strong><T>Xem lịch phòng</T></strong><small><T>Kiểm tra phòng còn trống</T></small></span><ArrowRight size={16} /></button>
          <button className="quick-action" onClick={() => onNavigate("rooms")}><span className="quick-icon peach"><DoorOpen size={18} /></span><span><strong><T>Khám phá phòng</T></strong><small>{activeRooms} <T>phòng sẵn sàng</T></small></span><ArrowRight size={16} /></button>
          <div className="tip-box"><span className="tip-symbol"><T>✳</T></span><span><strong><T>Mẹo nhỏ</T></strong> <T>Bạn có thể đặt lịch họp lặp lại hàng ngày, hàng tuần hoặc hàng tháng.</T></span></div>
        </div>
      </section>
    </>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub: string; tone: string }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-label"><T>{label}</T></span><strong className="stat-value">{value}</strong><span className="stat-sub"><T>{sub}</T></span></div>;
}

function BookingRow({ booking, canManage, onCancel }: { booking: Booking; canManage: boolean; onCancel: (booking: Booking, fromHere: boolean) => void }) {
  return (
    <div className="booking-row">
      <div className="date-block"><strong>{format(new Date(booking.startTime), "dd")}</strong><span>{format(new Date(booking.startTime), "MMM", { locale: dateLocale() })}</span></div>
      <span className="booking-color" />
      <div className="booking-main"><strong><RoomName room={booking.room} /></strong><span>{booking.room.location} <T>· </T>{clock(booking.startTime)}<T>–</T>{clock(booking.endTime)}</span><small>{booking.user.name} <T>· </T>{booking.user.department || "Chưa cập nhật bộ phận"} <T>· </T>{booking.attendeeCount} <T>người</T></small></div>
      <div className="booking-end"><span className={`status-pill ${booking.status === "CONFIRMED" ? "confirmed" : "cancelled"}`}>{booking.status === "CONFIRMED" ? "Đã xác nhận" : "Đã hủy"}</span>{canManage && booking.status === "CONFIRMED" && <button className="text-link cancel-link" onClick={() => onCancel(booking, Boolean(booking.series))}><T>Hủy</T></button>}</div>
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
      <PageHeading eyebrow="KHÔNG GIAN CỦA BẠN" title={translate("Lịch phòng họp")} description="Theo dõi lịch sử dụng phòng theo tuần." action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> <T>Đặt phòng</T></button>} />
      <div className="panel calendar-panel">
        <div className="calendar-toolbar"><div className="calendar-month">{format(start, "MMMM yyyy", { locale: dateLocale() })}</div><div className="calendar-controls"><button className="icon-button" aria-label={translate("Tuần trước")} onClick={() => onWeekChange(subWeeks(week, 1))}><ArrowLeft size={17} /></button><button className="button button-outline button-small" onClick={() => onWeekChange(new Date())}><T>Hôm nay</T></button><button className="icon-button" aria-label={translate("Tuần sau")} onClick={() => onWeekChange(addWeeks(week, 1))}><ArrowRight size={17} /></button></div></div>
        <div className="calendar-grid">
          <div className="calendar-room-head"><T>PHÒNG</T></div>
          {days.map((day) => <div key={day.toISOString()} className={`calendar-day-head ${isToday(day) ? "today" : ""}`}><span>{format(day, "EEE", { locale: dateLocale() })}</span><strong>{format(day, "dd")}</strong></div>)}
          {roomIds.map((roomId) => {
            const room = rooms.find((item) => item.id === roomId)!;
            return <div className="calendar-room-row" key={roomId}><div className="calendar-room-name"><strong><RoomName room={room} /></strong><span>{room.capacity} <T>chỗ</T></span></div>{days.map((day) => {
              const dayBookings = weekBookings.filter((booking) => booking.roomId === roomId && isSameDay(new Date(booking.startTime), day));
              return <div key={day.toISOString()} className={`calendar-cell ${isToday(day) ? "today-cell" : ""}`}>{dayBookings.map((booking) => <div className="calendar-event" key={booking.id} title={`${clock(booking.startTime)}–${clock(booking.endTime)} · ${booking.user.name} · ${booking.user.department || "Chưa cập nhật bộ phận"}`}><strong>{clock(booking.startTime)}<T>–</T>{clock(booking.endTime)}</strong><span>{booking.user.name}</span><small>{booking.user.department || "Chưa cập nhật bộ phận"}</small></div>)}</div>;
            })}</div>;
          })}
        </div>
        <div className="calendar-foot"><span className="legend-dot" /> <T>Đã xác nhận </T><span className="muted"><T>· Thời gian hiển thị theo múi giờ thiết bị</T></span></div>
      </div>
    </>
  );
}

export function BookingsView({ bookings, currentUserId, canManageAll, search, statusFilter, onSearch, onStatus, onCancel, onCreate, onEdit }: {
  bookings: Booking[]; currentUserId: string; canManageAll: boolean; search: string; statusFilter: string; onSearch: (value: string) => void;
  onStatus: (value: string) => void; onCancel: (booking: Booking, fromHere: boolean) => void; onCreate: () => void; onEdit?: (booking: Booking) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(bookings.length / pageSize));
  useEffect(() => setCurrentPage(1), [search, statusFilter]);
  useEffect(() => setCurrentPage((page) => Math.min(page, pageCount)), [pageCount]);
  const pageStart = (currentPage - 1) * pageSize;
  const pageBookings = bookings.slice(pageStart, pageStart + pageSize);

  return <>
    <PageHeading eyebrow="LỊCH ĐẶT PHÒNG" title={canManageAll ? "Quản lý đặt phòng" : "Lịch đặt phòng"} description={canManageAll ? "Tìm kiếm, theo dõi và quản lý lượt đặt phòng của tất cả người dùng." : "Xem lịch đặt phòng của mọi người. Bạn có thể tạo lịch mới, chỉnh sửa và hủy lịch của chính mình."} action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> <T>Đặt phòng mới</T></button>} />
    <div className="panel table-panel">
      <div className="table-toolbar"><div className="search-field"><Search size={17} /><input aria-label={translate("Tìm phòng hoặc người đặt")} placeholder={translate("Tìm phòng, người đặt...")} value={search} onChange={(event) => onSearch(event.target.value)} /></div><select aria-label={translate("Lọc trạng thái")} value={statusFilter} onChange={(event) => onStatus(event.target.value)}><option value="ALL"><T>Tất cả trạng thái</T></option><option value="CONFIRMED"><T>Đã xác nhận</T></option><option value="CANCELLED"><T>Đã hủy</T></option></select></div>
      {bookings.length ? <><div className="table-wrap"><table><thead><tr><th><T>PHÒNG HỌP</T></th><th><T>NGƯỜI ĐẶT</T></th><th><T>NGÀY & GIỜ</T></th><th><T>SỐ NGƯỜI</T></th><th><T>TRẠNG THÁI</T></th><th><T>THAO TÁC</T></th></tr></thead><tbody>{pageBookings.map((booking) => <tr key={booking.id}>
        <td><strong><RoomName room={booking.room} /></strong><small>{booking.room.location}</small></td><td><strong>{booking.user.name}</strong><small>{booking.user.department || "Chưa cập nhật bộ phận"}</small><small>{booking.user.email}</small></td>
        <td><strong>{prettyDate(booking.startTime, { day: "numeric", month: "short", year: "numeric" })}</strong><small>{clock(booking.startTime)} <T>– </T>{clock(booking.endTime)}</small>{booking.series && <small>{recurrenceLabel(booking)}</small>}</td>
        <td>{booking.attendeeCount} <T>người</T></td><td><span className={`status-pill ${booking.status === "CONFIRMED" ? "confirmed" : "cancelled"}`}>{booking.status === "CONFIRMED" ? "Đã xác nhận" : "Đã hủy"}</span></td>
        <td>{booking.status === "CONFIRMED" && (canManageAll || booking.userId === currentUserId) && <div className="booking-actions">{onEdit && <button className="table-action" onClick={() => onEdit(booking)}><T>Chỉnh sửa</T></button>}<button className="table-action" onClick={() => onCancel(booking, Boolean(booking.series))}><T>Hủy đặt</T></button></div>}</td>
      </tr>)}</tbody></table></div>{pageCount > 1 && <div className="booking-pagination"><span><T>Hiển thị </T>{pageStart + 1}<T>–</T>{Math.min(pageStart + pageSize, bookings.length)} <T>trong </T>{bookings.length} <T>lịch</T></span><div className="booking-pagination-controls"><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}><ArrowLeft size={15} /> <T>Trước</T></button><span><T>Trang </T>{currentPage} <T>/ </T>{pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)}><T>Tiếp </T><ArrowRight size={15} /></button></div></div>}</> : <EmptyState title={translate("Không tìm thấy lượt đặt")} text="Thử thay đổi bộ lọc hoặc tạo một lượt đặt mới." action={<button className="button button-outline button-small" onClick={onCreate}><Plus size={15} /> <T>Đặt phòng</T></button>} />}
    </div>
  </>;
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
      <PageHeading eyebrow="TÌM KIẾM THÔNG MINH" title={translate("Tìm phòng còn trống")} description="Chọn thời gian và tiện nghi cần có để tìm phòng phù hợp." />
      <section className="panel availability-panel">
        <form className="availability-form" onSubmit={submit}>
          <label><T>Thời gian bắt đầu</T><input name="startTime" type="datetime-local" required defaultValue={`${today()}T09:00`} /></label>
          <label><T>Thời gian kết thúc</T><input name="endTime" type="datetime-local" required defaultValue={`${today()}T10:00`} /></label>
          <label><T>Số người</T><input name="attendeeCount" type="number" min="1" max="500" required defaultValue="4" /></label>
          <button className="button button-primary" disabled={busy}>{busy ? "Đang tìm…" : <><Search size={16} /> <T>Tìm phòng</T></>}</button>
          <fieldset className="amenity-filter">
            <legend><T>Tiện nghi cần có</T></legend>
            {amenities.map((amenity) => <label key={amenity}>
              <input type="checkbox" checked={selectedAmenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />
              <span><T>{amenity}</T></span>
            </label>)}
          </fieldset>
        </form>
      </section>
      {results !== null && <section className="availability-results">
        <div className="section-title"><h2><T>{results.length ? `Tìm thấy ${results.length} phòng phù hợp` : "Không có phòng phù hợp"}</T></h2>
          {query && <p>{prettyDate(query.startTime, { day: "numeric", month: "long" })} <T>· </T>{clock(query.startTime)}<T>–</T>{clock(query.endTime)} <T>· </T>{query.attendeeCount} <T>người</T></p>}
        </div>
        {results.length ? <div className="rooms-grid">{results.map((room, index) => <article className={`room-card room-art-${index % 3}`} key={room.id}>
        <div className="room-art"><span className="room-art-label"><T>ROOM </T>{String(index + 1).padStart(2, "0")}</span><DoorOpen size={52} strokeWidth={1.2} /><span className="room-art-shape" /></div>
          <div className="room-card-body"><div className="room-card-title"><div><h2><RoomName room={room} /></h2><span>{room.location}</span></div><span className="room-status active"><i /><T>Còn trống</T></span></div>
            <div className="room-features"><span><Users size={16} /> <T>Tối đa </T>{room.capacity} <T>người</T></span></div>
            <AmenityBadges amenities={room.amenities} />
            <RoomNotes notes={room.notes} />
            <button className="button button-primary button-wide" onClick={() => query && onBook(room, query)}><Plus size={16} /> <T>Đặt phòng này</T></button>
          </div>
        </article>)}</div> : <div className="panel"><EmptyState title={translate("Chưa tìm thấy phòng phù hợp")} text="Thử giảm số người hoặc bỏ bớt tiện nghi cần có." /></div>}
      </section>}
    </>
  );
}

function AmenityBadges({ amenities }: { amenities: string[] }) {
  if (!amenities.length) return <p className="amenity-empty"><T>Chưa khai báo tiện nghi.</T></p>;
  return <div className="amenity-badges">{amenities.map((amenity) => <span key={amenity}><T>{amenity}</T></span>)}</div>;
}

export function RoomsView({ rooms, canManage, onCreate, onEdit, onUpdate }: {
  rooms: Room[]; canManage: boolean; onCreate: () => void; onEdit: (room: Room) => void; onUpdate: (room: Room) => void;
}) {
  return (
    <>
      <PageHeading eyebrow="KHÔNG GIAN LÀM VIỆC" title={translate("Danh sách phòng")} description="Tìm phòng phù hợp cho cuộc họp tiếp theo." action={canManage ? <button className="button button-primary" onClick={onCreate}><Plus size={17} /> <T>Thêm phòng</T></button> : undefined} />
      <div className="rooms-grid">{rooms.map((room, index) => <article key={room.id} className={`room-card room-art-${index % 3}`}><div className="room-art"><span className="room-art-label"><T>ROOM </T>{String(index + 1).padStart(2, "0")}</span><DoorOpen size={52} strokeWidth={1.2} /><span className="room-art-shape" /></div><div className="room-card-body"><div className="room-card-title"><div><h2><RoomName room={room} /></h2><span>{room.location}</span></div><span className={`room-status ${room.status === "ACTIVE" ? "active" : "inactive"}`}><i /><T>{room.status === "ACTIVE" ? "Sẵn sàng" : "Tạm ngưng"}</T></span></div><div className="room-features"><span><Users size={16} /> <T>Tối đa </T>{room.capacity} <T>người</T></span><span><CalendarDays size={16} /> <T>Đặt theo giờ</T></span></div><AmenityBadges amenities={room.amenities} /><RoomNotes notes={room.notes} /><div className="room-card-foot"><span><T>Phòng họp · </T>{room.location}</span>{canManage && <div className="room-admin-actions"><button className="table-action" onClick={() => onEdit(room)}><T>Chỉnh sửa</T></button><button className="table-action" onClick={() => onUpdate(room)}><T>{room.status === "ACTIVE" ? "Ngừng sử dụng" : "Kích hoạt"}</T></button></div>}</div></div></article>)}</div>
      {!rooms.length && <div className="panel"><EmptyState title={translate("Chưa có phòng nào")} text={canManage ? "Thêm phòng họp đầu tiên vào hệ thống." : "Vui lòng liên hệ quản trị viên để bổ sung phòng họp."} action={canManage ? <button className="button button-primary button-small" onClick={onCreate}><Plus size={15} /> <T>Thêm phòng</T></button> : undefined} /></div>}
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
    if (!window.confirm(translate(`Đặt lại mật khẩu cho ${account.email}? Người dùng sẽ phải đổi mật khẩu sau lần đăng nhập tiếp theo.`))) return;
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
        title={translate("Tài khoản người dùng")}
        description="Tìm, khóa/mở tài khoản, đặt lại mật khẩu hoặc tạo thành viên mới."
      />
      <div className="admin-tabs" role="tablist" aria-label={translate("Quản lý tài khoản")}>
        <button role="tab" aria-selected={tab === "accounts"} className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}><Users size={16} /> <T>Danh sách tài khoản</T></button>
        <button role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><UserPlus size={16} /> <T>Thêm hàng loạt</T></button>
      </div>
      {tab === "accounts" && <>
        <section className="panel table-panel admin-accounts">
        <div className="table-toolbar">
            <div className="search-field"><Search size={17} /><input aria-label={translate("Tìm tên, email hoặc bộ phận")} placeholder={translate("Tìm tên, email hoặc bộ phận...")} value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></div>
            <span className="account-count">{accounts.length} <T>tài khoản</T></span>
          </div>
          {accountError && <p className="form-error account-error" role="alert"><T>{accountError}</T></p>}
          {accountMessage && <p className="copy-message" role="status"><T>{accountMessage}</T></p>}
          {accountBusy ? <div className="loading-state"><span className="spinner" /> <T>Đang tải tài khoản…</T></div> :
            <div className="table-wrap"><table><thead><tr><th><T>TÀI KHOẢN</T></th><th><T>BỘ PHẬN LÀM VIỆC</T></th><th><T>VAI TRÒ</T></th><th><T>TRẠNG THÁI</T></th><th><T>MẬT KHẨU</T></th><th><T>THAO TÁC</T></th></tr></thead><tbody>
          {accounts.map((account) => <tr key={account.id}>
                <td><strong>{account.name}</strong><small>{account.email}</small></td>
                <td>{account.department || "Chưa cập nhật"}</td>
                <td><T>{account.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</T></td>
                <td><span className={`status-pill ${account.isActive ? "confirmed" : "cancelled"}`}><T>{account.isActive ? "Đang hoạt động" : "Đã khóa"}</T></span></td>
                <td>{account.mustChangePassword ? <span className="password-change-required"><T>Cần đổi</T></span> : <T>Đã thiết lập</T>}</td>
                <td><div className="account-actions">
                  <button className="table-action" onClick={() => { setEditingAccount(account); setDepartment(account.department ?? ""); setDepartmentError(""); setAccountMessage(""); }}><T>Sửa bộ phận</T></button>
                  <button className="table-action" onClick={() => void resetPassword(account)}><RotateCcw size={14} /> <T>Đặt lại</T></button>
                  <button className="table-action" disabled={account.id === currentUserId} onClick={() => void toggleAccount(account)}>
                    {account.isActive ? <><Ban size={14} /> <T>Khóa</T></> : <><CheckCircle2 size={14} /> <T>Mở khóa</T></>}
                  </button>
                </div></td>
              </tr>)}
            </tbody></table></div>}
          {!accountBusy && accounts.length === 0 && <EmptyState title={translate("Không tìm thấy tài khoản")} text="Thử tìm bằng tên, email hoặc bộ phận khác." />}
        </section>
        {resetResult && <section className="panel reset-password-result">
          <div><strong><T>Đã đặt lại mật khẩu cho </T>{resetResult.name}</strong><p>{resetResult.email} <T>· Mật khẩu chỉ hiển thị lần này; người dùng phải đổi sau khi đăng nhập.</T></p></div>
          <code>{resetResult.password}</code>
          <button className="button button-outline button-small" onClick={() => void copyResetPassword()}><Copy size={14} /> <T>Sao chép</T></button>
          <button className="icon-button" aria-label={translate("Ẩn mật khẩu")} onClick={() => setResetResult(null)}><X size={16} /></button>
        </section>}
      </>}
      {tab === "create" && <>
      <div className="users-admin-grid">
        <section className="panel users-import-panel">
          <div className="panel-heading">
            <div><h2><T>Thêm tài khoản hàng loạt</T></h2><p><T>Nhập mỗi người dùng trên một dòng, tối đa 50 tài khoản.</T></p></div>
            <span className="quick-icon lavender"><UserPlus size={18} /></span>
          </div>
          <div className="import-example">
            <strong><T>Định dạng danh sách</T></strong>
            <code><T>Tên, email, bộ phận làm việc</T></code>
            <code><T>Nguyễn Văn An, an@congty.vn, Kế toán</T></code>
            <code><T>Trần Thị Bình, binh@congty.vn, Nhân sự</T></code>
          </div>
          <form className="form-stack" onSubmit={submit}>
    <label><T>Danh sách người dùng
              </T><textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={translate("Tên, email, bộ phận làm việc\nNguyễn Văn An, an@congty.vn, Kế toán\nTrần Thị Bình, binh@congty.vn, Nhân sự")}
                rows={9}
                maxLength={15000}
                required
              />
            </label>
            {error && <p className="form-error" role="alert"><T>{error}</T></p>}
            <p className="form-hint"><ShieldCheck size={16} /> <T>Tài khoản mới luôn có quyền thành viên, không thể tự cấp quyền quản trị.</T></p>
            <button className="button button-primary" disabled={busy}>
              <UserPlus size={16} /> {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
            </button>
          </form>
        </section>
        <aside className="panel users-security-panel">
          <span className="users-security-icon"><ShieldCheck size={24} /></span>
          <h2><T>Mật khẩu mặc định ban đầu</T></h2>
          <p><T>Tất cả tài khoản do admin tạo có mật khẩu ban đầu </T><code><T>12345678</T></code><T>. Người dùng bắt buộc phải đổi mật khẩu ngay lần đầu đăng nhập.</T></p>
          <p><T>Hãy gửi mật khẩu này cho người dùng qua kênh riêng tư. Không sử dụng mật khẩu mặc định cho tài khoản quản trị viên.</T></p>
        </aside>
      </div>
      {createdAccounts.length > 0 && (
        <section className="panel credentials-panel">
          <div className="panel-heading">
            <div><h2><T>Đã tạo </T>{createdAccounts.length} <T>tài khoản</T></h2><p><T>Mật khẩu ban đầu là 12345678; người dùng sẽ phải đổi sau khi đăng nhập.</T></p></div>
            <div className="credentials-actions">
              <button className="button button-outline button-small" onClick={() => void copyCredentials()}><Copy size={15} /> <T>Sao chép danh sách</T></button>
              <button className="icon-button" aria-label={translate("Ẩn mật khẩu")} onClick={onClearCredentials}><X size={17} /></button>
            </div>
          </div>
          <div className="table-wrap"><table><thead><tr><th><T>TÊN</T></th><th><T>EMAIL</T></th><th><T>BỘ PHẬN LÀM VIỆC</T></th><th><T>MẬT KHẨU BAN ĐẦU</T></th></tr></thead><tbody>{createdAccounts.map((account) => <tr key={account.email}><td><strong>{account.name}</strong></td><td>{account.email}</td><td>{account.department}</td><td><code className="temporary-password"><T>12345678</T></code></td></tr>)}</tbody></table></div>
          {copyMessage && <p className="copy-message" role="status">{copyMessage}</p>}
        </section>
      )}
      </>}
      {editingAccount && <Modal title={translate("Cập nhật bộ phận làm việc")} subtitle={`${editingAccount.name} · ${editingAccount.email}`} onClose={() => { if (!departmentBusy) setEditingAccount(null); }}>
        <form className="form-stack" onSubmit={saveDepartment}>
          <label><T>Bộ phận làm việc</T><input value={department} onChange={(event) => setDepartment(event.target.value)} required maxLength={120} placeholder={translate("Ví dụ: Kế toán")} autoFocus disabled={departmentBusy} /></label>
          {departmentError && <p className="form-error" role="alert">{departmentError}</p>}
          <div className="modal-actions"><button type="button" className="button button-outline" disabled={departmentBusy} onClick={() => setEditingAccount(null)}><T>Hủy</T></button><button className="button button-primary" disabled={departmentBusy}><T>{departmentBusy ? "Đang lưu…" : "Lưu thay đổi"}</T></button></div>
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
    room: Pick<Room, "id" | "name" | "nameKo" | "location" | "status">;
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
    <PageHeading eyebrow="PHÂN TÍCH VẬN HÀNH" title={translate("Báo cáo sử dụng phòng")} description="Theo dõi số lượt đặt, giờ sử dụng và tỷ lệ khai thác theo phòng." />
    <form className="panel report-filters" onSubmit={(event) => void loadReport(event)}>
      <label><T>Từ ngày</T><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
      <label><T>Đến ngày</T><input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
      <button className="button button-primary" disabled={busy}>{busy ? "Đang tải…" : <><Search size={16} /> <T>Xem báo cáo</T></>}</button>
    </form>
    {report && <>
      <section className="stats-grid report-stats">
        <StatCard icon={<DoorOpen size={19} />} label="Phòng đang hoạt động" value={String(report.summary.activeRoomCount)} sub="được tính trong công suất" tone="lavender" />
        <StatCard icon={<CalendarDays size={19} />} label="Lượt đặt đã xác nhận" value={String(report.summary.totalBookings)} sub="trong khoảng thời gian" tone="peach" />
        <StatCard icon={<Clock3 size={19} />} label="Tổng giờ sử dụng" value={`${report.summary.bookedHours} giờ`} sub={`${report.summary.totalCancelled} lượt đã hủy`} tone="mint" />
        <StatCard icon={<ChartNoAxesCombined size={19} />} label="Tỷ lệ sử dụng" value={`${report.summary.utilizationPercent}%`} sub="trên tổng giờ phòng hoạt động" tone="sky" />
      </section>
      <section className="panel table-panel report-table">
        <div className="panel-heading"><div><h2><T>Chi tiết theo phòng</T></h2><p><T>Tỷ lệ sử dụng = giờ đặt đã xác nhận / tổng giờ lịch phòng đang hoạt động.</T></p></div></div>
        <div className="table-wrap"><table><thead><tr><th><T>PHÒNG</T></th><th><T>TRẠNG THÁI</T></th><th><T>LƯỢT ĐẶT</T></th><th><T>GIỜ SỬ DỤNG</T></th><th><T>ĐÃ HỦY</T></th><th><T>TỶ LỆ SỬ DỤNG</T></th></tr></thead><tbody>
          {report.rooms.map((item) => <tr key={item.room.id}>
            <td><strong><RoomName room={item.room} /></strong><small>{item.room.location}</small></td>
            <td><T>{item.room.status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}</T></td>
            <td>{item.bookingCount}</td><td>{item.bookedHours} <T>giờ</T></td><td>{item.cancelledCount}</td><td><strong>{item.utilizationPercent}<T>%</T></strong></td>
          </tr>)}
        </tbody></table></div>
        {!report.rooms.length && <EmptyState title={translate("Chưa có phòng để thống kê")} text="Thêm phòng để xem báo cáo sử dụng." />}
      </section>
    </>}
  </>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><CalendarDays size={21} /></span><strong><T>{title}</T></strong><p><T>{text}</T></p>{action}</div>;
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
      nameKo: String(form.get("nameKo") ?? "").trim() || null,
      location: String(form.get("location")),
      notes: String(form.get("notes") ?? "").trim() || null,
      capacity: Number(form.get("capacity")),
      amenities: String(form.get("amenities") ?? "").split(",").map((amenity) => amenity.trim()).filter(Boolean),
      status: room?.status ?? "ACTIVE"
    }, room?.id);
    setBusy(false);
  }
  return <Modal title={translate(room ? "Cập nhật phòng họp" : "Thêm phòng họp")} subtitle={translate(room ? "Chỉnh sửa thông tin của phòng." : "Bổ sung không gian mới vào danh sách.")} onClose={onClose}><form className="form-stack" onSubmit={submit}>
    <label><T>Tên phòng</T><input name="name" required minLength={2} maxLength={80} placeholder={translate("Ví dụ: Orchid")} defaultValue={room?.name} /></label>
    <label><T>Tên phòng (tiếng Hàn, không bắt buộc)</T><input name="nameKo" maxLength={80} placeholder={translate("Ví dụ: 오키드 회의실")} defaultValue={room?.nameKo ?? ""} /></label>
    <label><T>Vị trí</T><input name="location" required maxLength={120} placeholder={translate("Ví dụ: Tầng 2")} defaultValue={room?.location} /></label>
    <label><T>Sức chứa</T><input name="capacity" type="number" required min="1" max="500" placeholder={translate("Số người tối đa")} defaultValue={room?.capacity} /></label>
    <label><T>Tiện nghi</T><input name="amenities" placeholder={translate("Máy chiếu, Màn hình, Bảng trắng")} defaultValue={room?.amenities.join(", ")} /><span className="form-hint"><T>Phân cách từng tiện nghi bằng dấu phẩy.</T></span></label>
    <label><T>Ghi chú (không bắt buộc)</T><textarea className="room-notes-input" name="notes" rows={3} maxLength={2000} defaultValue={room?.notes ?? ""} placeholder={translate("Ví dụ: Liên hệ lễ tân để lấy chìa khóa; sắp xếp lại bàn ghế sau khi sử dụng.")} /><span className="form-hint"><T>Tối đa 2.000 ký tự. Có thể để trống.</T></span></label>
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}><T>Hủy</T></button><button className="button button-primary" disabled={busy}>{busy ? "Đang lưu…" : room ? "Lưu thay đổi" : "Thêm phòng"} <ArrowRight size={16} /></button></div>
  </form></Modal>;
}
