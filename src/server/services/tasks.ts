import type { Tx } from "@/server/db/client";
import { notFound, validation } from "@/server/errors";
import { audit } from "@/server/services/audit";
import { definedEntries, setClause } from "@/server/db/patch";
import { nextOccurrence, recurrenceSchema, type Recurrence } from "@/domain/recurrence";
import type { z } from "zod";
import type { taskCreateSchema, taskUpdateSchema, taskListQuerySchema } from "@/server/schemas";

export interface TaskRow {
  id: string;
  courseId: string | null;
  courseTitle: string | null;
  courseColor: string | null;
  assessmentId: string | null;
  parentTaskId: string | null;
  kind: "task" | "assignment";
  title: string;
  notes: string | null;
  status: "todo" | "in_progress" | "done";
  priority: number;
  dueAt: string | null;
  completedAt: string | null;
  recurrence: Recurrence | null;
  createdAt: string;
}

const cols = (tx: Tx) => tx`
  t.id, t.course_id, c.title as course_title, c.color as course_color, t.assessment_id, t.parent_task_id, t.kind, t.title, t.notes,
  t.status, t.priority, t.due_at, t.completed_at, t.recurrence, t.created_at`;

export async function listTasks(tx: Tx, q: z.infer<typeof taskListQuerySchema>): Promise<TaskRow[]> {
  const status = q.status === "open" ? tx`and t.status <> 'done'` : q.status === "done" ? tx`and t.status = 'done'` : tx``;
  const course = q.courseId ? tx`and t.course_id = ${q.courseId}` : tx``;
  return tx<TaskRow[]>`
    select ${cols(tx)} from tasks t left join courses c on c.id = t.course_id
    where t.deleted_at is null ${status} ${course}
    order by (t.status = 'done'), t.due_at nulls last, t.priority desc, t.created_at desc
    limit ${q.limit}`;
}

export async function getTask(tx: Tx, taskId: string): Promise<TaskRow> {
  const [t] = await tx<TaskRow[]>`select ${cols(tx)} from tasks t left join courses c on c.id = t.course_id where t.id = ${taskId} and t.deleted_at is null`;
  if (!t) throw notFound("Task");
  return t;
}

export async function createTask(tx: Tx, input: z.infer<typeof taskCreateSchema>) {
  if (input.recurrence && !input.dueAt) throw validation("A recurring task needs a due date", { dueAt: "Required for recurring tasks" });
  const { remindAt, recurrence, ...rest } = input;
  const values = definedEntries({ ...rest, recurrence: recurrence ? tx.json(recurrence as never) : recurrence === null ? null : undefined });
  const [row] = await tx<{ id: string }[]>`insert into tasks ${tx(values as Record<string, never>)} returning id`;
  for (const at of remindAt ?? []) await tx`insert into reminders (task_id, remind_at) values (${row!.id}, ${at}) on conflict do nothing`;
  await audit(tx, "task.created", "task", row!.id);
  return getTask(tx, row!.id);
}

export async function updateTask(tx: Tx, taskId: string, input: z.infer<typeof taskUpdateSchema>, tz: string) {
  const { status, recurrence, ...rest } = input;
  const current = await getTask(tx, taskId);
  const patch: Record<string, unknown> = { ...rest };
  if (recurrence !== undefined) patch.recurrence = recurrence ? tx.json(recurrence as never) : null;
  if (status !== undefined) {
    patch.status = status;
    patch.completedAt = status === "done" ? new Date().toISOString() : null;
  }
  const set = setClause(tx, patch);
  if (set) await tx`update tasks set ${set} where id = ${taskId} and deleted_at is null`;
  // Completing a recurring task schedules its next occurrence (exactly once: only on the todo→done transition).
  if (status === "done" && current.status !== "done" && current.recurrence && current.dueAt) {
    const rule = recurrenceSchema.parse(current.recurrence);
    await tx`
      insert into tasks (course_id, assessment_id, parent_task_id, kind, title, notes, priority, due_at, recurrence)
      values (${current.courseId}, ${null}, ${current.parentTaskId}, ${current.kind}, ${current.title}, ${current.notes}, ${current.priority},
              ${nextOccurrence(current.dueAt, rule, tz)}, ${tx.json(rule as never)})`;
    await audit(tx, "task.recurrence_scheduled", "task", taskId);
  }
  if (status === "done" && current.status !== "done") await audit(tx, "task.completed", "task", taskId);
  return getTask(tx, taskId);
}

export async function deleteTask(tx: Tx, taskId: string) {
  const rows = await tx`update tasks set deleted_at = now() where id = ${taskId} and deleted_at is null returning id`;
  if (rows.length === 0) throw notFound("Task");
  // Subtasks go with their parent.
  await tx`update tasks set deleted_at = now() where parent_task_id = ${taskId} and deleted_at is null`;
  await audit(tx, "task.deleted", "task", taskId);
}
