import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { cancelBooking } from "../services/booking-service.js";

export const bookingSeriesRouter = Router();

bookingSeriesRouter.post("/:id/cancel-from", async (request, response) => {
  const seriesId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!seriesId) throw new AppError("Thiếu mã chuỗi đặt.");
  const { bookingId } = z.object({ bookingId: z.string().min(1) }).parse(request.body);
  const user = (request as AuthenticatedRequest).user!;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.seriesId !== seriesId) {
    throw new AppError("Không tìm thấy buổi thuộc chuỗi đặt này.", 404);
  }
  const cancelled = await cancelBooking(bookingId, user.id, user.role === "ADMIN", true);
  response.json({ booking: cancelled, message: "Đã hủy buổi này và các buổi tiếp theo." });
});
