import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { availabilitySchema, roomSchema, roomUpdateSchema } from "../lib/validation.js";
import { requireAdmin } from "../middleware/auth.js";
import { validateBookingTime } from "../services/booking-rules.js";

export const roomsRouter = Router();

roomsRouter.get("/available", async (request, response) => {
  const { startTime, endTime, attendeeCount, amenities } = availabilitySchema.parse(request.query);
  validateBookingTime({ startTime, endTime });
  const rooms = await prisma.room.findMany({
    where: {
      status: "ACTIVE",
      capacity: { gte: attendeeCount },
      ...(amenities.length ? { amenities: { hasEvery: amenities } } : {}),
      bookings: {
        none: {
          status: "CONFIRMED",
          startTime: { lt: endTime },
          endTime: { gt: startTime }
        }
      }
    },
    orderBy: { name: "asc" }
  });
  response.json({ rooms });
});

roomsRouter.get("/", async (_request, response) => {
  const rooms = await prisma.room.findMany({ orderBy: { name: "asc" } });
  response.json({ rooms });
});

roomsRouter.post("/", requireAdmin, async (request, response) => {
  const input = roomSchema.parse(request.body);
  const room = await prisma.room.create({ data: input });
  response.status(201).json({ room });
});

roomsRouter.patch("/:id", requireAdmin, async (request, response) => {
  const input = roomUpdateSchema.parse(request.body);
  if (!Object.keys(input).length) throw new AppError("Cần cung cấp ít nhất một trường để cập nhật.");
  const roomId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!roomId) throw new AppError("Thiếu mã phòng.");
  const room = await prisma.room.update({ where: { id: roomId }, data: input });
  response.json({ room });
});
