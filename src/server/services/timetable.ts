import type { Tx } from "@/server/db/client";
import { notFound } from "@/server/errors";
import { audit } from "@/server/services/audit";
import { isoWeekday } from "@/lib/time";
import type { z } from "zod";
import type { classSessionSchema } from "@/server/schemas";

export interface ClassSessionRow {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCode: string | null;
  courseColor: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  kind: string;
  location: string | null;
}

const cols = (tx: Tx) => tx`s.id, s.course_id, c.title as course_title, c.code as course_code, c.color as course_color,
  s.weekday, to_char(s.starts_at, 'HH24:MI') as starts_at, to_char(s.ends_at, 'HH24:MI') as ends_at, s.kind, s.location`;

export async function listSessions(tx: Tx, opts: { periodId?: string; weekday?: number } = {}): Promise<ClassSessionRow[]> {
  return tx<ClassSessionRow[]>`
    select ${cols(tx)} from class_sessions s join courses c on c.id = s.course_id
    where c.deleted_at is null
      ${opts.periodId ? tx`and c.period_id = ${opts.periodId}` : tx``}
      ${opts.weekday ? tx`and s.weekday = ${opts.weekday}` : tx``}
    order by s.weekday, s.starts_at`;
}

/** Classes happening on a calendar date (derived from the weekly pattern of courses in the given period). */
export async function sessionsOnDate(tx: Tx, date: string, periodId?: string) {
  return listSessions(tx, { weekday: isoWeekday(date), periodId });
}

export async function createSession(tx: Tx, input: z.infer<typeof classSessionSchema>) {
  const [row] = await tx<{ id: string }[]>`
    insert into class_sessions (course_id, weekday, starts_at, ends_at, kind, location)
    values (${input.courseId}, ${input.weekday}, ${input.startsAt}, ${input.endsAt}, ${input.kind}, ${input.location ?? null}) returning id`;
  await audit(tx, "class_session.created", "class_session", row!.id);
  return row!;
}

export async function deleteSession(tx: Tx, sessionId: string) {
  const rows = await tx`delete from class_sessions where id = ${sessionId} returning id`;
  if (rows.length === 0) throw notFound("Class");
}
