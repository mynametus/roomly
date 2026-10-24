import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  room: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() }
}));
vi.mock("./lib/prisma.js", () => ({ prisma: prismaMock }));

import app from "./application.js";
import { createToken } from "./middleware/auth.js";

process.env.JWT_SECRET ??= "roomly-test-jwt-secret-that-is-long-enough";
const token = (role: "ADMIN" | "USER" = "ADMIN") => createToken({ id: role, email: `${role}@example.com`, role });
const roomInput = { name: "Meeting room", location: "Floor 1", capacity: 10 };
const existingRoom = { ...roomInput, id: "room-1", status: "INACTIVE", amenities: ["Máy chiếu"], notes: "Ghi chú cũ" };

describe("optional room notes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.user.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id, email: `${where.id}@example.com`, role: where.id, isActive: true, mustChangePassword: false
    }));
    prismaMock.room.create.mockImplementation(async ({ data }) => ({ id: "new-room", notes: null, ...data }));
    prismaMock.room.update.mockImplementation(async ({ data }) => ({ ...existingRoom, ...data }));
    prismaMock.room.findMany.mockResolvedValue([existingRoom]);
  });

  it.each([undefined, null, "", "   "])("creates a room with an optional empty note: %s", async (notes) => {
    const response = await request(app).post("/api/rooms").set("authorization", `Bearer ${token()}`)
      .send({ ...roomInput, notes });
    expect(response.status).toBe(201);
    expect(response.body.room.notes).toBeNull();
  });

  it("stores a trimmed multiline note when creating a room", async () => {
    const response = await request(app).post("/api/rooms").set("authorization", `Bearer ${token()}`)
      .send({ ...roomInput, notes: "  Liên hệ lễ tân.\nSắp xếp lại bàn ghế.  " });
    expect(response.status).toBe(201);
    expect(response.body.room.notes).toBe("Liên hệ lễ tân.\nSắp xếp lại bàn ghế.");
  });

  it.each(["", "   ", null])("clears existing notes without changing room status or amenities: %s", async (notes) => {
    const response = await request(app).patch("/api/rooms/room-1").set("authorization", `Bearer ${token()}`)
      .send({ notes });
    expect(response.status).toBe(200);
    expect(response.body.room.notes).toBeNull();
    expect(response.body.room.status).toBe("INACTIVE");
    expect(response.body.room.amenities).toEqual(existingRoom.amenities);
    expect(prismaMock.room.update.mock.calls[0][0].data).toEqual({ notes: null });
  });

  it("preserves existing notes when editing another field", async () => {
    const response = await request(app).patch("/api/rooms/room-1").set("authorization", `Bearer ${token()}`)
      .send({ name: "New name" });
    expect(response.status).toBe(200);
    expect(response.body.room.notes).toBe(existingRoom.notes);
    expect(prismaMock.room.update.mock.calls[0][0].data).toEqual({ name: "New name" });
  });

  it("lets admins update notes", async () => {
    const response = await request(app).patch("/api/rooms/room-1").set("authorization", `Bearer ${token()}`)
      .send({ notes: "  Lấy chìa khóa ở lễ tân  " });
    expect(response.status).toBe(200);
    expect(response.body.room.notes).toBe("Lấy chìa khóa ở lễ tân");
  });

  it.each([2001, 2500])("rejects notes longer than 2000 characters (%s)", async (length) => {
    const response = await request(app).patch("/api/rooms/room-1").set("authorization", `Bearer ${token()}`)
      .send({ notes: "x".repeat(length) });
    expect(response.status).toBe(400);
    expect(prismaMock.room.update).not.toHaveBeenCalled();
  });

  it.each(["/api/rooms", "/api/rooms/available?startTime=2026-10-25T09:00:00%2B07:00&endTime=2026-10-25T17:00:00%2B07:00&attendeeCount=4"])("returns room notes to users in %s", async (path) => {
    const response = await request(app).get(path).set("authorization", `Bearer ${token("USER")}`);
    expect(response.status).toBe(200);
    expect(response.body.rooms[0].notes).toBe(existingRoom.notes);
  });

  it("does not let users edit room notes", async () => {
    const response = await request(app).patch("/api/rooms/room-1").set("authorization", `Bearer ${token("USER")}`)
      .send({ notes: "Changed by member" });
    expect(response.status).toBe(403);
    expect(prismaMock.room.update).not.toHaveBeenCalled();
  });
});
