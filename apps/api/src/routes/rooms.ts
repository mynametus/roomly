import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { roomSchema } from "../lib/validation.js";
import { requireAdmin } from "../middleware/auth.js";

export const roomsRouter = Router();

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
  const input = roomSchema.partial().parse(request.body);
  if (!Object.keys(input).length) throw new AppError("Cần cung cấp ít nhất một trường để cập nhật.");
  const roomId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!roomId) throw new AppError("Thiếu mã phòng.");
  const room = await prisma.room.update({ where: { id: roomId }, data: input });
  response.json({ room });
});
