import type { Tx } from "@/server/db/client";
import { notFound, validation } from "@/server/errors";
import { audit } from "@/server/services/audit";
import { definedEntries, setClause } from "@/server/db/patch";
import type { z } from "zod";
import type { courseCreateSchema, courseUpdateSchema, topicCreateSchema, topicUpdateSchema, assessmentCreateSchema, assessmentUpdateSchema } from "@/server/schemas";

export interface CourseRow {
  id: string;
  periodId: string;
  code: string | null;
  title: string;
  description: string | null;
  credits: number;
  color: string;
  pinned: boolean;
  includeInGpa: boolean;
  status: "active" | "completed" | "archived";
  targetPercent: number | null;
  instructorId: string | null;
  instructorName: string | null;
  openTasks: number;
  nextDueAt: string | null;
}

const courseSelect = (tx: Tx) => tx`
  c.id, c.period_id, c.code, c.title, c.description, c.credits, c.color, c.pinned, c.include_in_gpa, c.status, c.target_percent,
  c.instructor_id, i.name as instructor_name,
  (select count(*) from tasks t where t.course_id = c.id and t.status <> 'done' and t.deleted_at is null and t.parent_task_id is null) as open_tasks,
  (select min(t.due_at) from tasks t where t.course_id = c.id and t.status <> 'done' and t.deleted_at is null and t.due_at > now()) as next_due_at`;

export async function listCourses(tx: Tx, opts: { periodId?: string; status?: "active" | "completed" | "archived" | "all" } = {}): Promise<CourseRow[]> {
  return tx<CourseRow[]>`
    select ${courseSelect(tx)}
    from courses c left join instructors i on i.id = c.instructor_id
    where c.deleted_at is null ${opts.periodId ? tx`and c.period_id = ${opts.periodId}` : tx``}
      ${opts.status === "all" ? tx`` : opts.status ? tx`and c.status = ${opts.status}` : tx`and c.status <> 'archived'`}
    order by c.pinned desc, lower(c.title)`;
}

export async function getCourse(tx: Tx, courseId: string): Promise<CourseRow> {
  const [c] = await tx<CourseRow[]>`
    select ${courseSelect(tx)} from courses c left join instructors i on i.id = c.instructor_id
    where c.id = ${courseId} and c.deleted_at is null`;
  if (!c) throw notFound("Course");
  return c;
}

async function resolveInstructor(tx: Tx, name: string | null | undefined): Promise<string | null | undefined> {
  if (name === undefined) return undefined;
  if (name === null) return null;
  const [existing] = await tx<{ id: string }[]>`select id from instructors where lower(name) = lower(${name}) limit 1`;
  if (existing) return existing.id;
  const [created] = await tx<{ id: string }[]>`insert into instructors (name) values (${name}) returning id`;
  return created!.id;
}

export async function createCourse(tx: Tx, input: z.infer<typeof courseCreateSchema>) {
  const instructorId = await resolveInstructor(tx, input.instructorName);
  const values = definedEntries({
    periodId: input.periodId,
    instructorId,
    code: input.code,
    title: input.title,
    description: input.description,
    credits: input.credits,
    color: input.color,
    includeInGpa: input.includeInGpa,
    status: input.status,
    targetPercent: input.targetPercent,
  });
  const [row] = await tx<{ id: string }[]>`insert into courses ${tx(values as Record<string, never>)} returning id`;
  await audit(tx, "course.created", "course", row!.id);
  return row!;
}

export async function updateCourse(tx: Tx, courseId: string, input: z.infer<typeof courseUpdateSchema>) {
  const { instructorName, ...rest } = input;
  const instructorId = await resolveInstructor(tx, instructorName);
  const set = setClause(tx, { ...rest, instructorId });
  if (set) {
    const rows = await tx`update courses set ${set} where id = ${courseId} and deleted_at is null returning id`;
    if (rows.length === 0) throw notFound("Course");
  } else await getCourse(tx, courseId);
  return getCourse(tx, courseId);
}

