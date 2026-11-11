import type { Tx } from "@/server/db/client";
import { AppError, notFound, validation } from "@/server/errors";
import type { GradingScale, GradeBand } from "@/domain/grades/engine";
import { validateScale } from "@/domain/grades/engine";
import { audit } from "@/server/services/audit";
import { yearCreateSchema, periodCreateSchema, bandSchema } from "@/server/schemas";
import type { z } from "zod";

export interface Institution { id: string; name: string; shortName: string | null; country: string | null; timezone: string }
export interface Program { id: string; name: string; degreeLevel: string; major: string | null; periodSystem: "trimester" | "semester" | "quarter" | "custom"; institutionId: string; gradingScaleId: string | null }
export interface Period { id: string; academicYearId: string; yearLabel: string; name: string; kind: string; position: number; startsOn: string; endsOn: string; archivedAt: string | null }
export interface Year { id: string; programId: string; label: string; startsOn: string; endsOn: string }

export interface AcademicContext {
  institution: Institution;
  program: Program;
  years: Year[];
  periods: Period[];
  /** The period the UI is currently focused on. */
  activePeriod: Period;
  scale: ScaleWithPolicy;
}

/** Pick the active period: explicit preference → period containing today → most recently started → first. */
export function chooseActivePeriod(periods: Period[], preferredId: string | null, today: string): Period | null {
  if (periods.length === 0) return null;
  const preferred = periods.find((p) => p.id === preferredId);
  if (preferred) return preferred;
  const current = periods.find((p) => p.startsOn <= today && today <= p.endsOn);
  if (current) return current;
  const started = periods.filter((p) => p.startsOn <= today).sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1));
  return started[0] ?? [...periods].sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1))[0]!;
}

export async function getAcademicContext(tx: Tx, today: string): Promise<AcademicContext | null> {
  const [program] = await tx<Program[]>`select id, name, degree_level, major, period_system, institution_id, grading_scale_id from academic_programs order by created_at limit 1`;
  if (!program) return null;
  const [institution] = await tx<Institution[]>`select id, name, short_name, country, timezone from institutions where id = ${program.institutionId}`;
  const years = await tx<Year[]>`select id, program_id, label, starts_on, ends_on from academic_years where program_id = ${program.id} order by starts_on`;
  const periods = await tx<Period[]>`
    select p.id, p.academic_year_id, y.label as year_label, p.name, p.kind, p.position, p.starts_on, p.ends_on, p.archived_at
    from academic_periods p join academic_years y on y.id = p.academic_year_id
    order by p.starts_on`;
  const [prefs] = await tx<{ activePeriodId: string | null }[]>`select active_period_id from user_preferences`;
  const activePeriod = chooseActivePeriod(periods, prefs?.activePeriodId ?? null, today);
  const scale = program.gradingScaleId ? await getScale(tx, program.gradingScaleId) : null;
  if (!institution || !activePeriod || !scale) return null;
  return { institution, program, years, periods, activePeriod, scale };
}

export type ScaleWithPolicy = GradingScale & { id: string; name: string; passPercent: number | null; minFinalPercent: number | null };

export async function getScale(tx: Tx, scaleId: string): Promise<ScaleWithPolicy> {
  const [s] = await tx<{ id: string; name: string; rounding: "none" | "half_up"; maxPoints: number; passPercent: number | null; minFinalPercent: number | null }[]>`select id, name, rounding, max_points, pass_percent, min_final_percent from grading_scales where id = ${scaleId}`;
  if (!s) throw notFound("Grading scale");
  const bands = await tx<GradeBand[]>`select letter, min_percent, points from grading_scale_bands where scale_id = ${scaleId} order by min_percent desc`;
  return { ...s, bands };
}

export async function replaceScaleBands(tx: Tx, scaleId: string, bands: z.infer<typeof bandSchema>[], rounding?: "none" | "half_up", policy?: { passPercent: number | null; minFinalPercent: number | null }) {
  const errors = validateScale(bands);
  if (errors.length) throw validation(errors[0]!, { bands: errors.join(" ") });
  const letters = new Set(bands.map((b) => b.letter));
  if (letters.size !== bands.length) throw validation("Each letter can only appear once");
  const [exists] = await tx`select 1 from grading_scales where id = ${scaleId}`;
  if (!exists) throw notFound("Grading scale");
  await tx`delete from grading_scale_bands where scale_id = ${scaleId}`;
  for (const b of bands) await tx`insert into grading_scale_bands (scale_id, letter, min_percent, points) values (${scaleId}, ${b.letter}, ${b.minPercent}, ${b.points})`;
  if (rounding) await tx`update grading_scales set rounding = ${rounding} where id = ${scaleId}`;
  if (policy) await tx`update grading_scales set pass_percent = ${policy.passPercent}, min_final_percent = ${policy.minFinalPercent} where id = ${scaleId}`;
  await audit(tx, "grading_scale.updated", "grading_scale", scaleId);
}

export async function createYear(tx: Tx, input: z.infer<typeof yearCreateSchema>) {
  if (input.endsOn <= input.startsOn) throw validation("The year must end after it starts", { endsOn: "End must be after start" });
  const [row] = await tx<{ id: string }[]>`insert into academic_years (program_id, label, starts_on, ends_on) values (${input.programId}, ${input.label}, ${input.startsOn}, ${input.endsOn}) returning id`;
  await audit(tx, "academic_year.created", "academic_year", row!.id);
  return row!;
}

export async function createPeriod(tx: Tx, input: z.infer<typeof periodCreateSchema>) {
  if (input.endsOn <= input.startsOn) throw validation("The period must end after it starts", { endsOn: "End must be after start" });
  const [pos] = await tx<{ n: number }[]>`select coalesce(max(position), 0) + 1 as n from academic_periods where academic_year_id = ${input.academicYearId}`;
  const [row] = await tx<{ id: string }[]>`
    insert into academic_periods (academic_year_id, name, kind, position, starts_on, ends_on)
    values (${input.academicYearId}, ${input.name}, ${input.kind}, ${pos!.n}, ${input.startsOn}, ${input.endsOn}) returning id`;
  await audit(tx, "academic_period.created", "academic_period", row!.id);
  return row!;
}

export async function setActivePeriod(tx: Tx, periodId: string) {
  const [p] = await tx`select 1 from academic_periods where id = ${periodId}`;
  if (!p) throw notFound("Period");
  await tx`update user_preferences set active_period_id = ${periodId}`;
}

export async function setPeriodArchived(tx: Tx, periodId: string, archived: boolean) {
  const rows = await tx`update academic_periods set archived_at = ${archived ? new Date().toISOString() : null} where id = ${periodId} returning id`;
  if (rows.length === 0) throw new AppError("not_found", "Period not found");
  await audit(tx, archived ? "academic_period.archived" : "academic_period.unarchived", "academic_period", periodId);
}
