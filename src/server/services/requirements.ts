import type { Tx } from "@/server/db/client";
import { notFound } from "@/server/errors";
import { audit } from "@/server/services/audit";
import type { Requirement } from "@/domain/grades/requirements";
import { z } from "zod";
import { id as uuid } from "@/server/schemas";

export const requirementSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  kind: z.enum(["course_percent", "final_exam_percent", "period_gpa", "cumulative_gpa"]),
  threshold: z.number().min(0).max(100),
  courseId: uuid.nullish(),
  sourceNote: z.string().trim().max(500).nullish(),
});

export interface RequirementRow extends Requirement { sourceNote: string | null }

export async function listRequirements(tx: Tx): Promise<RequirementRow[]> {
  return tx<RequirementRow[]>`select id, name, kind, threshold, course_id, source_note from grade_requirements order by created_at`;
}

export async function createRequirement(tx: Tx, input: z.infer<typeof requirementSchema>) {
  const gpaKind = input.kind === "period_gpa" || input.kind === "cumulative_gpa";
  const [row] = await tx<{ id: string }[]>`
    insert into grade_requirements (name, kind, threshold, course_id, source_note)
    values (${input.name}, ${input.kind}, ${input.threshold}, ${gpaKind ? null : (input.courseId ?? null)}, ${input.sourceNote || null}) returning id`;
  await audit(tx, "requirement.created", "grade_requirement", row!.id);
  return row!;
}

export async function deleteRequirement(tx: Tx, requirementId: string) {
  const rows = await tx`delete from grade_requirements where id = ${requirementId} returning id`;
  if (rows.length === 0) throw notFound("Requirement");
}
