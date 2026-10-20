import { describe, expect, it } from "vitest";
import { createWeeklyOccurrences, durationMinutes, getBusinessDayBounds, isSameBusinessDay } from "./time.js";

describe("business-time helpers", () => {
  it("creates the requested number of weekly occurrences", () => {
    const dates = createWeeklyOccurrences(new Date("2026-10-20T02:00:00.000Z"), 4);
    expect(dates).toHaveLength(4);
    expect(dates[3].toISOString()).toBe("2026-11-10T02:00:00.000Z");
  });

  it("uses the configured Vietnam calendar day for daily limits", () => {
    const first = new Date("2026-10-19T17:30:00.000Z");
    const second = new Date("2026-10-20T02:30:00.000Z");
    expect(isSameBusinessDay(first, second)).toBe(true);
    const bounds = getBusinessDayBounds(first);
    expect(bounds.start.toISOString()).toBe("2026-10-19T17:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-10-20T17:00:00.000Z");
  });

  it("calculates duration in minutes", () => {
    expect(durationMinutes(new Date("2026-10-20T01:00:00Z"), new Date("2026-10-20T02:30:00Z"))).toBe(90);
  });
});
