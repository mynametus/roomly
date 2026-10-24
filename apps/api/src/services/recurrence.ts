import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { AppError } from "../lib/errors.js";
import { businessTimeZone } from "../lib/time.js";

export type RecurrenceRule = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  weekdays?: number[];
  monthlyMode?: "DAY_OF_MONTH" | "WEEKDAY";
  monthDay?: number;
  nth?: number;
  weekday?: number;
  endDate?: string;
  count?: number;
};

export const MAX_OCCURRENCES = 200;
export const businessDate = (date: Date) => formatInTimeZone(date, businessTimeZone, "yyyy-MM-dd");
export const onBusinessDate = (reference: Date, day: string) =>
  fromZonedTime(`${day}T${formatInTimeZone(reference, businessTimeZone, "HH:mm:ss.SSS")}`, businessTimeZone);

function calendarDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function sixMonthsAfter(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result;
}

export function generateOccurrenceStarts(startTime: Date, rule: RecurrenceRule): Date[] {
  const first = calendarDate(businessDate(startTime));
  const horizon = sixMonthsAfter(first);
  const last = rule.endDate ? calendarDate(rule.endDate) : horizon;
  if (last < first) throw new AppError("Ngày kết thúc chuỗi phải bằng hoặc sau ngày bắt đầu.");
  if (last > horizon) throw new AppError("Một chuỗi đặt phòng chỉ được kéo dài tối đa 6 tháng.");
  if (!rule.endDate && !rule.count) throw new AppError("Cần chọn ngày kết thúc hoặc số buổi họp.");
  if (rule.endDate && rule.count) throw new AppError("Chỉ chọn một cách kết thúc chuỗi.");
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 12) throw new AppError("Chu kỳ lặp phải từ 1 đến 12.");
  if (rule.count && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > MAX_OCCURRENCES)) throw new AppError("Một chuỗi chỉ được có tối đa 200 buổi.");
  const weekdays = rule.weekdays ?? [first.getUTCDay()];
  if (rule.frequency === "WEEKLY" && (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new AppError("Chọn ít nhất một thứ trong tuần.");
  const firstWeekOffset = (first.getUTCDay() + 6) % 7;
  const result: Date[] = [];
  for (const day = new Date(first); day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    const distance = Math.round((day.getTime() - first.getTime()) / 86_400_000);
    const months = (day.getUTCFullYear() - first.getUTCFullYear()) * 12 + day.getUTCMonth() - first.getUTCMonth();
    let matches = false;
    if (rule.frequency === "DAILY") matches = distance % rule.interval === 0;
    if (rule.frequency === "WEEKLY") matches = Math.floor((distance + firstWeekOffset) / 7) % rule.interval === 0 && weekdays.includes(day.getUTCDay());
    if (rule.frequency === "MONTHLY" && months % rule.interval === 0) {
      if (rule.monthlyMode === "WEEKDAY") {
        const weekday = rule.weekday ?? first.getUTCDay();
        const nth = rule.nth ?? 1;
        const nextWeek = new Date(day);
        nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
        matches = day.getUTCDay() === weekday && (nth === -1 ? nextWeek.getUTCMonth() !== day.getUTCMonth() : Math.floor((day.getUTCDate() - 1) / 7) + 1 === nth);
      } else matches = day.getUTCDate() === (rule.monthDay ?? first.getUTCDate());
    }
    if (matches) {
      result.push(onBusinessDate(startTime, day.toISOString().slice(0, 10)));
      if (result.length > MAX_OCCURRENCES) throw new AppError("Một chuỗi chỉ được có tối đa 200 buổi.");
      if (rule.count && result.length === rule.count) break;
    }
  }
  if (!result.length) throw new AppError("Không có ngày họp phù hợp trong khoảng đã chọn.");
  if (rule.count && result.length < rule.count) throw new AppError("Số buổi đã chọn vượt phạm vi 6 tháng. Hãy giảm số buổi hoặc chu kỳ lặp.");
  return result;
}
