import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingsView, RoomsView } from "../../web/src/App.js";
import { BookingModal, CancelBookingModal, recurrenceLabel } from "../../web/src/components/BookingModal.js";
import type { Booking } from "../../web/src/types.js";

const room = { id: "room-1", name: "Meeting room", capacity: 10, location: "Floor 1", notes: null, amenities: [], status: "ACTIVE" as const };
const noop = () => {};

describe("room and booking controls by role", () => {
  it.each([{ rooms: [] }, { rooms: [room] }])("never offers room management to a user, including an empty catalog: $rooms", ({ rooms }) => {
    const markup = renderToStaticMarkup(createElement(RoomsView, {
      rooms, canManage: false, onCreate: noop, onEdit: noop, onUpdate: noop
    }));
    expect(markup).not.toContain("Thêm phòng");
    expect(markup).not.toContain("Chỉnh sửa");
    expect(markup).not.toContain("Ngừng sử dụng");
  });

  it("offers room creation and editing to administrators", () => {
    const markup = renderToStaticMarkup(createElement(RoomsView, {
      rooms: [room], canManage: true, onCreate: noop, onEdit: noop, onUpdate: noop
    }));
    expect(markup).toContain("Thêm phòng");
    expect(markup).toContain("Chỉnh sửa");
    expect(markup).toContain("Ngừng sử dụng");
  });

  it.each([false, true])("shows escaped multiline room notes for canManage=%s", (canManage) => {
    const markup = renderToStaticMarkup(createElement(RoomsView, {
      rooms: [{ ...room, notes: "Liên hệ lễ tân.\n<script>alert('x')</script>" }], canManage, onCreate: noop, onEdit: noop, onUpdate: noop
    }));
    expect(markup).toContain("Ghi chú");
    expect(markup).toContain("Liên hệ lễ tân.\n&lt;script&gt;");
    expect(markup).not.toContain("<script>");
  });

  it("does not show an empty notes section for rooms without notes", () => {
    const markup = renderToStaticMarkup(createElement(RoomsView, {
      rooms: [room], canManage: false, onCreate: noop, onEdit: noop, onUpdate: noop
    }));
    expect(markup).not.toContain('class="room-notes"');
  });

  it.each([false, true])("describes the correct booking scope with canManageAll=%s", (canManageAll) => {
    const markup = renderToStaticMarkup(createElement(BookingsView, {
      bookings: [], canManageAll, search: "", statusFilter: "ALL", onSearch: noop, onStatus: noop, onCancel: noop, onCreate: noop
    }));
    expect(markup).toContain(canManageAll ? "tất cả người dùng" : "của chính bạn");
    expect(markup).toContain(canManageAll ? "Quản lý đặt phòng" : "Đặt phòng của tôi");
  });

  it("offers daily, weekly and monthly choices and previews before confirmation", () => {
    const markup = renderToStaticMarkup(createElement(BookingModal, {
      rooms: [room], onClose: noop, onPreview: async () => ({ occurrences: [], total: 0, availableCount: 0, conflictCount: 0, excludedCount: 0, canConfirm: false }), onSubmit: async () => {}
    }));
    expect(markup).toContain("Một lần"); expect(markup).toContain("Hàng ngày"); expect(markup).toContain("Hàng tuần"); expect(markup).toContain("Hàng tháng");
    expect(markup).toContain("Xem trước và kiểm tra"); expect(markup).not.toContain("2 buổi hàng tuần");
  });

  it("offers all three series scopes and renders legacy and new series labels", () => {
    const booking: Booking = { id: "booking", roomId: room.id, userId: "member", startTime: "2026-10-26T09:00:00+07:00", endTime: "2026-10-26T10:00:00+07:00", attendeeCount: 4, status: "CONFIRMED", canceledAt: null, room, user: { id: "member", name: "Member", email: "member@example.com" }, series: { id: "series", recurrenceCount: 3 } };
    const markup = renderToStaticMarkup(createElement(CancelBookingModal, { booking, onClose: noop, onSubmit: async () => {} }));
    expect(markup).toContain("Chỉ buổi này"); expect(markup).toContain("Buổi này và các buổi sau"); expect(markup).toContain("Toàn bộ chuỗi");
    expect(recurrenceLabel(booking)).toBe("Hàng tuần · 3 buổi");
    expect(recurrenceLabel({ ...booking, series: { ...booking.series!, recurrence: { frequency: "DAILY", interval: 1, count: 3 } } })).toBe("Hàng ngày · 3 buổi");
  });
});
