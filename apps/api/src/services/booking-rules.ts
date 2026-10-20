import { AppError } from "../lib/errors.js";
import { durationMinutes, isSameBusinessDay } from "../lib/time.js";

export type TimedBooking = { startTime: Date; endTime: Date };

export function validateBookingTime(booking: TimedBooking): number {
  if (booking.endTime <= booking.startTime) {
    throw new AppError("Giờ kết thúc phải sau giờ bắt đầu.");
  }
  if (!isSameBusinessDay(booking.startTime, booking.endTime)) {
    throw new AppError("Một lượt đặt phải bắt đầu và kết thúc trong cùng một ngày.");
  }
  const minutes = durationMinutes(booking.startTime, booking.endTime);
  if (minutes > 240) {
    throw new AppError("Mỗi lượt đặt không được dài quá 4 giờ.");
  }
  return minutes;
}

export function assertDailyLimit(
  existingBookings: TimedBooking[],
  requestedMinutes: number
): void {
  const usedMinutes = existingBookings.reduce(
    (total, booking) => total + durationMinutes(booking.startTime, booking.endTime),
    0
  );
  if (usedMinutes + requestedMinutes > 240) {
    throw new AppError("Tổng thời gian đặt của bạn trong ngày sẽ vượt quá 4 giờ.", 409);
  }
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
): boolean {
  return firstStart < secondEnd && firstEnd > secondStart;
}
