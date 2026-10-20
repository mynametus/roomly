import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((email) => email.trim().toLowerCase()),
  password: z.string().min(8).max(100)
});

export const loginSchema = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  password: z.string().min(1).max(100)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8).max(100)
});

export const bookingSchema = z.object({
  roomId: z.string().min(1),
  startTime: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  endTime: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  attendeeCount: z.number().int().positive().max(500)
});

export const recurringBookingSchema = bookingSchema.extend({
  recurrenceCount: z.number().int().min(2).max(8)
});

export const roomSchema = z.object({
  name: z.string().trim().min(2).max(80),
  capacity: z.number().int().positive().max(500),
  location: z.string().trim().min(1).max(120),
  amenities: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

export const availabilitySchema = z.object({
  startTime: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  endTime: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  attendeeCount: z.coerce.number().int().positive().max(500),
  amenities: z.union([z.string(), z.array(z.string())]).optional().transform((value) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value]
  )
});

export const userStatusSchema = z.object({
  isActive: z.boolean()
});

export const reportRangeSchema = z.object({
  from: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  to: z.iso.datetime({ offset: true }).transform((value) => new Date(value))
}).refine(({ from, to }) => to > from && to.getTime() - from.getTime() <= 366 * 24 * 60 * 60 * 1000);

export const bulkUsersSchema = z.object({
  users: z.array(registerSchema.pick({ name: true, email: true })).min(1).max(50)
}).superRefine(({ users }, context) => {
  const seen = new Set<string>();
  users.forEach((user, index) => {
    if (seen.has(user.email)) {
      context.addIssue({
        code: "custom",
        path: ["users", index, "email"],
        message: `Email ${user.email} bị lặp trong danh sách.`
      });
    }
    seen.add(user.email);
  });
});
