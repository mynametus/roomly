import "dotenv/config";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import app from "./application.js";
import { prisma } from "./lib/prisma.js";
import { createToken } from "./middleware/auth.js";
import { acquireBookingLock } from "./services/booking-lock.js";

// Explicit opt-in: real PostgreSQL checks, with every test record rolled back.
const databaseTests = process.env.RUN_DATABASE_TESTS === "1" ? describe : describe.skip;

databaseTests("booking confirmations with real PostgreSQL", () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it("creates, edits and cancels a recurring booking through HTTP without committing test records", async () => {
    const user = await prisma.user.findFirst({ where: { isActive: true, mustChangePassword: false } });
    expect(user).not.toBeNull();
    const authorization = `Bearer ${createToken({ id: user!.id, email: user!.email, role: user!.role })}`;
    const marker = randomUUID();
    const rollback = new Error("ROLLBACK_BOOKING_INTEGRATION_TEST");
    const runTransaction = prisma.$transaction.bind(prisma);
    let createdRoomId: string | undefined;
    try {
      await runTransaction(async (transaction) => {
        const room = await transaction.room.create({ data: { name: `Integration ${marker}`, capacity: 8, location: "Temporary integration test" } });
        createdRoomId = room.id;
        // Execute the real route/service queries inside this outer rollback transaction.
        const transactionSpy = vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(transaction));
        try {
          const input = { roomId: room.id, startTime: "2026-11-01T09:00:00+07:00", endTime: "2026-11-01T17:00:00+07:00", attendeeCount: 4, recurrence: { frequency: "DAILY", interval: 1, count: 3 } };
          const created = await request(app).post("/api/bookings/recurring").set("authorization", authorization).send(input);
          expect(created.status).toBe(201);
          expect(created.body.bookings).toHaveLength(3);
          expect(created.body.bookings[0].series.recurrence.frequency).toBe("DAILY");
          const id = created.body.bookings[0].id;
          const conflict = await request(app).post("/api/bookings/recurring").set("authorization", authorization).send(input);
          expect(conflict.status).toBe(409);
          expect(await transaction.booking.count({ where: { roomId: room.id } })).toBe(3);

          const edited = await request(app).patch(`/api/bookings/${id}`).set("authorization", authorization).send({ ...input, startTime: "2026-11-01T10:00:00+07:00", endTime: "2026-11-01T18:00:00+07:00", scope: "ALL" });
          expect(edited.status).toBe(200);
          expect(edited.body.bookings).toHaveLength(3);
          expect(edited.body.bookings.every((booking: { startTime: string }) => new Date(booking.startTime).getUTCHours() === 3)).toBe(true);
          const cancelled = await request(app).delete(`/api/bookings/${id}?scope=ALL`).set("authorization", authorization);
          expect(cancelled.status).toBe(200);
          expect(cancelled.body.booking.affectedCount).toBe(3);
          expect(await transaction.booking.count({ where: { roomId: room.id, status: "CONFIRMED" } })).toBe(0);

          const single = await request(app).post("/api/bookings").set("authorization", authorization).send(input);
          expect(single.status).toBe(201);
          const cancelSingle = await request(app).delete(`/api/bookings/${single.body.booking.id}`).set("authorization", authorization);
          expect(cancelSingle.status).toBe(200);
        } finally { transactionSpy.mockRestore(); }
        throw rollback;
      }, { timeout: 45000 });
    } catch (error) { if (error !== rollback) throw error; }
    expect(createdRoomId).toBeDefined();
    expect(await prisma.room.findUnique({ where: { id: createdRoomId } })).toBeNull();
    expect(await prisma.booking.count({ where: { roomId: createdRoomId } })).toBe(0);
  }, 60000);

  it("keeps the lock exclusive and releases it when the transaction ends", async () => {
    const key = `integration-lock:${randomUUID()}`;
    let unlock!: () => void;
    let markLocked!: () => void;
    const release = new Promise<void>((resolve) => { unlock = resolve; });
    const locked = new Promise<void>((resolve) => { markLocked = resolve; });
    const holder = prisma.$transaction(async (transaction) => {
      await acquireBookingLock(transaction, key);
      markLocked();
      await release;
    }, { timeout: 15000 });
    try {
      await Promise.race([locked, holder]);
      const competing = await prisma.$transaction((transaction) => transaction.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS acquired`);
      expect(competing[0].acquired).toBe(false);
    } finally { unlock(); await holder; }
    const after = await prisma.$transaction((transaction) => transaction.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS acquired`);
    expect(after[0].acquired).toBe(true);
  }, 25000);
});
