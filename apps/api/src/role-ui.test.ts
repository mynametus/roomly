import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingsView, RoomsView } from "../../web/src/App.js";

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
});
