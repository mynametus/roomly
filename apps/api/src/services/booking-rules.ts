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
  return durationMinutes(booking.startTime, booking.endTime);
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
): boolean {
  return firstStart < secondEnd && firstEnd > secondStart;
}
