import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./application.js";
import { createToken } from "./middleware/auth.js";

process.env.JWT_SECRET ??= "roomly-test-jwt-secret-that-is-long-enough";

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

  it("protects room management from unauthenticated requests", async () => {
    const response = await request(app)
      .post("/api/rooms")
      .send({ name: "Test", location: "Floor 1", capacity: 4 });
    expect(response.status).toBe(401);
  });

  it("prevents regular users from creating room records", async () => {
    const token = createToken({ id: "regular-user", email: "user@example.com", role: "USER" });
    const response = await request(app)
      .post("/api/rooms")
      .set("authorization", `Bearer ${token}`)
      .send({ name: "Test room", location: "Floor 1", capacity: 4 });
    expect(response.status).toBe(403);
  });

  it("protects bulk user creation from unauthenticated requests", async () => {
    const response = await request(app).post("/api/users/bulk").send({ users: [] });
    expect(response.status).toBe(401);
  });

  it("prevents regular users from bulk creating accounts", async () => {
    const token = createToken({ id: "regular-user", email: "user@example.com", role: "USER" });
    const response = await request(app)
      .post("/api/users/bulk")
      .set("authorization", `Bearer ${token}`)
      .send({ users: [{ name: "New User", email: "new-user@example.com" }] });
    expect(response.status).toBe(403);
  });

  it("validates bulk account input before accessing the database", async () => {
    const token = createToken({ id: "admin-user", email: "admin@example.com", role: "ADMIN" });
    const response = await request(app)
      .post("/api/users/bulk")
      .set("authorization", `Bearer ${token}`)
      .send({ users: [{ name: "A", email: "not-an-email" }] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Dữ liệu gửi lên không hợp lệ.");
  });
});
