import type { Room } from "../types";

export function RoomNotes({ notes }: { notes: Room["notes"] }) {
  if (!notes) return null;
  return <div className="room-notes"><strong>Ghi chú</strong><p>{notes}</p></div>;
}
