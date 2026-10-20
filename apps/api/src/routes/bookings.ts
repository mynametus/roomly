import { BookingStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { bookingSchema, recurringBookingSchema } from "../lib/validation.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { cancelBooking, createBooking, createRecurringBookings } from "../services/booking-service.js";

export const bookingsRouter = Router();

bookingsRouter.get("/", async (request, response) => {
  const { from, to, status } = z.object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    status: z.enum(["CONFIRMED", "CANCELLED"]).optional()
  }).parse(request.query);
  const user = (request as AuthenticatedRequest).user!;
  const bookings = await prisma.booking.findMany({
    where: {
      ...(user.role === "ADMIN" ? {} : { userId: user.id }),
      ...(status ? { status: status as BookingStatus } : {}),
      ...(from || to
        ? { startTime: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) } }
        : {})
    },
    include: {
      room: true,
      user: { select: { id: true, name: true, email: true } },
      series: { select: { id: true, recurrenceCount: true } }
    },
    orderBy: { startTime: "asc" }
  });
  response.json({ bookings });
});

bookingsRouter.get("/:id", async (request, response) => {
  const bookingId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!bookingId) throw new AppError("Thiếu mã lượt đặt.");
  const user = (request as AuthenticatedRequest).user!;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: true,
      user: { select: { id: true, name: true, email: true } },
      series: { select: { id: true, recurrenceCount: true } }
    }
  });
  if (!booking) throw new AppError("Không tìm thấy lượt đặt.", 404);
  if (user.role !== "ADMIN" && booking.userId !== user.id) {
    throw new AppError("Bạn không có quyền xem lượt đặt này.", 403);
  }
  response.json({ booking });
});

bookingsRouter.post("/", async (request, response) => {
  const input = bookingSchema.parse(request.body);
  const userId = (request as AuthenticatedRequest).user!.id;
  const booking = await createBooking(userId, input);
  response.status(201).json({ booking });
});

bookingsRouter.post("/recurring", async (request, response) => {
  const input = recurringBookingSchema.parse(request.body);
  const userId = (request as AuthenticatedRequest).user!.id;
  const bookings = await createRecurringBookings(userId, input);
  response.status(201).json({ bookings });
});

bookingsRouter.delete("/:id", async (request, response) => {
  const user = (request as AuthenticatedRequest).user!;
  const bookingId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!bookingId) throw new AppError("Thiếu mã lượt đặt.");
  const cancelFrom = z.enum(["true", "false"]).default("false").parse(request.query.cancelFrom) === "true";
  const booking = await cancelBooking(bookingId, user.id, user.role === "ADMIN", cancelFrom);
  response.json({ booking, message: cancelFrom ? "Đã hủy buổi này và các buổi tiếp theo." : "Đã hủy lượt đặt." });
});
