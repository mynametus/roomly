import { addDays, addWeeks, format } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const businessTimeZone = process.env.BUSINESS_TIME_ZONE ?? "Asia/Ho_Chi_Minh";

export function getBusinessDayBounds(date: Date): { start: Date; end: Date } {
  const day = formatInTimeZone(date, businessTimeZone, "yyyy-MM-dd");
  const start = fromZonedTime(`${day}T00:00:00`, businessTimeZone);
  const nextDay = format(addDays(new Date(`${day}T12:00:00.000Z`), 1), "yyyy-MM-dd");
  const end = fromZonedTime(`${nextDay}T00:00:00`, businessTimeZone);
  return { start, end };
}

export function createWeeklyOccurrences(startTime: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => addWeeks(startTime, index));
}

export function durationMinutes(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / 60_000;
}

export function isSameBusinessDay(first: Date, second: Date): boolean {
  return formatInTimeZone(first, businessTimeZone, "yyyy-MM-dd") ===
    formatInTimeZone(second, businessTimeZone, "yyyy-MM-dd");
}
