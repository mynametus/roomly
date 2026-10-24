import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(), $executeRaw: vi.fn(),
  room: { findMany: vi.fn(), findUnique: vi.fn() },
  booking: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  bookingSeries: { create: vi.fn() }
}));
vi.mock("../lib/prisma.js", () => ({ prisma: mock }));
import { cancelBooking, createRecurringBookings, previewBookings, previewBookingUpdate, updateBooking } from "./booking-service.js";

type Entry = { id: string; userId: string; roomId: string; startTime: Date; endTime: Date; attendeeCount: number; seriesId: string | null; status: "CONFIRMED" | "CANCELLED" };
const entries: Entry[] = [];
const at = (day: string, time = "09:00") => new Date(`${day}T${time}:00+07:00`);
const input = () => ({ roomId: "room-1", startTime: at("2026-10-26"), endTime: at("2026-10-26", "17:00"), attendeeCount: 4, recurrence: { frequency: "DAILY" as const, interval: 1, count: 3 } });
const room = (id: string) => ({ id, name: id, capacity: 10, status: "ACTIVE" });
const seed = (id: string, day: string, extra: Partial<Entry> = {}): Entry => {
  const value: Entry = { id, userId: "member", roomId: "room-1", startTime: at(day), endTime: at(day, "10:00"), attendeeCount: 4, seriesId: "series-1", status: "CONFIRMED", ...extra };
  entries.push(value); return value;
};

function matches(entry: Entry, where: any): boolean {
  return (!where.id || (typeof where.id === "string" ? entry.id === where.id : where.id.in ? where.id.in.includes(entry.id) : !where.id.notIn.includes(entry.id))) &&
    (!where.seriesId || entry.seriesId === where.seriesId) && (!where.userId || entry.userId === where.userId) &&
    (!where.status || entry.status === where.status) &&
    (!where.roomId || (typeof where.roomId === "string" ? entry.roomId === where.roomId : where.roomId.in.includes(entry.roomId))) &&
    (!where.startTime?.lt || entry.startTime < where.startTime.lt) && (!where.startTime?.gte || entry.startTime >= where.startTime.gte) &&
    (!where.endTime?.gt || entry.endTime > where.endTime.gt);
}

