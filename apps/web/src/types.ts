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
  nameKo?: string | null;
  capacity: number;
  location: string;
  notes: string | null;
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
  user: Pick<User, "id" | "name" | "email" | "department">;
  series: { id: string; recurrenceCount: number; recurrence?: RecurrenceRule | null } | null;
};

export type BookingInput = {
  roomId: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
};

export type BookingScope = "THIS" | "FOLLOWING" | "ALL";
export type RecurrenceRule = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  weekdays?: number[];
  monthlyMode?: "DAY_OF_MONTH" | "WEEKDAY";
  monthDay?: number;
  nth?: number;
  weekday?: number;
  endDate?: string;
  count?: number;
};
export type BookingPlan = BookingInput & {
  recurrence?: RecurrenceRule;
  excludedDates?: string[];
  overrides?: { date: string; roomId?: string; startTime?: string; endTime?: string }[];
  scope?: BookingScope;
};
export type BookingPreview = {
  occurrences: (BookingInput & { id?: string; date: string; roomName: string; status: "AVAILABLE" | "CONFLICT" | "EXCLUDED"; reason?: string })[];
  total: number;
  availableCount: number;
  conflictCount: number;
  excludedCount: number;
  canConfirm: boolean;
};