/** Soft delete: the course (and its assessments/topics) can be restored from the database; tasks keep history. */
export async function deleteCourse(tx: Tx, courseId: string) {
  const rows = await tx`update courses set deleted_at = now(), pinned = false where id = ${courseId} and deleted_at is null returning id`;
  if (rows.length === 0) throw notFound("Course");
  await audit(tx, "course.deleted", "course", courseId);
}

// ---- Topics -----------------------------------------------------------------------------------
export interface Topic { id: string; courseId: string; title: string; position: number; status: "not_started" | "in_progress" | "covered" | "mastered" }

export async function listTopics(tx: Tx, courseId: string): Promise<Topic[]> {
  return tx<Topic[]>`select id, course_id, title, position, status from course_topics where course_id = ${courseId} order by position, created_at`;
}

export async function addTopic(tx: Tx, courseId: string, input: z.infer<typeof topicCreateSchema>) {
  await getCourse(tx, courseId);
  const [row] = await tx<Topic[]>`
    insert into course_topics (course_id, title, position)
    values (${courseId}, ${input.title}, (select coalesce(max(position), 0) + 1 from course_topics where course_id = ${courseId}))
    returning id, course_id, title, position, status`;
  return row!;
}

export async function updateTopic(tx: Tx, topicId: string, input: z.infer<typeof topicUpdateSchema>) {
  const set = setClause(tx, input);
  if (!set) throw validation("Nothing to update");
  const rows = await tx`update course_topics set ${set} where id = ${topicId} returning id`;
  if (rows.length === 0) throw notFound("Topic");
}

export async function deleteTopic(tx: Tx, topicId: string) {
  const rows = await tx`delete from course_topics where id = ${topicId} returning id`;
  if (rows.length === 0) throw notFound("Topic");
}

// ---- Assessments ------------------------------------------------------------------------------
export interface AssessmentRow {
  id: string;
  courseId: string;
  title: string;
  kind: string;
  weightPercent: number;
  maxScore: number;
  score: number | null;
  dueAt: string | null;
  gradedAt: string | null;
  origin: string;
  importedAt: string | null;
}

const assessmentCols = (tx: Tx) => tx`id, course_id, title, kind, weight_percent, max_score, score, due_at, graded_at, origin, imported_at`;

export async function listAssessments(tx: Tx, courseId: string): Promise<AssessmentRow[]> {
  return tx<AssessmentRow[]>`select ${assessmentCols(tx)} from assessments where course_id = ${courseId} order by due_at nulls last, created_at`;
}

export async function addAssessment(tx: Tx, courseId: string, input: z.infer<typeof assessmentCreateSchema>) {
  await getCourse(tx, courseId);
  const values = definedEntries({
    courseId,
    title: input.title,
    kind: input.kind,
    weightPercent: input.weightPercent,
    maxScore: input.maxScore,
    score: input.score,
    dueAt: input.dueAt,
    gradedAt: input.score != null ? new Date().toISOString() : undefined,
  });
  const [row] = await tx<AssessmentRow[]>`insert into assessments ${tx(values as Record<string, never>)} returning ${assessmentCols(tx)}`;
  await audit(tx, "assessment.created", "assessment", row!.id);
  return row!;
}

export async function updateAssessment(tx: Tx, assessmentId: string, input: z.infer<typeof assessmentUpdateSchema>) {
  const patch: Record<string, unknown> = { ...input };
  if ("score" in input) patch.gradedAt = input.score == null ? null : new Date().toISOString();
  const set = setClause(tx, patch);
  if (!set) throw validation("Nothing to update");
  const rows = await tx<AssessmentRow[]>`update assessments set ${set} where id = ${assessmentId} returning ${assessmentCols(tx)}`;
  if (rows.length === 0) throw notFound("Assessment");
  await audit(tx, input.score !== undefined ? "grade.recorded" : "assessment.updated", "assessment", assessmentId);
  return rows[0]!;
}

export async function deleteAssessment(tx: Tx, assessmentId: string) {
  const rows = await tx`delete from assessments where id = ${assessmentId} returning id`;
  if (rows.length === 0) throw notFound("Assessment");
  await audit(tx, "assessment.deleted", "assessment", assessmentId);
}
