import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, transactionMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
  transactionMock: {
    $queryRaw: vi.fn(),
    room: { findUnique: vi.fn(), findMany: vi.fn() },
    booking: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
    bookingSeries: { create: vi.fn() }
  }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { createBooking, createRecurringBookings } from "./booking-service.js";

type SavedBooking = {
  id: string;
  userId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  attendeeCount: number;
  seriesId?: string;
};

const at = (time: string, day = "2026-10-20") => new Date(`${day}T${time}:00+07:00`);
const input = (start: string, end: string, roomId = "room-1") => ({
  roomId, startTime: at(start), endTime: at(end), attendeeCount: 4
});
const saved: SavedBooking[] = [];

describe("booking duration without daily limits", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    saved.length = 0;
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transactionMock));
    transactionMock.room.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id, name: "Meeting room", status: "ACTIVE", capacity: 10
    }));
    transactionMock.room.findMany.mockImplementation(async ({ where }) => where.id.in.map((id: string) => ({ id, name: "Meeting room", status: "ACTIVE", capacity: 10 })));
    transactionMock.booking.findFirst.mockImplementation(async ({ where }) => saved.find((booking) =>
      booking.roomId === where.roomId && booking.startTime < where.startTime.lt && booking.endTime > where.endTime.gt
    ) ?? null);
    transactionMock.booking.findMany.mockImplementation(async ({ where }) => saved.filter((booking) =>
      where.seriesId ? booking.seriesId === where.seriesId : where.roomId.in.includes(booking.roomId) && booking.startTime < where.startTime.lt && booking.endTime > where.endTime.gt
    ));
    transactionMock.booking.create.mockImplementation(async ({ data }) => {
      const booking = { ...data, id: `booking-${saved.length + 1}` };
      saved.push(booking);
      return booking;
    });
    transactionMock.booking.createMany.mockImplementation(async ({ data }) => {
      for (const row of data) saved.push({ ...row, id: `booking-${saved.length + 1}` });
      return { count: data.length };
    });
    transactionMock.bookingSeries.create.mockResolvedValue({ id: "series-1" });
  });

  it("creates an eight-hour booking", async () => {
    const booking = await createBooking("member", input("09:00", "17:00"));
    expect(booking.endTime.getTime() - booking.startTime.getTime()).toBe(8 * 60 * 60 * 1000);
    expect(saved).toHaveLength(1);
  });

  it.each(["room-1", "room-2"])("allows the same user to book more than four hours in a day with a second booking in %s", async (roomId) => {
    await createBooking("member", input("09:00", "12:00"));
    await createBooking("member", input("12:00", "15:00", roomId));
    expect(saved).toHaveLength(2);
    expect(saved.every((booking) => booking.userId === "member")).toBe(true);
  });

  it("creates weekly bookings lasting eight hours each", async () => {
    const bookings = await createRecurringBookings("member", { ...input("09:00", "17:00"), recurrenceCount: 2 });
    expect(bookings).toHaveLength(2);
    expect(bookings.map((booking) => booking.startTime)).toEqual([at("09:00"), at("09:00", "2026-10-27")]);
    expect(bookings.every((booking) => booking.endTime.getTime() - booking.startTime.getTime() === 8 * 60 * 60 * 1000)).toBe(true);
  });

  it("allows recurring bookings that bring the user's daily total above four hours", async () => {
    for (const day of ["2026-10-20", "2026-10-27"]) {
      await createBooking("member", { ...input("09:00", "12:00", "room-2"), startTime: at("09:00", day), endTime: at("12:00", day) });
    }
    const bookings = await createRecurringBookings("member", { ...input("13:00", "15:00"), recurrenceCount: 2 });
    expect(bookings).toHaveLength(2);
    expect(saved).toHaveLength(4);
  });

  it("still prevents overlapping bookings in the same room", async () => {
    await createBooking("another-member", input("12:00", "13:00"));
    await expect(createBooking("member", input("09:00", "17:00"))).rejects.toThrow("Phòng đã có lịch");
    expect(saved).toHaveLength(1);
  });

  it("still enforces room capacity for long bookings", async () => {
    await expect(createBooking("member", { ...input("09:00", "17:00"), attendeeCount: 11 }))
      .rejects.toThrow("chỉ có sức chứa 10 người");
    expect(saved).toHaveLength(0);
  });
});
