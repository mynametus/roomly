import { BookingStatus, Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { intervalsOverlap, validateBookingTime } from "./booking-rules.js";
import { businessDate, generateOccurrenceStarts, onBusinessDate, type RecurrenceRule } from "./recurrence.js";
import { occurrenceUpdateStatement } from "./booking-update-sql.js";
import { acquireBookingLock } from "./booking-lock.js";

type BookingInput = { roomId: string; startTime: Date; endTime: Date; attendeeCount: number };
export type BookingScope = "THIS" | "FOLLOWING" | "ALL";
export type BookingPlanInput = BookingInput & {
  recurrence?: RecurrenceRule;
  recurrenceCount?: number;
  excludedDates?: string[];
  overrides?: { date: string; roomId?: string; startTime?: Date; endTime?: Date }[];
};
type PlannedOccurrence = BookingInput & { date: string; excluded: boolean; id?: string };
type BookingClient = Prisma.TransactionClient;
const bookingInclude = { room: true, user: { select: { id: true, name: true, email: true } }, series: { select: { id: true, recurrenceCount: true, recurrence: true } } } as const;

async function lockRooms(transaction: BookingClient, roomIds: string[]) {
  for (const roomId of [...new Set(roomIds)].sort()) {
    await acquireBookingLock(transaction, `room:${roomId}`);
  }
}

function createPlan(input: BookingPlanInput) {
  validateBookingTime(input);
  const recurrence = input.recurrence ?? (input.recurrenceCount ? {
    frequency: "WEEKLY" as const, interval: 1, count: input.recurrenceCount
  } : undefined);
  const starts = recurrence ? generateOccurrenceStarts(input.startTime, recurrence) : [input.startTime];
  const dates = new Set(starts.map(businessDate));
  const excluded = new Set(input.excludedDates ?? []);
  const overrides = new Map<string, NonNullable<BookingPlanInput["overrides"]>[number]>();
  for (const override of input.overrides ?? []) {
    if (!dates.has(override.date) || overrides.has(override.date)) throw new AppError("Ngày điều chỉnh bị lặp hoặc không thuộc chuỗi.");
    if ((override.startTime && businessDate(override.startTime) !== override.date) || (override.endTime && businessDate(override.endTime) !== override.date)) throw new AppError("Giờ điều chỉnh phải thuộc đúng ngày họp.");
    overrides.set(override.date, override);
  }
  if ([...excluded].some((date) => !dates.has(date))) throw new AppError("Ngày bỏ qua không thuộc chuỗi.");
  const occurrences: PlannedOccurrence[] = starts.map((startTime) => {
    const date = businessDate(startTime);
    const override = overrides.get(date);
    return { date, excluded: excluded.has(date), roomId: override?.roomId ?? input.roomId,
      startTime: override?.startTime ?? startTime, endTime: override?.endTime ?? onBusinessDate(input.endTime, date), attendeeCount: input.attendeeCount };
  });
  return { recurrence, occurrences };
}

async function inspectPlan(client: BookingClient, planned: PlannedOccurrence[], ignoreIds: string[] = []) {
  const included = planned.filter((item) => !item.excluded);
  const roomIds = [...new Set(planned.map((item) => item.roomId))];
  const rooms = await client.room.findMany({ where: { id: { in: roomIds } } });
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const existing = included.length ? await client.booking.findMany({ where: {
    roomId: { in: roomIds }, status: BookingStatus.CONFIRMED,
    ...(ignoreIds.length ? { id: { notIn: ignoreIds } } : {}),
    startTime: { lt: new Date(Math.max(...included.map((item) => item.endTime.getTime()))) },
    endTime: { gt: new Date(Math.min(...included.map((item) => item.startTime.getTime()))) }
  }, select: { id: true, roomId: true, startTime: true, endTime: true } }) : [];
  const occurrences = planned.map((item, index) => {
    const room = roomMap.get(item.roomId);
    let reason: string | undefined;
    if (!item.excluded) {
      try { validateBookingTime(item); } catch (error) { if (!(error instanceof AppError)) throw error; reason = error.message; }
      if (!reason && (!room || room.status !== "ACTIVE")) reason = "Phòng không tồn tại hoặc đang ngừng hoạt động.";
      if (!reason && room && item.attendeeCount > room.capacity) reason = `Phòng ${room.name} chỉ có sức chứa ${room.capacity} người.`;
      if (!reason && existing.some((booking) => booking.roomId === item.roomId && intervalsOverlap(item.startTime, item.endTime, booking.startTime, booking.endTime))) reason = "Phòng đã có lịch trong khoảng thời gian này.";
      if (!reason && included.some((other) => other !== item && other.roomId === item.roomId && intervalsOverlap(item.startTime, item.endTime, other.startTime, other.endTime))) reason = "Các buổi trong yêu cầu trùng thời gian với nhau.";
    }
    return { ...item, index, roomName: room?.name ?? "Không tìm thấy phòng", status: item.excluded ? "EXCLUDED" as const : reason ? "CONFLICT" as const : "AVAILABLE" as const, reason };
  });
  const availableCount = occurrences.filter((item) => item.status === "AVAILABLE").length;
  const conflictCount = occurrences.filter((item) => item.status === "CONFLICT").length;
  return { occurrences, total: occurrences.length, availableCount, conflictCount, excludedCount: planned.length - included.length, canConfirm: availableCount > 0 && conflictCount === 0 };
}

function assertCanSave(preview: Awaited<ReturnType<typeof inspectPlan>>) {
  if (preview.canConfirm) return;
  if (!preview.availableCount && !preview.conflictCount) throw new AppError("Cần giữ lại ít nhất một buổi họp.");
  throw new AppError("Có buổi họp chưa hợp lệ. Không có thay đổi nào được lưu.", 409, {
    failures: preview.occurrences.filter((item) => item.status === "CONFLICT").map((item) => ({ date: item.startTime.toISOString(), reason: item.reason }))
  });
}

export async function previewBookings(input: BookingPlanInput) { return inspectPlan(prisma, createPlan(input).occurrences); }

export async function createBooking(userId: string, input: BookingInput) {
  validateBookingTime(input);
  return prisma.$transaction(async (transaction) => {
    await lockRooms(transaction, [input.roomId]);
    const room = await transaction.room.findUnique({ where: { id: input.roomId } });
    if (!room || room.status !== "ACTIVE") throw new AppError("Phòng không tồn tại hoặc đang ngừng hoạt động.", 404);
    if (input.attendeeCount > room.capacity) throw new AppError(`Phòng ${room.name} chỉ có sức chứa ${room.capacity} người.`);
    const conflict = await transaction.booking.findFirst({ where: { roomId: input.roomId, status: BookingStatus.CONFIRMED, startTime: { lt: input.endTime }, endTime: { gt: input.startTime } }, select: { id: true } });
    if (conflict) throw new AppError("Phòng đã có lịch trong khoảng thời gian này.", 409);
    return transaction.booking.create({ data: { ...input, userId }, include: bookingInclude });
  });
}

export async function createRecurringBookings(userId: string, input: BookingPlanInput) {
  const plan = createPlan(input);
  if (!plan.recurrence) throw new AppError("Cần cấu hình lịch lặp lại.");
  const included = plan.occurrences.filter((item) => !item.excluded);
  return prisma.$transaction(async (transaction) => {
    await lockRooms(transaction, included.map((item) => item.roomId));
    assertCanSave(await inspectPlan(transaction, plan.occurrences));
    const series = await transaction.bookingSeries.create({ data: {
      userId, recurrenceCount: included.length,
      recurrence: JSON.parse(JSON.stringify({ ...plan.recurrence, excludedDates: input.excludedDates ?? [], overrides: input.overrides ?? [] })) as Prisma.InputJsonObject
    } });
    await transaction.booking.createMany({ data: included.map(({ roomId, startTime, endTime, attendeeCount }) => ({ seriesId: series.id, userId, roomId, startTime, endTime, attendeeCount })) });
    return transaction.booking.findMany({ where: { seriesId: series.id }, include: bookingInclude, orderBy: { startTime: "asc" } });
  }, { timeout: 30000 });
}

async function ownedBooking(client: BookingClient, bookingId: string, userId: string, isAdmin: boolean) {
  const booking = await client.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new AppError("Không tìm thấy lượt đặt.", 404);
  if (!isAdmin && booking.userId !== userId) throw new AppError("Bạn không có quyền quản lý lượt đặt này.", 403);
  return booking;
}

async function editPlan(client: BookingClient, bookingId: string, userId: string, isAdmin: boolean, input: BookingInput & { scope: BookingScope }) {
  validateBookingTime(input);
  const selected = await ownedBooking(client, bookingId, userId, isAdmin);
  if (selected.status === BookingStatus.CANCELLED) throw new AppError("Lượt đặt này đã được hủy.", 409);
  if (!selected.seriesId && input.scope !== "THIS") throw new AppError("Lượt đặt này không thuộc chuỗi định kỳ.");
  if (input.scope !== "THIS" && businessDate(input.startTime) !== businessDate(selected.startTime)) throw new AppError("Khi sửa nhiều buổi, hãy giữ ngày họp và chỉ thay đổi giờ, phòng hoặc số người.");
  const targets = input.scope === "THIS" ? [selected] : await client.booking.findMany({
    where: { seriesId: selected.seriesId, status: BookingStatus.CONFIRMED, ...(input.scope === "FOLLOWING" ? { startTime: { gte: selected.startTime } } : {}) }, orderBy: { startTime: "asc" }
  });
  const occurrences: PlannedOccurrence[] = targets.map((booking) => ({
    id: booking.id, date: input.scope === "THIS" ? businessDate(input.startTime) : businessDate(booking.startTime), excluded: false,
    roomId: input.roomId, attendeeCount: input.attendeeCount,
    startTime: input.scope === "THIS" ? input.startTime : onBusinessDate(input.startTime, businessDate(booking.startTime)),
    endTime: input.scope === "THIS" ? input.endTime : onBusinessDate(input.endTime, businessDate(booking.startTime))
  }));
  return { selected, occurrences };
}

export async function previewBookingUpdate(bookingId: string, userId: string, isAdmin: boolean, input: BookingInput & { scope: BookingScope }) {
  const plan = await editPlan(prisma, bookingId, userId, isAdmin, input);
  return inspectPlan(prisma, plan.occurrences, plan.occurrences.map((item) => item.id!));
}

export async function updateBooking(bookingId: string, userId: string, isAdmin: boolean, input: BookingInput & { scope: BookingScope }) {
  return prisma.$transaction(async (transaction) => {
    const selected = await ownedBooking(transaction, bookingId, userId, isAdmin);
    await acquireBookingLock(transaction, `series:${selected.seriesId ?? selected.id}`);
    const plan = await editPlan(transaction, bookingId, userId, isAdmin, input);
    await lockRooms(transaction, [selected.roomId, ...plan.occurrences.map((item) => item.roomId)]);
    assertCanSave(await inspectPlan(transaction, plan.occurrences, plan.occurrences.map((item) => item.id!)));
    await transaction.$executeRaw(occurrenceUpdateStatement(plan.occurrences.map((item) => ({ ...item, id: item.id! }))));
    return transaction.booking.findMany({ where: { id: { in: plan.occurrences.map((item) => item.id!) } }, include: bookingInclude, orderBy: { startTime: "asc" } });
  }, { timeout: 30000 });
}

export async function cancelBooking(bookingId: string, userId: string, isAdmin: boolean, scope: BookingScope | boolean = "THIS") {
  const actualScope = typeof scope === "boolean" ? scope ? "FOLLOWING" : "THIS" : scope;
  return prisma.$transaction(async (transaction) => {
    const initial = await ownedBooking(transaction, bookingId, userId, isAdmin);
    await acquireBookingLock(transaction, `series:${initial.seriesId ?? initial.id}`);
    const booking = await ownedBooking(transaction, bookingId, userId, isAdmin);
    if (booking.status === BookingStatus.CANCELLED) throw new AppError("Lượt đặt này đã được hủy.", 409);
    const canceledAt = new Date();
    let affectedCount = 1;
    if (actualScope !== "THIS" && booking.seriesId) {
      const result = await transaction.booking.updateMany({ where: {
        seriesId: booking.seriesId, ...(actualScope === "FOLLOWING" ? { startTime: { gte: booking.startTime } } : {}), status: BookingStatus.CONFIRMED
      }, data: { status: BookingStatus.CANCELLED, canceledAt } });
      affectedCount = result?.count ?? 1;
    } else await transaction.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED, canceledAt } });
    return { ...booking, status: BookingStatus.CANCELLED, canceledAt, affectedCount };
  });
}
