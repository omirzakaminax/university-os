/**
 * Input contracts shared by server actions and the REST API (/api/v1).
 * Strings are trimmed; empty optional strings become null so "clear this field" is explicit.
 */
import { z } from "zod";
import { isValidTimeZone } from "@/lib/time";
import { recurrenceSchema } from "@/domain/recurrence";

export const id = z.uuid();
const text = (max: number) => z.string().trim().min(1, "Required").max(max, `Max ${max} characters`);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Max ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable();
const isoDateTime = z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString());
const dateOnly = z.iso.date();
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM");

export const COURSE_COLORS = ["violet", "blue", "cyan", "green", "amber", "rose", "slate"] as const;
export const ASSESSMENT_KINDS = ["assignment", "quiz", "lab", "project", "midterm", "final", "exam", "participation", "other"] as const;
export const EXAM_KINDS = ["midterm", "final", "exam"] as const;

// ---- Auth -------------------------------------------------------------------------------------
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254));
export const passwordSchema = z.string().min(8, "At least 8 characters").max(128, "Max 128 characters");

export const registerSchema = z.object({ displayName: text(100), email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Required").max(128) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(10).max(200), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });

// ---- Profile & preferences --------------------------------------------------------------------
export const profileUpdateSchema = z
  .object({
    displayName: text(100),
    timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
    locale: z.string().min(2).max(16),
  })
  .partial();

export const preferencesUpdateSchema = z
  .object({
    sidebarCollapsed: z.boolean(),
    theme: z.enum(["light", "dark", "system"]),
    weekStartsOn: z.number().int().min(0).max(6),
    dashboardWidgets: z.array(z.object({ id: z.string().max(40), visible: z.boolean() })).max(40),
    notificationPreferences: z.record(z.string().max(30), z.boolean()),
    activePeriodId: id.nullable(),
  })
  .partial();

export const bandSchema = z.object({
  letter: text(6),
  minPercent: z.number().min(0).max(100),
  points: z.number().min(0).max(20),
});

export const onboardingSchema = z.object({
  displayName: text(100),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  institution: z.object({ name: text(200), shortName: optText(30), country: z.string().regex(/^[A-Z]{2}$/, "Use a 2-letter country code").nullable() }),
  program: z.object({
    name: text(200),
    degreeLevel: z.enum(["certificate", "diploma", "bachelor", "master", "doctorate", "other"]),
    major: optText(200),
    periodSystem: z.enum(["trimester", "semester", "quarter", "custom"]),
  }),
  grading: z.object({
    name: text(120),
    rounding: z.enum(["none", "half_up"]),
    maxPoints: z.number().positive().max(20),
    bands: z.array(bandSchema).min(1).max(30),
  }),
  year: z.object({ label: text(60), startsOn: dateOnly, endsOn: dateOnly }),
  periods: z
    .array(z.object({ name: text(80), startsOn: dateOnly, endsOn: dateOnly }))
    .min(1)
    .max(12),
  activePeriodIndex: z.number().int().min(0).default(0),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ---- Academic structure -----------------------------------------------------------------------
export const periodCreateSchema = z.object({
  academicYearId: id,
  name: text(80),
  kind: z.enum(["trimester", "semester", "quarter", "custom"]),
  startsOn: dateOnly,
  endsOn: dateOnly,
});
export const yearCreateSchema = z.object({ programId: id, label: text(60), startsOn: dateOnly, endsOn: dateOnly });

export const courseCreateSchema = z.object({
  periodId: id,
  title: text(200),
  code: optText(30).optional(),
  description: optText(5000).optional(),
  credits: z.number().min(0).max(60).optional(),
  color: z.enum(COURSE_COLORS).optional(),
  instructorName: optText(120).optional(),
  includeInGpa: z.boolean().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  targetPercent: z.number().min(0).max(100).nullable().optional(),
});
export const courseUpdateSchema = courseCreateSchema.omit({ periodId: true }).extend({ pinned: z.boolean().optional() }).partial();

export const topicCreateSchema = z.object({ title: text(200) });
export const topicUpdateSchema = z.object({ title: text(200).optional(), status: z.enum(["not_started", "in_progress", "covered", "mastered"]).optional() });

export const assessmentCreateSchema = z.object({
  title: text(200),
  kind: z.enum(ASSESSMENT_KINDS).optional(),
  weightPercent: z.number().min(0).max(100),
  maxScore: z.number().positive().max(1_000_000).optional(),
  score: z.number().min(0).max(1_000_000).nullable().optional(),
  dueAt: isoDateTime.nullable().optional(),
});
export const assessmentUpdateSchema = assessmentCreateSchema.partial();

export const classSessionSchema = z
  .object({
    courseId: id,
    weekday: z.number().int().min(1).max(7),
    startsAt: timeOfDay,
    endsAt: timeOfDay,
    kind: z.enum(["lecture", "lab", "seminar", "tutorial", "other"]).default("lecture"),
    location: optText(120).optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start", path: ["endsAt"] });

// ---- Tasks ------------------------------------------------------------------------------------
export const taskCreateSchema = z.object({
  title: text(300),
  notes: optText(5000).optional(),
  courseId: id.nullable().optional(),
  assessmentId: id.nullable().optional(),
  parentTaskId: id.nullable().optional(),
  kind: z.enum(["task", "assignment"]).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  dueAt: isoDateTime.nullable().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  remindAt: z.array(isoDateTime).max(5).optional(),
});
export const taskUpdateSchema = taskCreateSchema.omit({ parentTaskId: true, remindAt: true }).extend({ status: z.enum(["todo", "in_progress", "done"]).optional() }).partial();

export const taskListQuerySchema = z.object({
  status: z.enum(["open", "done", "all"]).default("open"),
  courseId: id.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const noteSchema = z
  .object({ title: optText(200).optional(), body: z.string().max(50_000).optional(), courseId: id.nullable().optional(), pinned: z.boolean().optional() })
  .refine((v) => (v.title ?? "") !== "" || (v.body ?? "").trim() !== "", { message: "A note needs a title or some text" });
export const noteUpdateSchema = z.object({ title: optText(200), body: z.string().max(50_000), courseId: id.nullable(), pinned: z.boolean() }).partial();

export const notificationActionSchema = z.object({ action: z.enum(["read", "unread", "archive", "snooze"]), snoozeHours: z.number().int().min(1).max(24 * 14).optional() });

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(100) });
