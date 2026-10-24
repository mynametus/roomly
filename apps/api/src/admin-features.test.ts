import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  room: { findMany: vi.fn() },
  booking: { findMany: vi.fn() }
}));

vi.mock("./lib/prisma.js", () => ({ prisma: prismaMock }));

import app from "./application.js";
import { createToken } from "./middleware/auth.js";

process.env.JWT_SECRET ??= "roomly-test-jwt-secret-that-is-long-enough";

const admin = {
  id: "admin",
  email: "admin@example.com",
  role: "ADMIN",
  mustChangePassword: false,
  isActive: true
};
const adminToken = () => createToken({ ...admin });

describe("Roomly admin features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(admin);
  });

  it("finds active rooms with enough capacity, requested amenities, and no time conflict", async () => {
    prismaMock.room.findMany.mockResolvedValue([]);
    const response = await request(app)
      .get("/api/rooms/available")
      .query({
        startTime: "2026-10-21T09:00:00+07:00",
        endTime: "2026-10-21T10:00:00+07:00",
        attendeeCount: "4",
        amenities: ["Màn hình", "Máy chiếu"]
      })
      .set("authorization", `Bearer ${adminToken()}`);

    expect(response.status).toBe(200);
    expect(prismaMock.room.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "ACTIVE",
        capacity: { gte: 4 },
        amenities: { hasEvery: ["Màn hình", "Máy chiếu"] },
        bookings: { none: expect.objectContaining({ status: "CONFIRMED" }) }
      })
    }));
  });

  it("finds available rooms for a full workday", async () => {
    prismaMock.room.findMany.mockResolvedValue([]);
    const response = await request(app)
      .get("/api/rooms/available")
      .query({
        startTime: "2026-10-21T09:00:00+07:00",
        endTime: "2026-10-21T17:00:00+07:00",
        attendeeCount: "4"
      })
      .set("authorization", `Bearer ${adminToken()}`);
    expect(response.status).toBe(200);
    expect(prismaMock.room.findMany).toHaveBeenCalled();
  });

  it("rejects availability requests with an end before the start", async () => {
    const response = await request(app)
      .get("/api/rooms/available")
      .query({
        startTime: "2026-10-21T09:00:00+07:00",
        endTime: "2026-10-21T08:00:00+07:00",
        attendeeCount: "4"
      })
      .set("authorization", `Bearer ${adminToken()}`);

    expect(response.status).toBe(400);
    expect(prismaMock.room.findMany).not.toHaveBeenCalled();
  });

  it("lists account fields without exposing password hashes", async () => {
    prismaMock.user.findMany.mockResolvedValue([{
      id: "member",
      name: "Member",
      email: "member@example.com",
      department: "Kế toán",
      role: "USER",
      mustChangePassword: false,
      isActive: true,
      createdAt: new Date()
    }]);
    const response = await request(app)
      .get("/api/users")
      .set("authorization", `Bearer ${adminToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.users[0]).not.toHaveProperty("passwordHash");
    expect(response.body.users[0].department).toBe("Kế toán");
    expect(prismaMock.user.findMany.mock.calls[0][0].select.department).toBe(true);
  });

  it("searches accounts by department without regard to case", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    const response = await request(app).get("/api/users").query({ search: "  Kế toán  " })
      .set("authorization", `Bearer ${adminToken()}`);
    expect(response.status).toBe(200);
    expect(prismaMock.user.findMany.mock.calls[0][0].where.OR).toContainEqual({
      department: { contains: "Kế toán", mode: "insensitive" }
    });
  });

  it("lets administrators update a department without changing account privileges", async () => {
    prismaMock.user.update.mockResolvedValue({ id: "member", department: "Nhân sự" });
    const response = await request(app).patch("/api/users/member/department")
      .set("authorization", `Bearer ${adminToken()}`)
      .send({ department: "  Nhân sự  ", role: "ADMIN", isActive: false });
    expect(response.status).toBe(200);
    expect(response.body.user.department).toBe("Nhân sự");
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "member" }, data: { department: "Nhân sự" }
    }));
    expect(prismaMock.user.update.mock.calls[0][0].select).not.toHaveProperty("passwordHash");
  });

  it.each([undefined, null, "", "   ", "x".repeat(121)])("rejects invalid department updates: %s", async (department) => {
    const response = await request(app).patch("/api/users/member/department")
      .set("authorization", `Bearer ${adminToken()}`).send({ department });
    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("prevents members from updating departments", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...admin, id: "member", role: "USER" });
    const token = createToken({ id: "member", email: "member@example.com", role: "USER" });
    const response = await request(app).patch("/api/users/member/department")
      .set("authorization", `Bearer ${token}`).send({ department: "Nhân sự" });
    expect(response.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", "   ", "x".repeat(121)])("requires a valid department for new accounts: %s", async (department) => {
    const response = await request(app).post("/api/users/bulk")
      .set("authorization", `Bearer ${adminToken()}`)
      .send({ users: [{ name: "Member", email: "member@example.com", department }] });
    expect(response.status).toBe(400);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("does not allow a regular user to access the account directory", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...admin,
      id: "member",
      role: "USER"
    });
    const token = createToken({ id: "member", email: "member@example.com", role: "USER" });

    const response = await request(app)
      .get("/api/users")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("prevents an administrator from locking their own account", async () => {
    const response = await request(app)
      .patch("/api/users/admin/status")
      .set("authorization", `Bearer ${adminToken()}`)
      .send({ isActive: false });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("revokes access immediately after an account is locked", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(admin);
    prismaMock.user.update.mockResolvedValue({
      id: "member",
      name: "Member",
      email: "member@example.com",
      role: "USER",
      isActive: false
    });
    const adminResponse = await request(app)
      .patch("/api/users/member/status")
      .set("authorization", `Bearer ${adminToken()}`)
      .send({ isActive: false });

    expect(adminResponse.status).toBe(200);
    prismaMock.user.findUnique.mockResolvedValue({
      ...admin,
      id: "member",
      role: "USER",
      isActive: false
    });
    const memberToken = createToken({ id: "member", email: "member@example.com", role: "USER" });
    const nextRequest = await request(app)
      .get("/api/rooms")
      .set("authorization", `Bearer ${memberToken}`);

    expect(nextRequest.status).toBe(401);
  });

  it("rejects login for a locked account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...admin,
      id: "member",
      email: "member@example.com",
      role: "USER",
      isActive: false,
      passwordHash: await bcrypt.hash("member-password", 4)
    });
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "member@example.com", password: "member-password" });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("khóa");
  });

  it("resets a user's password and requires a new password at next sign-in", async () => {
    prismaMock.user.update.mockImplementation(async ({ data }) => ({
      id: "member",
      name: "Member",
      email: "member@example.com",
      ...data
    }));
    const response = await request(app)
      .post("/api/users/member/reset-password")
      .set("authorization", `Bearer ${adminToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.temporaryPassword).toEqual(expect.any(String));
    const update = prismaMock.user.update.mock.calls[0][0];
    expect(update.data.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(response.body.temporaryPassword, update.data.passwordHash)).toBe(true);
  });

  it("returns per-room utilization and cancellation totals for administrators", async () => {
    const from = new Date("2026-10-20T00:00:00.000Z");
    const to = new Date("2026-10-21T00:00:00.000Z");
    prismaMock.room.findMany.mockResolvedValue([{
      id: "room-1",
      name: "Cedar",
      location: "Floor 1",
      status: "ACTIVE"
    }]);
    prismaMock.booking.findMany.mockResolvedValue([
      { roomId: "room-1", startTime: new Date("2026-10-20T08:00:00Z"), endTime: new Date("2026-10-20T10:00:00Z"), status: "CONFIRMED" },
      { roomId: "room-1", startTime: new Date("2026-10-20T12:00:00Z"), endTime: new Date("2026-10-20T13:00:00Z"), status: "CANCELLED" }
    ]);
    const response = await request(app)
      .get("/api/reports/rooms")
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set("authorization", `Bearer ${adminToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      activeRoomCount: 1,
      totalBookings: 1,
      totalCancelled: 1,
      bookedHours: 2,
      utilizationPercent: 8.33
    });
    expect(response.body.rooms[0].bookingCount).toBe(1);
  });
});
