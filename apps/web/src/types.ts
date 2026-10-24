export type User = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
  isActive: boolean;
};

export type Room = {
  id: string;
  name: string;
  capacity: number;
  location: string;
  amenities: string[];
  status: "ACTIVE" | "INACTIVE";
};

export type Booking = {
  id: string;
  roomId: string;
  userId: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
  status: "CONFIRMED" | "CANCELLED";
  canceledAt: string | null;
  room: Room;
  user: Pick<User, "id" | "name" | "email">;
  series: { id: string; recurrenceCount: number } | null;
};

export type BookingInput = {
  roomId: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
};
