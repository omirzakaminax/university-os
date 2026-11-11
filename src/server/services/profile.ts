import type { Tx } from "@/server/db/client";
import { AppError, validation } from "@/server/errors";
import { normalizeWidgetPrefs, type WidgetPref } from "@/domain/widgets";
import { validateScale } from "@/domain/grades/engine";
import { audit } from "@/server/services/audit";
import { setClause } from "@/server/db/patch";
import type { OnboardingInput } from "@/server/schemas";
import { profileUpdateSchema, preferencesUpdateSchema } from "@/server/schemas";
import type { z } from "zod";

export interface Profile {
  id: string;
  displayName: string;
  timezone: string;
  locale: string;
  onboardingCompletedAt: string | null;
}

export interface Preferences {
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";
  weekStartsOn: number;
  dashboardWidgets: WidgetPref[];
  notificationPreferences: Record<string, boolean>;
  activePeriodId: string | null;
}

export async function getProfile(tx: Tx): Promise<Profile> {
  const [p] = await tx<Profile[]>`select id, display_name, timezone, locale, onboarding_completed_at from profiles`;
  if (!p) throw new AppError("not_found", "Profile not found");
  return p;
}

export async function getPreferences(tx: Tx): Promise<Preferences> {
  const [r] = await tx<(Omit<Preferences, "dashboardWidgets"> & { dashboardWidgets: unknown })[]>`
    select sidebar_collapsed, theme, week_starts_on, dashboard_widgets, notification_preferences, active_period_id from user_preferences`;
  if (!r) throw new AppError("not_found", "Preferences not found");
  return { ...r, dashboardWidgets: normalizeWidgetPrefs(r.dashboardWidgets) };
}

export async function updateProfile(tx: Tx, input: z.infer<typeof profileUpdateSchema>) {
  const set = setClause(tx, input);
  if (set) await tx`update profiles set ${set}`;
  return getProfile(tx);
}

export async function updatePreferences(tx: Tx, input: z.infer<typeof preferencesUpdateSchema>) {
  const { dashboardWidgets, notificationPreferences, ...rest } = input;
  const patch: Record<string, unknown> = { ...rest };
  if (dashboardWidgets) patch.dashboardWidgets = tx.json(normalizeWidgetPrefs(dashboardWidgets) as never);
  if (notificationPreferences) patch.notificationPreferences = tx.json(notificationPreferences as never);
  const set = setClause(tx, patch);
  if (set) await tx`update user_preferences set ${set}`;
  return getPreferences(tx);
}

/**
 * Create the user's own academic workspace in one transaction (the caller already runs inside withUser):
 * institution → grading scale + bands → programme → academic year → periods; then mark onboarding done.
 */
export async function completeOnboarding(tx: Tx, input: OnboardingInput): Promise<{ activePeriodId: string }> {
  const profile = await getProfile(tx);
  if (profile.onboardingCompletedAt) throw new AppError("conflict", "Onboarding is already complete");

  const scaleErrors = validateScale(input.grading.bands);
  if (scaleErrors.length) throw validation(scaleErrors[0]!, { grading: scaleErrors.join(" ") });
  if (input.year.endsOn <= input.year.startsOn) throw validation("The academic year must end after it starts", { year: "End date must be after the start date" });
  for (const p of input.periods) {
    if (p.endsOn <= p.startsOn) throw validation(`${p.name} must end after it starts`, { periods: `${p.name}: end date must be after the start date` });
  }
  if (input.activePeriodIndex >= input.periods.length) throw validation("Choose a valid current period");

  const [inst] = await tx<{ id: string }[]>`
    insert into institutions (name, short_name, country, timezone)
    values (${input.institution.name}, ${input.institution.shortName}, ${input.institution.country}, ${input.timezone}) returning id`;
  const [scale] = await tx<{ id: string }[]>`
    insert into grading_scales (institution_id, name, rounding, max_points)
    values (${inst!.id}, ${input.grading.name}, ${input.grading.rounding}, ${input.grading.maxPoints}) returning id`;
  for (const b of input.grading.bands) {
    await tx`insert into grading_scale_bands (scale_id, letter, min_percent, points) values (${scale!.id}, ${b.letter}, ${b.minPercent}, ${b.points})`;
  }
  const [prog] = await tx<{ id: string }[]>`
    insert into academic_programs (institution_id, grading_scale_id, name, degree_level, major, period_system)
    values (${inst!.id}, ${scale!.id}, ${input.program.name}, ${input.program.degreeLevel}, ${input.program.major}, ${input.program.periodSystem}) returning id`;
  const [year] = await tx<{ id: string }[]>`
    insert into academic_years (program_id, label, starts_on, ends_on) values (${prog!.id}, ${input.year.label}, ${input.year.startsOn}, ${input.year.endsOn}) returning id`;
  const periodIds: string[] = [];
  for (const [i, p] of input.periods.entries()) {
    const [row] = await tx<{ id: string }[]>`
      insert into academic_periods (academic_year_id, name, kind, position, starts_on, ends_on)
      values (${year!.id}, ${p.name}, ${input.program.periodSystem}, ${i + 1}, ${p.startsOn}, ${p.endsOn}) returning id`;
    periodIds.push(row!.id);
  }
  const activePeriodId = periodIds[input.activePeriodIndex]!;
  await tx`update user_preferences set active_period_id = ${activePeriodId}`;
  await tx`update profiles set display_name = ${input.displayName}, timezone = ${input.timezone}, onboarding_completed_at = now()`;
  await audit(tx, "onboarding.completed", "academic_program", prog!.id);
  return { activePeriodId };
}
