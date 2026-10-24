import { describe, expect, it } from "vitest";
import { recurrenceRuleSchema } from "../lib/validation.js";
import { businessDate, generateOccurrenceStarts, type RecurrenceRule } from "./recurrence.js";

const at = (day: string) => new Date(`${day}T09:00:00+07:00`);
const dates = (start: string, rule: RecurrenceRule) => generateOccurrenceStarts(at(start), rule).map(businessDate);

describe("bounded recurring calendar dates", () => {
  it("creates daily meetings with an inclusive end date", () => {
    expect(dates("2026-10-20", { frequency: "DAILY", interval: 1, endDate: "2026-10-22" })).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
  });
  it("respects a daily interval and count", () => {
    expect(dates("2026-10-20", { frequency: "DAILY", interval: 2, count: 3 })).toEqual(["2026-10-20", "2026-10-22", "2026-10-24"]);
  });
  it("supports multiple weekdays without including dates before the start", () => {
    expect(dates("2026-10-20", { frequency: "WEEKLY", interval: 1, weekdays: [1, 3, 5], count: 4 })).toEqual(["2026-10-21", "2026-10-23", "2026-10-26", "2026-10-28"]);
  });
  it("anchors multi-week intervals to the starting calendar week", () => {
    expect(dates("2026-10-20", { frequency: "WEEKLY", interval: 2, weekdays: [2, 4], count: 4 })).toEqual(["2026-10-20", "2026-10-22", "2026-11-03", "2026-11-05"]);
  });
  it("keeps the legacy weekly count on the starting weekday", () => {
    expect(dates("2026-10-20", { frequency: "WEEKLY", interval: 1, count: 3 })).toEqual(["2026-10-20", "2026-10-27", "2026-11-03"]);
  });
  it("skips shorter months rather than moving a day-31 meeting", () => {
    expect(dates("2027-01-31", { frequency: "MONTHLY", interval: 1, monthDay: 31, count: 4 })).toEqual(["2027-01-31", "2027-03-31", "2027-05-31", "2027-07-31"]);
  });
  it("includes February 29 in leap years", () => {
    expect(dates("2028-01-29", { frequency: "MONTHLY", interval: 1, monthDay: 29, count: 3 })).toEqual(["2028-01-29", "2028-02-29", "2028-03-29"]);
  });
  it("starts a day-of-month rule at its next matching date", () => {
    expect(dates("2026-10-20", { frequency: "MONTHLY", interval: 1, monthDay: 15, count: 3 })).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
  });
  it("supports the first Monday of each month", () => {
    expect(dates("2026-10-26", { frequency: "MONTHLY", interval: 1, monthlyMode: "WEEKDAY", nth: 1, weekday: 1, count: 3 })).toEqual(["2026-11-02", "2026-12-07", "2027-01-04"]);
  });
  it("supports the last Friday of each month", () => {
    expect(dates("2026-10-01", { frequency: "MONTHLY", interval: 1, monthlyMode: "WEEKDAY", nth: -1, weekday: 5, count: 3 })).toEqual(["2026-10-30", "2026-11-27", "2026-12-25"]);
  });
  it("preserves wall-clock time and milliseconds in the business timezone", () => {
    const result = generateOccurrenceStarts(new Date("2026-10-20T09:30:00.123+07:00"), { frequency: "DAILY", interval: 1, count: 2 });
    expect(result[1].toISOString()).toBe("2026-10-21T02:30:00.123Z");
  });
  it("accepts exactly six months but rejects a longer range", () => {
    expect(dates("2026-10-20", { frequency: "MONTHLY", interval: 1, endDate: "2027-04-20" })).toHaveLength(7);
    expect(() => dates("2026-10-20", { frequency: "DAILY", interval: 1, endDate: "2027-04-21" })).toThrow("6 tháng");
  });
  it("rejects a requested count that cannot fit within six months", () => {
    expect(() => dates("2026-10-20", { frequency: "DAILY", interval: 1, count: 200 })).toThrow("6 tháng");
  });
  it("rejects a range without any selected meeting day", () => {
    expect(() => dates("2026-10-20", { frequency: "WEEKLY", interval: 1, weekdays: [1], endDate: "2026-10-20" })).toThrow("Không có ngày họp");
  });
  it("rejects missing or ambiguous stopping conditions", () => {
    expect(recurrenceRuleSchema.safeParse({ frequency: "DAILY" }).success).toBe(false);
    expect(recurrenceRuleSchema.safeParse({ frequency: "DAILY", count: 3, endDate: "2026-11-01" }).success).toBe(false);
  });
  it("requires weekly days and valid monthly weekday configuration", () => {
    expect(recurrenceRuleSchema.safeParse({ frequency: "WEEKLY", count: 3, weekdays: [] }).success).toBe(false);
    expect(recurrenceRuleSchema.safeParse({ frequency: "MONTHLY", count: 3, monthlyMode: "WEEKDAY", nth: 0, weekday: 1 }).success).toBe(false);
    expect(recurrenceRuleSchema.safeParse({ frequency: "MONTHLY", count: 3, monthlyMode: "WEEKDAY" }).success).toBe(false);
  });
});
