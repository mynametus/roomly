import type { Room } from "../types";
import { T } from "../i18n";

export function RoomNotes({ notes }: { notes: Room["notes"] }) {
  if (!notes) return null;
  return <div className="room-notes"><strong><T>Ghi chú</T></strong><p>{notes}</p></div>;
}