describe("preview, conflict handling and series scopes", () => {
  beforeEach(() => {
    vi.resetAllMocks(); entries.length = 0;
    mock.$transaction.mockImplementation(async (callback) => {
      const before = structuredClone(entries);
      try { return await callback(mock); } catch (error) { entries.splice(0, entries.length, ...before); throw error; }
    });
    mock.room.findMany.mockImplementation(async ({ where }) => where.id.in.map(room));
    mock.room.findUnique.mockImplementation(async ({ where }) => room(where.id));
    mock.booking.findMany.mockImplementation(async ({ where }) => entries.filter((entry) => matches(entry, where)).sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
    mock.booking.findUnique.mockImplementation(async ({ where }) => entries.find((entry) => entry.id === where.id) ?? null);
    mock.booking.findFirst.mockImplementation(async ({ where }) => entries.find((entry) => matches(entry, where)) ?? null);
    mock.booking.createMany.mockImplementation(async ({ data }) => {
      for (const value of data) entries.push({ ...value, id: `new-${entries.length}`, status: "CONFIRMED" });
      return { count: data.length };
    });
    mock.bookingSeries.create.mockResolvedValue({ id: "new-series" });
    mock.$executeRaw.mockImplementation(async (statement) => {
      const values = statement.values;
      for (let index = 0; index < values.length; index += 5) {
        const entry = entries.find((entry) => entry.id === values[index])!;
        Object.assign(entry, { roomId: values[index + 1], startTime: new Date(values[index + 2]), endTime: new Date(values[index + 3]), attendeeCount: values[index + 4] });
      }
      return values.length / 5;
    });
    mock.booking.update.mockImplementation(async ({ where, data }) => {
      const entry = entries.find((entry) => entry.id === where.id)!; Object.assign(entry, data); return entry;
    });
    mock.booking.updateMany.mockImplementation(async ({ where, data }) => {
      const selected = entries.filter((entry) => matches(entry, where)); selected.forEach((entry) => Object.assign(entry, data)); return { count: selected.length };
    });
  });

  it("previews all dates without writing anything or exposing another user's identity", async () => {
    seed("busy", "2026-10-27", { userId: "another-user", seriesId: null });
    const preview = await previewBookings(input());
    expect(preview.occurrences.map((entry) => entry.status)).toEqual(["AVAILABLE", "CONFLICT", "AVAILABLE"]);
    expect(preview.canConfirm).toBe(false);
    expect(JSON.stringify(preview)).not.toContain("another-user");
    expect(mock.booking.createMany).not.toHaveBeenCalled();
  });

  it("does not create any meetings when one occurrence conflicts", async () => {
    seed("busy", "2026-10-27");
    await expect(createRecurringBookings("member", input())).rejects.toMatchObject({ statusCode: 409 });
    expect(mock.bookingSeries.create).not.toHaveBeenCalled(); expect(entries).toHaveLength(1);
  });

  it("lets a user exclude just a conflicting date", async () => {
    seed("busy", "2026-10-27");
    const plan = { ...input(), excludedDates: ["2026-10-27"] };
    const preview = await previewBookings(plan);
    expect(preview.canConfirm).toBe(true); expect(preview.excludedCount).toBe(1);
    const created = await createRecurringBookings("member", plan);
    expect(created).toHaveLength(2);
    expect(mock.bookingSeries.create.mock.calls[0][0].data.recurrenceCount).toBe(2);
    expect(created.some((entry) => entry.startTime.getTime() === at("2026-10-27").getTime())).toBe(false);
  });

  it("supports another room and time on one date and locks affected rooms in order", async () => {
    seed("busy", "2026-10-27");
    const plan = { ...input(), overrides: [{ date: "2026-10-27", roomId: "room-2", startTime: at("2026-10-27", "11:00"), endTime: at("2026-10-27", "12:00") }] };
    const created = await createRecurringBookings("member", plan);
    expect(created).toHaveLength(3);
    expect(created[1]).toMatchObject({ roomId: "room-2", startTime: at("2026-10-27", "11:00") });
    expect(mock.$queryRaw.mock.calls.map((call) => call[1])).toEqual(["room:room-1", "room:room-2"]);
  });

  it("rechecks conflicts at confirmation after a successful preview", async () => {
    expect((await previewBookings(input())).canConfirm).toBe(true);
    seed("new-conflict", "2026-10-28");
    await expect(createRecurringBookings("member", input())).rejects.toMatchObject({ statusCode: 409 });
    expect(mock.bookingSeries.create).not.toHaveBeenCalled();
  });

  it("does not allow skipping every occurrence", async () => {
    const plan = { ...input(), excludedDates: ["2026-10-26", "2026-10-27", "2026-10-28"] };
    expect((await previewBookings(plan)).canConfirm).toBe(false);
    await expect(createRecurringBookings("member", plan)).rejects.toThrow("ít nhất một buổi");
  });

  it("creates and edits a long daily series using batched writes", async () => {
    const created = await createRecurringBookings("member", { ...input(), recurrence: { frequency: "DAILY", interval: 1, count: 180 } });
    expect(created).toHaveLength(180);
    expect(mock.booking.createMany).toHaveBeenCalledTimes(1);
    const changed = await updateBooking(created[0].id, "member", false, {
      roomId: "room-2", startTime: at("2026-10-26", "11:00"), endTime: at("2026-10-26", "18:00"), attendeeCount: 8, scope: "ALL"
    });
    expect(changed).toHaveLength(180);
    expect(mock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(changed.every((entry) => entry.roomId === "room-2" && entry.attendeeCount === 8 && entry.startTime.getUTCHours() === 4)).toBe(true);
  });

  it("rejects exceptions outside the generated dates and duplicate overrides", async () => {
    await expect(previewBookings({ ...input(), excludedDates: ["2026-11-01"] })).rejects.toThrow("không thuộc chuỗi");
    await expect(previewBookings({ ...input(), overrides: [{ date: "2026-10-26" }, { date: "2026-10-26" }] })).rejects.toThrow("bị lặp");
    await expect(previewBookings({ ...input(), overrides: [{ date: "2026-10-26", startTime: at("2026-10-27") }] })).rejects.toThrow("đúng ngày");
  });

  it("marks invalid room capacity, room status and overridden times as conflicts", async () => {
    mock.room.findMany.mockResolvedValue([{ ...room("room-1"), capacity: 2 }]);
    expect((await previewBookings(input())).conflictCount).toBe(3);
    mock.room.findMany.mockResolvedValue([{ ...room("room-1"), status: "INACTIVE" }]);
    expect((await previewBookings(input())).conflictCount).toBe(3);
    mock.room.findMany.mockResolvedValue([room("room-1")]);
    const preview = await previewBookings({ ...input(), overrides: [{ date: "2026-10-26", endTime: at("2026-10-26", "08:00") }] });
    expect(preview.occurrences[0].reason).toContain("sau giờ bắt đầu");
  });

  it.each([{ scope: "THIS" as const, affected: ["two"] }, { scope: "FOLLOWING" as const, affected: ["two", "three"] }, { scope: "ALL" as const, affected: ["one", "two", "three"] }])("edits exactly the selected $scope scope", async ({ scope, affected }) => {
    seed("one", "2026-10-26"); seed("two", "2026-10-27"); seed("three", "2026-10-28");
    const change = { roomId: "room-2", startTime: at("2026-10-27", "11:00"), endTime: at("2026-10-27", "18:00"), attendeeCount: 8, scope };
    const preview = await previewBookingUpdate("two", "member", false, change);
    expect(preview.canConfirm).toBe(true); expect(preview.total).toBe(affected.length);
    await updateBooking("two", "member", false, change);
    expect(entries.filter((entry) => entry.roomId === "room-2").map((entry) => entry.id)).toEqual(affected);
    expect(entries.map((entry) => entry.startTime.toISOString().slice(0, 10))).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
  });

  it("ignores the selected meetings' old slots but prevents a conflicting edit from saving partially", async () => {
    seed("one", "2026-10-26"); seed("two", "2026-10-27");
    seed("other", "2026-10-27", { roomId: "room-2", seriesId: null, userId: "another-user" });
    const change = { roomId: "room-2", startTime: at("2026-10-26"), endTime: at("2026-10-26", "10:00"), attendeeCount: 4, scope: "ALL" as const };
    await expect(updateBooking("one", "member", false, change)).rejects.toMatchObject({ statusCode: 409 });
    expect(mock.booking.update).not.toHaveBeenCalled();
    expect(mock.$executeRaw).not.toHaveBeenCalled();
    expect(entries.slice(0, 2).every((entry) => entry.roomId === "room-1")).toBe(true);
    const unchanged = await previewBookingUpdate("one", "member", false, { ...change, roomId: "room-1" });
    expect(unchanged.canConfirm).toBe(true);
  });

  it("does not change already-cancelled occurrences during a series edit", async () => {
    seed("one", "2026-10-26"); seed("two", "2026-10-27", { status: "CANCELLED" });
    await updateBooking("one", "member", false, { roomId: "room-2", startTime: at("2026-10-26"), endTime: at("2026-10-26", "10:00"), attendeeCount: 4, scope: "ALL" });
    expect(entries[1].roomId).toBe("room-1"); expect(entries[1].status).toBe("CANCELLED");
  });

  it("enforces ownership for editing and preview, and allows administrators", async () => {
    seed("other", "2026-10-26", { userId: "another-user" });
    const change = { roomId: "room-2", startTime: at("2026-10-26"), endTime: at("2026-10-26", "10:00"), attendeeCount: 4, scope: "THIS" as const };
    await expect(previewBookingUpdate("other", "member", false, change)).rejects.toMatchObject({ statusCode: 403 });
    await expect(updateBooking("other", "member", false, change)).rejects.toMatchObject({ statusCode: 403 });
    await expect(updateBooking("other", "admin", true, change)).resolves.toHaveLength(1);
  });

  it.each([{ scope: "THIS" as const, cancelled: ["two"] }, { scope: "FOLLOWING" as const, cancelled: ["two", "three"] }, { scope: "ALL" as const, cancelled: ["one", "two", "three"] }])("cancels exactly the selected $scope scope", async ({ scope, cancelled }) => {
    seed("one", "2026-10-26"); seed("two", "2026-10-27"); seed("three", "2026-10-28"); seed("another-series", "2026-11-01", { seriesId: "series-2" });
    const result = await cancelBooking("two", "member", false, scope);
    expect(result.status).toBe("CANCELLED"); expect(result.affectedCount).toBe(cancelled.length);
    expect(entries.filter((entry) => entry.status === "CANCELLED").map((entry) => entry.id)).toEqual(cancelled);
  });
});
