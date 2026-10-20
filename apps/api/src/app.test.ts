import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./application.js";

describe("Roomly API", () => {
  it("exposes a health endpoint without authentication", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("requires authentication to access bookings", async () => {
    const response = await request(app).get("/api/bookings");
    expect(response.status).toBe(401);
    expect(response.body.error).toContain("đăng nhập");
  });

  it("rejects invalid login payloads with a clear validation response", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "" });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Dữ liệu gửi lên không hợp lệ.");
    expect(response.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "email" })
    ]));
  });

  it("returns a structured 404 for unknown API routes", async () => {
    const response = await request(app).get("/api/missing");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Không tìm thấy API.");
  });
});
