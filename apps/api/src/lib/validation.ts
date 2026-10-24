import { z } from "zod";

const departmentSchema = z.string().trim().min(1, "Vui lòng nhập bộ phận làm việc.").max(120);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((email) => email.trim().toLowerCase()),
  department: departmentSchema,
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

export const recurrenceRuleSchema = z.object({
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.number().int().min(1).max(12).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  monthlyMode: z.enum(["DAY_OF_MONTH", "WEEKDAY"]).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
  nth: z.union([z.literal(-1), z.number().int().min(1).max(4)]).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  endDate: z.iso.date().optional(),
  count: z.number().int().min(1).max(200).optional()
}).superRefine((rule, context) => {
  if (Boolean(rule.endDate) === Boolean(rule.count)) context.addIssue({ code: "custom", path: ["endDate"], message: "Chọn ngày kết thúc hoặc số buổi họp." });
  if (rule.frequency === "WEEKLY" && !rule.weekdays?.length) context.addIssue({ code: "custom", path: ["weekdays"], message: "Chọn ít nhất một thứ trong tuần." });
  if (rule.frequency === "MONTHLY" && rule.monthlyMode === "WEEKDAY" && (rule.nth === undefined || rule.weekday === undefined)) context.addIssue({ code: "custom", path: ["weekday"], message: "Chọn thứ và tuần trong tháng." });
});

const occurrenceOverrideSchema = z.object({
  date: z.iso.date(),
  roomId: z.string().min(1).optional(),
  startTime: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  endTime: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional()
});

export const bookingPlanSchema = bookingSchema.extend({
  recurrence: recurrenceRuleSchema.optional(),
  recurrenceCount: z.number().int().min(2).max(8).optional(),
  excludedDates: z.array(z.iso.date()).max(200).default([]),
  overrides: z.array(occurrenceOverrideSchema).max(200).default([])
}).superRefine((input, context) => {
  if (input.recurrence && input.recurrenceCount) context.addIssue({ code: "custom", path: ["recurrence"], message: "Chỉ sử dụng một cấu hình lịch lặp lại." });
  if (!input.recurrence && !input.recurrenceCount && (input.excludedDates.length || input.overrides.length)) context.addIssue({ code: "custom", path: ["overrides"], message: "Chỉ áp dụng ngoại lệ cho chuỗi định kỳ." });
});

export const recurringBookingSchema = bookingPlanSchema.refine((input) => input.recurrence || input.recurrenceCount, { message: "Cần cấu hình lịch lặp lại." });
export const bookingScopeSchema = z.enum(["THIS", "FOLLOWING", "ALL"]);
export const bookingUpdateSchema = bookingSchema.extend({ scope: bookingScopeSchema.default("THIS") });

const roomFields = z.object({
  name: z.string().trim().min(2).max(80),
  capacity: z.number().int().positive().max(500),
  location: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2000).transform((value) => value || null).nullable().optional(),
  amenities: z.array(z.string().trim().min(1).max(40)).max(20),
  status: z.enum(["ACTIVE", "INACTIVE"])
});

export const roomSchema = roomFields.extend({
  amenities: roomFields.shape.amenities.default([]),
  status: roomFields.shape.status.default("ACTIVE")
});

export const roomUpdateSchema = roomFields.partial();

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

export const userDepartmentSchema = z.object({
  department: departmentSchema
});

export const reportRangeSchema = z.object({
  from: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  to: z.iso.datetime({ offset: true }).transform((value) => new Date(value))
}).refine(({ from, to }) => to > from && to.getTime() - from.getTime() <= 366 * 24 * 60 * 60 * 1000);

export const bulkUsersSchema = z.object({
  users: z.array(registerSchema.pick({ name: true, email: true, department: true })).min(1).max(50)
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
