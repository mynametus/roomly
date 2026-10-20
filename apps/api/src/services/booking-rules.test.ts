import { describe, expect, it } from "vitest";
import { assertDailyLimit, intervalsOverlap, validateBookingTime } from "./booking-rules.js";

const at = (time: string) => new Date(`2026-10-20T${time}:00.000+07:00`);

describe("booking business rules", () => {
  it("allows adjacent bookings without treating the shared boundary as overlap", () => {
    expect(intervalsOverlap(at("09:00"), at("10:00"), at("10:00"), at("11:00"))).toBe(false);
    expect(intervalsOverlap(at("09:00"), at("10:01"), at("10:00"), at("11:00"))).toBe(true);
  });

  it("accepts a valid booking up to exactly four hours", () => {
    expect(validateBookingTime({ startTime: at("09:00"), endTime: at("13:00") })).toBe(240);
  });

  it("rejects a booking that ends before it starts or exceeds four hours", () => {
    expect(() => validateBookingTime({ startTime: at("10:00"), endTime: at("09:00") })).toThrow(
      "Giờ kết thúc phải sau giờ bắt đầu."
    );
    expect(() => validateBookingTime({ startTime: at("09:00"), endTime: at("13:01") })).toThrow(
      "không được dài quá 4 giờ"
    );
  });

  it("rejects a booking that crosses the business-day boundary", () => {
    expect(() => validateBookingTime({
      startTime: new Date("2026-10-20T16:30:00.000Z"),
      endTime: new Date("2026-10-20T17:30:00.000Z")
    })).toThrow("cùng một ngày");
  });

  it("counts confirmed bookings across rooms against the daily limit", () => {
    const previous = [{ startTime: at("09:00"), endTime: at("11:00") }];
    expect(() => assertDailyLimit(previous, 120)).not.toThrow();
    expect(() => assertDailyLimit(previous, 121)).toThrow("vượt quá 4 giờ");
  });
});
