import { useState, type FormEvent } from "react";
import { addMonths, format } from "date-fns";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarCheck2, Check, Clock3 } from "lucide-react";
import type { Booking, BookingInput, BookingPlan, BookingPreview, BookingScope, RecurrenceRule, Room } from "../types";
import { Modal } from "./Modal";
import { RoomNotes } from "./RoomNotes";

const weekdays = [{ value: 1, label: "T2" }, { value: 2, label: "T3" }, { value: 3, label: "T4" }, { value: 4, label: "T5" }, { value: 5, label: "T6" }, { value: 6, label: "T7" }, { value: 0, label: "CN" }];
const frequencyLabels = { NONE: "Một lần", DAILY: "Hàng ngày", WEEKLY: "Hàng tuần", MONTHLY: "Hàng tháng" };
export const scopeLabels: Record<BookingScope, string> = { THIS: "Chỉ buổi này", FOLLOWING: "Buổi này và các buổi sau", ALL: "Toàn bộ chuỗi" };
const today = () => format(new Date(), "yyyy-MM-dd");
const localTime = (date: string) => format(new Date(date), "HH:mm");
const dateLabel = (date: string) => new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${date}T12:00:00`));

export function recurrenceLabel(booking: Booking): string {
  if (!booking.series) return "";
  const frequency = booking.series.recurrence?.frequency ?? "WEEKLY";
  return `${frequencyLabels[frequency]} · ${booking.series.recurrenceCount} buổi`;
}

export function BookingModal({ rooms, initialValues, editing, onClose, onPreview, onSubmit }: {
  rooms: Room[]; initialValues?: Partial<BookingInput>; editing?: Booking | null; onClose: () => void;
  onPreview: (input: BookingPlan) => Promise<BookingPreview>; onSubmit: (input: BookingPlan) => Promise<void>;
}) {
  const initialDate = initialValues?.startTime ? format(new Date(initialValues.startTime), "yyyy-MM-dd") : today();
  const [form, setForm] = useState({ roomId: initialValues?.roomId ?? "", date: initialDate, start: initialValues?.startTime ? localTime(initialValues.startTime) : "09:00", end: initialValues?.endTime ? localTime(initialValues.endTime) : "10:00", attendeeCount: String(initialValues?.attendeeCount ?? 4) });
  const [frequency, setFrequency] = useState<"NONE" | RecurrenceRule["frequency"]>("NONE");
  const [interval, setInterval] = useState("1");
  const [selectedWeekdays, setSelectedWeekdays] = useState([new Date(`${initialDate}T12:00:00`).getDay()]);
  const [monthlyMode, setMonthlyMode] = useState<"DAY_OF_MONTH" | "WEEKDAY">("DAY_OF_MONTH");
  const [monthDay, setMonthDay] = useState(String(new Date(`${initialDate}T12:00:00`).getDate()));
  const [nth, setNth] = useState("1");
  const [weekday, setWeekday] = useState(String(new Date(`${initialDate}T12:00:00`).getDay()));
  const [endMode, setEndMode] = useState<"DATE" | "COUNT">("DATE");
  const [endDate, setEndDate] = useState(format(addMonths(new Date(`${initialDate}T12:00:00`), 1), "yyyy-MM-dd"));
  const [count, setCount] = useState("8");
  const [scope, setScope] = useState<BookingScope>("THIS");
  const [preview, setPreview] = useState<BookingPreview | null>(null);
  const [reviewedInput, setReviewedInput] = useState<BookingPlan | null>(null);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<NonNullable<BookingPlan["overrides"]>>([]);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState({ roomId: "", start: "09:00", end: "10:00" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE");
  const selectedRoom = rooms.find((room) => room.id === form.roomId);
  const maxEndDate = format(addMonths(new Date(`${form.date || today()}T12:00:00`), 6), "yyyy-MM-dd");

  function invalidate() { setPreview(null); setReviewedInput(null); setError(""); setExcludedDates([]); setOverrides([]); setEditingDate(null); }
  function setField(name: keyof typeof form, value: string) {
    invalidate();
    if (name === "date" && value) {
      const oldDay = new Date(`${form.date}T12:00:00`);
      const nextDay = new Date(`${value}T12:00:00`);
      if (selectedWeekdays.length === 1 && selectedWeekdays[0] === oldDay.getDay()) setSelectedWeekdays([nextDay.getDay()]);
      if (Number(monthDay) === oldDay.getDate()) setMonthDay(String(nextDay.getDate()));
      if (Number(weekday) === oldDay.getDay()) setWeekday(String(nextDay.getDay()));
      if (endDate < value) setEndDate(format(addMonths(nextDay, 1), "yyyy-MM-dd"));
    }
    setForm((current) => ({ ...current, [name]: value }));
  }
  function makeInput(): BookingPlan {
    const input: BookingPlan = { roomId: form.roomId, startTime: new Date(`${form.date}T${form.start}`).toISOString(), endTime: new Date(`${form.date}T${form.end}`).toISOString(), attendeeCount: Number(form.attendeeCount) };
    if (editing) return { ...input, scope };
    if (frequency !== "NONE") {
      input.recurrence = { frequency, interval: Number(interval), ...(endMode === "DATE" ? { endDate } : { count: Number(count) }) };
      if (frequency === "WEEKLY") input.recurrence.weekdays = selectedWeekdays;
      if (frequency === "MONTHLY") Object.assign(input.recurrence, monthlyMode === "DAY_OF_MONTH" ? { monthlyMode, monthDay: Number(monthDay) } : { monthlyMode, nth: Number(nth), weekday: Number(weekday) });
      input.excludedDates = excludedDates;
      input.overrides = overrides;
    }
    return input;
  }
  async function checkPreview(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setError(""); setBusy(true);
    try {
      if (!editing && frequency === "WEEKLY" && !selectedWeekdays.length) throw new Error("Chọn ít nhất một thứ trong tuần.");
      const input = makeInput();
      const result = await onPreview(input);
      setPreview(result); setReviewedInput(input); setNeedsRefresh(false); setEditingDate(null);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Không thể kiểm tra lịch họp."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!preview?.canConfirm || !reviewedInput || needsRefresh) return;
    setBusy(true); setError("");
    try { await onSubmit(reviewedInput); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Không thể lưu lịch họp."); setNeedsRefresh(true); }
    finally { setBusy(false); }
  }
  function toggleExcluded(date: string) {
    setExcludedDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date]);
    setNeedsRefresh(true); setError("");
  }
  const subtitle = editing ? "Chọn phạm vi thay đổi và kiểm tra lại phòng trước khi lưu." : "Chọn lịch họp và kiểm tra tất cả các buổi trước khi xác nhận.";
  return <Modal title={editing ? "Chỉnh sửa lịch đặt phòng" : "Đặt phòng họp"} subtitle={subtitle} className="booking-modal" onClose={() => { if (!busy) onClose(); }}>
    {!preview ? <form className="form-stack" onSubmit={checkPreview}>
      <fieldset className="booking-fields" disabled={busy}>
        {editing?.series && <label>Phạm vi chỉnh sửa<select value={scope} onChange={(event) => { invalidate(); const next = event.target.value as BookingScope; setScope(next); if (next !== "THIS") setForm((current) => ({ ...current, date: initialDate })); }}>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="form-hint">Với nhiều buổi, ngày họp được giữ nguyên; phòng, giờ và số người được áp dụng cho các buổi đã chọn.</span></label>}
        <label>Phòng họp<select required value={form.roomId} onChange={(event) => setField("roomId", event.target.value)}><option value="" disabled>Chọn phòng</option>{activeRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.location} · {room.capacity} chỗ</option>)}</select></label>
        <RoomNotes notes={selectedRoom?.notes ?? null} />
        <div className="form-row"><label>{editing && scope !== "THIS" ? "Buổi đang chọn" : "Ngày bắt đầu"}<input type="date" required min={editing ? undefined : today()} value={form.date} disabled={Boolean(editing && scope !== "THIS")} onChange={(event) => setField("date", event.target.value)} /></label><label>Số người tham dự<input type="number" min="1" max="500" required value={form.attendeeCount} onChange={(event) => setField("attendeeCount", event.target.value)} /></label></div>
        <div className="form-row"><label>Giờ bắt đầu<input type="time" required value={form.start} onChange={(event) => setField("start", event.target.value)} /></label><label>Giờ kết thúc<input type="time" required value={form.end} onChange={(event) => setField("end", event.target.value)} /></label></div>
        {!editing && <section className="recurrence-settings"><label>Lịch họp lặp lại<select value={frequency} onChange={(event) => { invalidate(); setFrequency(event.target.value as typeof frequency); }}>{Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {frequency !== "NONE" && <>
            <label>Lặp lại mỗi ({frequency === "DAILY" ? "ngày" : frequency === "WEEKLY" ? "tuần" : "tháng"})<input type="number" min="1" max="12" required value={interval} onChange={(event) => { invalidate(); setInterval(event.target.value); }} /></label>
            {frequency === "WEEKLY" && <fieldset className="weekday-picker"><legend>Chọn thứ trong tuần</legend><div>{weekdays.map((day) => <button key={day.value} type="button" aria-pressed={selectedWeekdays.includes(day.value)} onClick={() => { invalidate(); setSelectedWeekdays((current) => current.includes(day.value) ? current.filter((item) => item !== day.value) : [...current, day.value]); }}>{day.label}</button>)}</div></fieldset>}
            {frequency === "MONTHLY" && <><label>Cách lặp hàng tháng<select value={monthlyMode} onChange={(event) => { invalidate(); setMonthlyMode(event.target.value as typeof monthlyMode); }}><option value="DAY_OF_MONTH">Theo ngày trong tháng</option><option value="WEEKDAY">Theo thứ và tuần trong tháng</option></select></label>
              {monthlyMode === "DAY_OF_MONTH" ? <label>Ngày trong tháng<input type="number" min="1" max="31" required value={monthDay} onChange={(event) => { invalidate(); setMonthDay(event.target.value); }} /><span className="form-hint">Tháng không có ngày đã chọn (ví dụ ngày 31) sẽ được bỏ qua.</span></label> : <div className="form-row"><label>Tuần trong tháng<select value={nth} onChange={(event) => { invalidate(); setNth(event.target.value); }}><option value="1">Đầu tiên</option><option value="2">Thứ hai</option><option value="3">Thứ ba</option><option value="4">Thứ tư</option><option value="-1">Cuối cùng</option></select></label><label>Thứ<select value={weekday} onChange={(event) => { invalidate(); setWeekday(event.target.value); }}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label === "CN" ? "Chủ nhật" : `Thứ ${day.value + 1}`}</option>)}</select></label></div>}
            </>}
            <div className="form-row"><label>Kết thúc lặp lại<select value={endMode} onChange={(event) => { invalidate(); setEndMode(event.target.value as typeof endMode); }}><option value="DATE">Đến ngày</option><option value="COUNT">Sau số buổi họp</option></select></label>{endMode === "DATE" ? <label>Ngày kết thúc<input type="date" required min={form.date} max={maxEndDate} value={endDate} onChange={(event) => { invalidate(); setEndDate(event.target.value); }} /></label> : <label>Số buổi họp<input type="number" required min="1" max="200" value={count} onChange={(event) => { invalidate(); setCount(event.target.value); }} /></label>}</div>
            <p className="form-hint">Mỗi chuỗi có tối đa 200 buổi trong 6 tháng tính từ ngày bắt đầu.</p>
          </>}
        </section>}
      </fieldset>
      <p className="form-hint"><Clock3 size={14} /> Không giới hạn số giờ đặt trong ngày. Thời gian hiển thị theo múi giờ thiết bị.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>Hủy</button><button className="button button-primary" disabled={busy || !activeRooms.length}>{busy ? "Đang kiểm tra…" : "Xem trước và kiểm tra"}<ArrowRight size={16} /></button></div>
    </form> : <div className="booking-review">
      <div className="booking-review-summary"><CalendarCheck2 size={21} /><div><strong>{editing ? scopeLabels[scope] : frequencyLabels[frequency]}</strong><p>{preview.total} buổi · {preview.availableCount} hợp lệ · {preview.conflictCount} xung đột · {preview.excludedCount} bỏ qua</p></div></div>
      <p className="form-hint">Lịch được kiểm tra lại khi xác nhận. Nếu có xung đột, không có buổi nào được lưu.</p>
      {needsRefresh && <p className="preview-warning" role="status"><AlertCircle size={15} /> Có thay đổi chưa kiểm tra. Nhấn “Kiểm tra lại” trước khi xác nhận.</p>}
      {!editing && frequency !== "NONE" && preview.conflictCount > 0 && <button type="button" className="text-link" disabled={busy} onClick={() => { setExcludedDates((current) => [...new Set([...current, ...preview.occurrences.filter((item) => item.status === "CONFLICT").map((item) => item.date)])]); setNeedsRefresh(true); }}>Bỏ qua các ngày bị trùng</button>}
      <div className="booking-preview-list">{preview.occurrences.map((item) => <article className={`occurrence-row ${item.status.toLowerCase()}`} key={item.id ?? item.date}>
        <div className="occurrence-info"><strong>{dateLabel(item.date)}</strong><span>{item.roomName} · {localTime(item.startTime)}–{localTime(item.endTime)}</span><small>{item.status === "EXCLUDED" ? "Đã bỏ qua" : item.reason ?? "Phòng còn trống"}</small></div>
        {!editing && frequency !== "NONE" && <div className="occurrence-actions"><label><input type="checkbox" disabled={busy} checked={excludedDates.includes(item.date)} onChange={() => toggleExcluded(item.date)} /> Bỏ qua</label><button className="text-link" type="button" disabled={busy} onClick={() => { const override = overrides.find((value) => value.date === item.date); setEditingDate(item.date); setOverrideDraft({ roomId: override?.roomId ?? item.roomId, start: localTime(override?.startTime ?? item.startTime), end: localTime(override?.endTime ?? item.endTime) }); }}>Đổi phòng/giờ</button></div>}
        {editingDate === item.date && <div className="occurrence-editor form-stack"><label>Phòng cho ngày này<select value={overrideDraft.roomId} disabled={busy} onChange={(event) => setOverrideDraft((current) => ({ ...current, roomId: event.target.value }))}>{activeRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label><div className="form-row"><label>Bắt đầu<input type="time" value={overrideDraft.start} disabled={busy} onChange={(event) => setOverrideDraft((current) => ({ ...current, start: event.target.value }))} /></label><label>Kết thúc<input type="time" value={overrideDraft.end} disabled={busy} onChange={(event) => setOverrideDraft((current) => ({ ...current, end: event.target.value }))} /></label></div><div className="modal-actions"><button className="button button-outline button-small" type="button" onClick={() => setEditingDate(null)}>Đóng</button><button className="button button-primary button-small" type="button" disabled={busy || !overrideDraft.start || !overrideDraft.end} onClick={() => { try { const override = { date: item.date, roomId: overrideDraft.roomId, startTime: new Date(`${item.date}T${overrideDraft.start}`).toISOString(), endTime: new Date(`${item.date}T${overrideDraft.end}`).toISOString() }; setOverrides((current) => [...current.filter((value) => value.date !== item.date), override]); setEditingDate(null); setNeedsRefresh(true); } catch { setError("Giờ điều chỉnh chưa hợp lệ."); } }}>Áp dụng cho ngày này</button></div></div>}
      </article>)}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions review-actions"><button className="button button-outline" disabled={busy} onClick={() => { setPreview(null); setReviewedInput(null); setError(""); }}><ArrowLeft size={15} /> Sửa cấu hình</button><button className="button button-outline" disabled={busy || Boolean(editingDate)} onClick={() => void checkPreview()}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button><button className="button button-primary" disabled={busy || needsRefresh || !preview.canConfirm || Boolean(editingDate)} onClick={() => void confirm()}><Check size={15} />{busy ? "Đang xử lý…" : editing ? "Lưu thay đổi" : "Xác nhận đặt phòng"}</button></div>
    </div>}
  </Modal>;
}

export function CancelBookingModal({ booking, onClose, onSubmit }: { booking: Booking; onClose: () => void; onSubmit: (scope: BookingScope) => Promise<void> }) {
  const [scope, setScope] = useState<BookingScope>("THIS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSubmit(scope); } catch (problem) { setError(problem instanceof Error ? problem.message : "Không thể hủy lịch."); } finally { setBusy(false); }
  }
  return <Modal title="Hủy lịch đặt phòng" subtitle={`${booking.room.name} · ${dateLabel(format(new Date(booking.startTime), "yyyy-MM-dd"))}`} onClose={() => { if (!busy) onClose(); }}>
    <form className="form-stack" onSubmit={submit}>{booking.series ? <label>Phạm vi hủy<select value={scope} disabled={busy} onChange={(event) => setScope(event.target.value as BookingScope)}>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : <p>Bạn muốn hủy lượt đặt phòng này?</p>}<p className="form-hint">Lịch đã hủy vẫn được giữ trong lịch sử.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>Quay lại</button><button className="button button-primary" disabled={busy}>{busy ? "Đang hủy…" : "Xác nhận hủy"}</button></div></form>
  </Modal>;
}
