import { BookingStatus } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { reportRangeSchema } from "../lib/validation.js";
import { requireAdmin } from "../middleware/auth.js";

export const reportsRouter = Router();

reportsRouter.get("/rooms", requireAdmin, async (request, response) => {
  const { from, to } = reportRangeSchema.parse(request.query);
  if (to <= from) throw new AppError("Ngày kết thúc phải sau ngày bắt đầu.");
  const [rooms, bookings] = await Promise.all([
    prisma.room.findMany({ orderBy: { name: "asc" } }),
    prisma.booking.findMany({
      where: {
        startTime: { lt: to },
        endTime: { gt: from }
      },
      select: { roomId: true, startTime: true, endTime: true, status: true }
    })
  ]);
  const rangeHours = (to.getTime() - from.getTime()) / 3_600_000;
  const activeRoomCount = rooms.filter((room) => room.status === "ACTIVE").length;
  const perRoom = rooms.map((room) => {
    const roomBookings = bookings.filter((booking) => booking.roomId === room.id);
    const confirmed = roomBookings.filter((booking) => booking.status === BookingStatus.CONFIRMED);
    const bookedMilliseconds = confirmed.reduce((total, booking) => {
      const overlapStart = Math.max(from.getTime(), booking.startTime.getTime());
      const overlapEnd = Math.min(to.getTime(), booking.endTime.getTime());
      return total + Math.max(0, overlapEnd - overlapStart);
    }, 0);
    const bookedHours = bookedMilliseconds / 3_600_000;
    return {
      room: {
        id: room.id,
        name: room.name,
        nameKo: room.nameKo,
        location: room.location,
        status: room.status
      },
      bookingCount: confirmed.length,
      cancelledCount: roomBookings.filter((booking) => booking.status === BookingStatus.CANCELLED).length,
      bookedHours: Math.round(bookedHours * 100) / 100,
      utilizationPercent: room.status === "ACTIVE" && rangeHours > 0
        ? Math.round((bookedHours / rangeHours) * 10_000) / 100
        : 0
    };
  });
  const totalBookings = perRoom.reduce((total, room) => total + room.bookingCount, 0);
  const totalCancelled = perRoom.reduce((total, room) => total + room.cancelledCount, 0);
  const totalBookedHours = perRoom.reduce((total, room) => total + room.bookedHours, 0);
  const availableHours = rangeHours * activeRoomCount;
  response.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      activeRoomCount,
      totalBookings,
      totalCancelled,
      bookedHours: Math.round(totalBookedHours * 100) / 100,
      utilizationPercent: availableHours > 0
        ? Math.round((totalBookedHours / availableHours) * 10_000) / 100
        : 0
    },
    rooms: perRoom
  });
});
