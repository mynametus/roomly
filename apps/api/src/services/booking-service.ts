import { BookingStatus, Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertDailyLimit, validateBookingTime } from "./booking-rules.js";
import {
  createWeeklyOccurrences,
  durationMinutes,
  getBusinessDayBounds
} from "../lib/time.js";

type BookingInput = {
  roomId: string;
  startTime: Date;
  endTime: Date;
  attendeeCount: number;
};

type BookingClient = Prisma.TransactionClient;

async function lockBookingResources(
  transaction: BookingClient,
  userId: string,
  roomId: string
): Promise<void> {
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`room:${roomId}`}))`;
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`user:${userId}`}))`;
}

async function validateOccurrence(
  transaction: BookingClient,
  userId: string,
  input: BookingInput
): Promise<void> {
  const room = await transaction.room.findUnique({ where: { id: input.roomId } });
  if (!room || room.status !== "ACTIVE") {
    throw new AppError("Phòng không tồn tại hoặc đang ngừng hoạt động.", 404);
  }
  if (input.attendeeCount > room.capacity) {
    throw new AppError(`Phòng ${room.name} chỉ có sức chứa ${room.capacity} người.`);
  }

  const conflict = await transaction.booking.findFirst({
    where: {
      roomId: input.roomId,
      status: BookingStatus.CONFIRMED,
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime }
    },
    select: { id: true }
  });
  if (conflict) {
    throw new AppError("Phòng đã có lịch trong khoảng thời gian này.", 409);
  }

  const bounds = getBusinessDayBounds(input.startTime);
  const sameDayBookings = await transaction.booking.findMany({
    where: {
      userId,
      status: BookingStatus.CONFIRMED,
      startTime: { gte: bounds.start, lt: bounds.end }
    },
    select: { startTime: true, endTime: true }
  });
  assertDailyLimit(sameDayBookings, validateBookingTime(input));
}

export async function createBooking(userId: string, input: BookingInput) {
  validateBookingTime(input);
  return prisma.$transaction(async (transaction) => {
    await lockBookingResources(transaction, userId, input.roomId);
    await validateOccurrence(transaction, userId, input);
    return transaction.booking.create({
      data: { ...input, userId },
      include: { room: true, user: { select: { id: true, name: true, email: true } } }
    });
  });
}

export async function createRecurringBookings(
  userId: string,
  input: BookingInput & { recurrenceCount: number }
) {
  validateBookingTime(input);
  const occurrences = createWeeklyOccurrences(input.startTime, input.recurrenceCount);
  return prisma.$transaction(async (transaction) => {
    await lockBookingResources(transaction, userId, input.roomId);
    const failures: { date: string; reason: string }[] = [];
    for (const startTime of occurrences) {
      const occurrence = {
        ...input,
        startTime,
        endTime: new Date(startTime.getTime() + durationMinutes(input.startTime, input.endTime) * 60_000)
      };
      try {
        await validateOccurrence(transaction, userId, occurrence);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        failures.push({
          date: startTime.toISOString(),
          reason: error.message
        });
      }
    }
    if (failures.length) {
      throw new AppError(
        "Không thể tạo chuỗi đặt phòng. Không có buổi nào được lưu.",
        409,
        { failures }
      );
    }

    const series = await transaction.bookingSeries.create({
      data: { userId, recurrenceCount: input.recurrenceCount }
    });
    const bookings = await Promise.all(
      occurrences.map((startTime) => {
        const endTime = new Date(
          startTime.getTime() + durationMinutes(input.startTime, input.endTime) * 60_000
        );
        return transaction.booking.create({
          data: {
            seriesId: series.id,
            userId,
            roomId: input.roomId,
            startTime,
            endTime,
            attendeeCount: input.attendeeCount
          },
          include: { room: true, user: { select: { id: true, name: true, email: true } } }
        });
      })
    );
    return bookings;
  });
}

export async function cancelBooking(
  bookingId: string,
  userId: string,
  isAdmin: boolean,
  cancelFrom = false
) {
  return prisma.$transaction(async (transaction) => {
    const booking = await transaction.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new AppError("Không tìm thấy lượt đặt.", 404);
    if (!isAdmin && booking.userId !== userId) {
      throw new AppError("Bạn không có quyền hủy lượt đặt này.", 403);
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError("Lượt đặt này đã được hủy.", 409);
    }

    if (cancelFrom && booking.seriesId) {
      await transaction.booking.updateMany({
        where: {
          seriesId: booking.seriesId,
          startTime: { gte: booking.startTime },
          status: BookingStatus.CONFIRMED
        },
        data: { status: BookingStatus.CANCELLED, canceledAt: new Date() }
      });
    } else {
      await transaction.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, canceledAt: new Date() }
      });
    }
    return booking;
  });
}
