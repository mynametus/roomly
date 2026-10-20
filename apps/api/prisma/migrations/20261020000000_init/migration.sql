CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingSeries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recurrenceCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingSeries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "attendeeCount" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");
CREATE INDEX "Booking_roomId_startTime_endTime_idx" ON "Booking"("roomId", "startTime", "endTime");
CREATE INDEX "Booking_userId_startTime_status_idx" ON "Booking"("userId", "startTime", "status");
CREATE INDEX "Booking_seriesId_startTime_idx" ON "Booking"("seriesId", "startTime");

ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
