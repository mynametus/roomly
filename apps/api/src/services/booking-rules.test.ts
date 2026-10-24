import { describe, expect, it } from "vitest";
import { intervalsOverlap, validateBookingTime } from "./booking-rules.js";

const at = (time: string) => new Date(`2026-10-20T${time}:00.000+07:00`);

describe("booking business rules", () => {
  it("allows adjacent bookings without treating the shared boundary as overlap", () => {
    expect(intervalsOverlap(at("09:00"), at("10:00"), at("10:00"), at("11:00"))).toBe(false);
    expect(intervalsOverlap(at("09:00"), at("10:01"), at("10:00"), at("11:00"))).toBe(true);
  });

  it("accepts a full workday booking without a four-hour cap", () => {
    expect(validateBookingTime({ startTime: at("09:00"), endTime: at("17:00") })).toBe(480);
  });

  it("rejects a booking that ends before or at its start time", () => {
    expect(() => validateBookingTime({ startTime: at("10:00"), endTime: at("09:00") })).toThrow(
      "Giờ kết thúc phải sau giờ bắt đầu."
    );
    expect(() => validateBookingTime({ startTime: at("09:00"), endTime: at("09:00") })).toThrow(
      "Giờ kết thúc phải sau giờ bắt đầu."
    );
  });

  it("rejects a booking that crosses the business-day boundary", () => {
    expect(() => validateBookingTime({
      startTime: new Date("2026-10-20T16:30:00.000Z"),
      endTime: new Date("2026-10-20T17:30:00.000Z")
    })).toThrow("cùng một ngày");
  });
});
