import { Prisma } from "@prisma/client";

type OccurrenceUpdate = { id: string; roomId: string; startTime: Date; endTime: Date; attendeeCount: number };

export function occurrenceUpdateStatement(occurrences: OccurrenceUpdate[]): Prisma.Sql {
  if (!occurrences.length) throw new Error("No occurrences to update");
  const values = occurrences.map((item) => Prisma.sql`(
    ${item.id}, ${item.roomId},
    (${item.startTime.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
    (${item.endTime.toISOString()}::timestamptz AT TIME ZONE 'UTC'), ${item.attendeeCount}::integer
  )`);
  return Prisma.sql`UPDATE "Booking" AS booking
    SET "roomId" = changes.room_id, "startTime" = changes.start_time,
        "endTime" = changes.end_time, "attendeeCount" = changes.attendee_count
    FROM (VALUES ${Prisma.join(values)}) AS changes(id, room_id, start_time, end_time, attendee_count)
    WHERE booking.id = changes.id`;
}
