import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  room: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  booking: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn()
}));
vi.mock("./lib/prisma.js", () => ({ prisma: prismaMock }));

import app from "./application.js";
import { createToken } from "./middleware/auth.js";

process.env.JWT_SECRET ??= "roomly-test-jwt-secret-that-is-long-enough";

const ownBooking = {
  id: "own-booking", userId: "member", roomId: "room-1", seriesId: "own-series",
  status: "CONFIRMED", startTime: new Date("2026-10-24T02:00:00Z")
};
const otherBooking = { ...ownBooking, id: "other-booking", userId: "other-member", seriesId: "other-series" };
const memberToken = () => createToken({ id: "member", email: "member@example.com", role: "USER" });
const adminToken = () => createToken({ id: "admin", email: "admin@example.com", role: "ADMIN" });

describe("room and booking access by role", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.user.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id, email: `${where.id}@example.com`, role: where.id === "admin" ? "ADMIN" : "USER",
      mustChangePassword: false, isActive: true
    }));
    prismaMock.booking.findMany.mockImplementation(async ({ where }) => [ownBooking, otherBooking]
      .filter((booking) => !where.userId || booking.userId === where.userId));
    prismaMock.booking.findUnique.mockImplementation(async ({ where }) =>
      [ownBooking, otherBooking].find((booking) => booking.id === where.id) ?? null);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it("allows a user to list everyone's bookings, regardless of department or a supplied userId", async () => {
    const response = await request(app).get("/api/bookings?userId=other-member")
      .set("authorization", `Bearer ${memberToken()}`);
    expect(response.status).toBe(200);
    expect(response.body.bookings.map((booking: { id: string }) => booking.id)).toEqual([ownBooking.id, otherBooking.id]);
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).not.toHaveProperty("userId");
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).not.toHaveProperty("user");
  });

  it.each(["/api/bookings", "/api/bookings/other-booking"])("still requires authentication to read %s", async (path) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(401);
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
    expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
  });

  it("preserves date and status filters when a user reads the shared schedule", async () => {
    const response = await request(app).get("/api/bookings?from=2026-10-24T00:00:00Z&to=2026-10-25T00:00:00Z&status=CONFIRMED")
      .set("authorization", `Bearer ${memberToken()}`);
    expect(response.status).toBe(200);
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      status: "CONFIRMED", startTime: { gte: new Date("2026-10-24T00:00:00Z"), lt: new Date("2026-10-25T00:00:00Z") }
    } }));
  });

  it("allows an administrator to list everyone's bookings", async () => {
    const response = await request(app).get("/api/bookings").set("authorization", `Bearer ${adminToken()}`);
    expect(response.status).toBe(200);
    expect(response.body.bookings).toHaveLength(2);
  });

  it.each(["/api/bookings/other-booking", "/api/bookings/other-booking/preview"])("prevents a user editing or previewing another user's booking: %s", async (path) => {
    const operation = path.endsWith("preview") ? request(app).post(path) : request(app).patch(path);
    const response = await operation.set("authorization", `Bearer ${memberToken()}`).send({
      roomId: "room-1", startTime: "2026-10-24T09:00:00+07:00", endTime: "2026-10-24T10:00:00+07:00", attendeeCount: 4, scope: "ALL"
    });
    expect(response.status).toBe(403);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it.each([
    { role: "member", id: "own-booking", status: 200 },
    { role: "member", id: "other-booking", status: 200 },
    { role: "admin", id: "other-booking", status: 200 }
  ])("returns $status when $role opens $id", async ({ role, id, status }) => {
    const token = role === "admin" ? adminToken() : memberToken();
    const response = await request(app).get(`/api/bookings/${id}`).set("authorization", `Bearer ${token}`);
    expect(response.status).toBe(status);
    expect(response.body.booking.id).toBe(id);
  });

  it.each([
    { role: "member", id: "own-booking", status: 200 },
    { role: "member", id: "other-booking", status: 403 },
    { role: "admin", id: "other-booking", status: 200 }
  ])("returns $status when $role cancels $id", async ({ role, id, status }) => {
    const token = role === "admin" ? adminToken() : memberToken();
    const response = await request(app).delete(`/api/bookings/${id}`).set("authorization", `Bearer ${token}`);
    expect(response.status).toBe(status);
    if (status === 403) expect(prismaMock.booking.update).not.toHaveBeenCalled();
    else expect(prismaMock.booking.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id } }));
  });

  it.each([
    { role: "member", booking: ownBooking, status: 200 },
    { role: "member", booking: otherBooking, status: 403 },
    { role: "admin", booking: otherBooking, status: 200 }
  ])("returns $status when $role cancels a recurring series through its dedicated endpoint", async ({ role, booking, status }) => {
    const token = role === "admin" ? adminToken() : memberToken();
    const response = await request(app).post(`/api/booking-series/${booking.seriesId}/cancel-from`)
      .set("authorization", `Bearer ${token}`).send({ bookingId: booking.id });
    expect(response.status).toBe(status);
    if (status === 403) expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    else expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ seriesId: booking.seriesId })
    }));
  });

  it.each(["cancelFrom=true", "scope=THIS", "scope=FOLLOWING", "scope=ALL"])("prevents cancelling another user's booking or series with %s", async (query) => {
    const response = await request(app).delete(`/api/bookings/other-booking?${query}`)
      .set("authorization", `Bearer ${memberToken()}`);
    expect(response.status).toBe(403);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("uses the current database role when an old token still claims administrator privileges", async () => {
    const staleToken = createToken({ id: "member", email: "member@example.com", role: "ADMIN" });
    const response = await request(app).get("/api/bookings").set("authorization", `Bearer ${staleToken}`);
    expect(response.status).toBe(200);
    expect(response.body.bookings).toHaveLength(2);
    const bookingUpdate = await request(app).delete("/api/bookings/other-booking").set("authorization", `Bearer ${staleToken}`);
    expect(bookingUpdate.status).toBe(403);
    const roomUpdate = await request(app).patch("/api/rooms/room-1").set("authorization", `Bearer ${staleToken}`)
      .send({ name: "Changed room" });
    expect(roomUpdate.status).toBe(403);
    expect(prismaMock.room.update).not.toHaveBeenCalled();
  });

  it("allows users to view the room catalog", async () => {
    prismaMock.room.findMany.mockResolvedValue([{ id: "room-1", name: "Meeting room" }]);
    const response = await request(app).get("/api/rooms").set("authorization", `Bearer ${memberToken()}`);
    expect(response.status).toBe(200);
    expect(response.body.rooms).toHaveLength(1);
  });

  it("rejects room creation, edits, deactivation and deletion by users", async () => {
    const authorization = `Bearer ${memberToken()}`;
    const create = await request(app).post("/api/rooms").set("authorization", authorization)
      .send({ name: "New room", location: "Floor 1", capacity: 10 });
    const edit = await request(app).patch("/api/rooms/room-1").set("authorization", authorization).send({ name: "Changed room" });
    const deactivate = await request(app).patch("/api/rooms/room-1").set("authorization", authorization).send({ status: "INACTIVE" });
    const remove = await request(app).delete("/api/rooms/room-1").set("authorization", authorization);
    expect([create.status, edit.status, deactivate.status, remove.status]).toEqual([403, 403, 403, 404]);
    expect(prismaMock.room.create).not.toHaveBeenCalled();
    expect(prismaMock.room.update).not.toHaveBeenCalled();
    expect(prismaMock.room.delete).not.toHaveBeenCalled();
  });

  it("allows administrators to create and update rooms", async () => {
    prismaMock.room.create.mockResolvedValue({ id: "room-1" });
    prismaMock.room.update.mockResolvedValue({ id: "room-1" });
    const authorization = `Bearer ${adminToken()}`;
    const create = await request(app).post("/api/rooms").set("authorization", authorization)
      .send({ name: "New room", location: "Floor 1", capacity: 10 });
    const edit = await request(app).patch("/api/rooms/room-1").set("authorization", authorization).send({ name: "Changed room" });
    expect(create.status).toBe(201);
    expect(edit.status).toBe(200);
  });

  it.each([
    { method: "get", path: "/api/users", body: undefined },
    { method: "post", path: "/api/users/bulk", body: { users: [] } },
    { method: "patch", path: "/api/users/other-member/department", body: { department: "Kế toán" } },
    { method: "patch", path: "/api/users/other-member/status", body: { isActive: false } },
    { method: "post", path: "/api/users/other-member/reset-password", body: undefined },
    { method: "get", path: "/api/reports/rooms", body: undefined }
  ] as const)("denies users access to admin endpoint $method $path", async ({ method, path, body }) => {
    const operation = request(app)[method](path).set("authorization", `Bearer ${memberToken()}`);
    const response = await (body ? operation.send(body) : operation);
    expect(response.status).toBe(403);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.room.findMany).not.toHaveBeenCalled();
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
  });
});
