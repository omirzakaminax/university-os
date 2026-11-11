import type { Tx } from "@/server/db/client";

/** Every user-owned table, in dependency order. Kept explicit so a new table must be added deliberately
 *  (tests/db/rls.test.ts fails if a user-owned table is missing from this list). */
export const EXPORT_TABLES = [
  "institutions",
  "grading_scales",
  "grading_scale_bands",
  "academic_programs",
  "academic_years",
  "academic_periods",
  "instructors",
  "courses",
  "course_topics",
  "assessments",
  "class_sessions",
  "tasks",
  "reminders",
  "notes",
  "notifications",
  "audit_logs",
  "grade_requirements",
  "documents",
  "syllabus_imports",
  "ai_usage",
] as const;

/**
 * User-owned tables deliberately NOT in the JSON export, with the reason. The catalog test requires every
 * user-owned table to be either exported or listed here, so nothing can be forgotten silently.
 */
export const EXPORT_EXCLUDED: Record<string, string> = {
  document_blobs: "Binary file contents — download each file from its document (GET /api/v1/documents/:id/file). A bundled ZIP export is planned.",
  document_chunks: "Derived search index; rebuilt automatically from the original files.",
};

/** GDPR-style data portability: a complete JSON export of the caller's own data. RLS scopes every query. */
export async function exportAllData(tx: Tx): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), format: "university-os-export/1" };
  const [profile] = await tx`select display_name, timezone, locale, onboarding_completed_at, created_at from profiles`;
  const [prefs] = await tx`select sidebar_collapsed, week_starts_on, dashboard_widgets, notification_preferences, active_period_id from user_preferences`;
  out.profile = profile;
  out.preferences = prefs;
  for (const t of EXPORT_TABLES) out[t] = await tx`select * from ${tx(t)}`;
  return out;
}
