import { BookingStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { bookingPlanSchema, bookingSchema, bookingScopeSchema, bookingUpdateSchema, recurringBookingSchema } from "../lib/validation.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { cancelBooking, createBooking, createRecurringBookings, previewBookings, previewBookingUpdate, updateBooking } from "../services/booking-service.js";

export const bookingsRouter = Router();

bookingsRouter.get("/", async (request, response) => {
  const { from, to, status } = z.object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    status: z.enum(["CONFIRMED", "CANCELLED"]).optional()
  }).parse(request.query);
  const bookings = await prisma.booking.findMany({
    where: {
      ...(status ? { status: status as BookingStatus } : {}),
      ...(from || to
        ? { startTime: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) } }
        : {})
    },
    include: {
      room: true,
      user: { select: { id: true, name: true, email: true, department: true } },
      series: { select: { id: true, recurrenceCount: true, recurrence: true } }
    },
    orderBy: { startTime: "asc" }
  });
  response.json({ bookings });
});

bookingsRouter.get("/:id", async (request, response) => {
  const bookingId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!bookingId) throw new AppError("Thiếu mã lượt đặt.");
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: true,
      user: { select: { id: true, name: true, email: true, department: true } },
      series: { select: { id: true, recurrenceCount: true, recurrence: true } }
    }
  });
  if (!booking) throw new AppError("Không tìm thấy lượt đặt.", 404);
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

bookingsRouter.post("/preview", async (request, response) => {
  response.json(await previewBookings(bookingPlanSchema.parse(request.body)));
});

bookingsRouter.post("/:id/preview", async (request, response) => {
  const bookingId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!bookingId) throw new AppError("Thiếu mã lượt đặt.");
  const user = (request as AuthenticatedRequest).user!;
  response.json(await previewBookingUpdate(bookingId, user.id, user.role === "ADMIN", bookingUpdateSchema.parse(request.body)));
});

bookingsRouter.patch("/:id", async (request, response) => {
  const bookingId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!bookingId) throw new AppError("Thiếu mã lượt đặt.");
  const user = (request as AuthenticatedRequest).user!;
  response.json({ bookings: await updateBooking(bookingId, user.id, user.role === "ADMIN", bookingUpdateSchema.parse(request.body)) });
});

bookingsRouter.delete("/:id", async (request, response) => {
  const user = (request as AuthenticatedRequest).user!;
  const bookingId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!bookingId) throw new AppError("Thiếu mã lượt đặt.");
  const cancelFrom = z.enum(["true", "false"]).default("false").parse(request.query.cancelFrom) === "true";
  const scope = bookingScopeSchema.parse(request.query.scope ?? (cancelFrom ? "FOLLOWING" : "THIS"));
  const booking = await cancelBooking(bookingId, user.id, user.role === "ADMIN", scope);
  response.json({ booking, message: scope === "ALL" ? "Đã hủy toàn bộ chuỗi." : scope === "FOLLOWING" ? "Đã hủy buổi này và các buổi tiếp theo." : "Đã hủy lượt đặt." });
});
