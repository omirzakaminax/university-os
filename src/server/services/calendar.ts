import type { Tx } from "@/server/db/client";
import { dateInTz, zonedLocalToUtc } from "@/lib/time";

export interface CalendarItem {
  type: "task" | "assessment";
  id: string;
  title: string;
  /** Local calendar date (YYYY-MM-DD) in the user's timezone. */
  date: string;
  dueAt: string;
  done: boolean;
  isExam: boolean;
  courseColor: string | null;
  href: string;
}

/** Tasks and assessments due within [monthStart, nextMonthStart), bucketed by the user's local date. */
export async function loadCalendarMonth(tx: Tx, year: number, month: number, tz: string): Promise<CalendarItem[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = zonedLocalToUtc(`${year}-${pad(month)}-01`, tz);
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const end = zonedLocalToUtc(`${ny}-${pad(nm)}-01`, tz);
  const tasks = await tx<{ id: string; title: string; dueAt: string; status: string; courseColor: string | null }[]>`
    select t.id, t.title, t.due_at, t.status, c.color as course_color from tasks t left join courses c on c.id = t.course_id
    where t.deleted_at is null and t.due_at >= ${start} and t.due_at < ${end} order by t.due_at`;
  const assessments = await tx<{ id: string; title: string; dueAt: string; kind: string; score: number | null; courseId: string; courseColor: string }[]>`
    select a.id, a.title, a.due_at, a.kind, a.score, c.id as course_id, c.color as course_color from assessments a join courses c on c.id = a.course_id
    where c.deleted_at is null and a.due_at >= ${start} and a.due_at < ${end} order by a.due_at`;
  return [
    ...tasks.map((t): CalendarItem => ({ type: "task", id: t.id, title: t.title, date: dateInTz(new Date(t.dueAt), tz), dueAt: t.dueAt, done: t.status === "done", isExam: false, courseColor: t.courseColor, href: "/tasks" })),
    ...assessments.map((a): CalendarItem => ({ type: "assessment", id: a.id, title: a.title, date: dateInTz(new Date(a.dueAt), tz), dueAt: a.dueAt, done: a.score !== null, isExam: ["midterm", "final", "exam"].includes(a.kind), courseColor: a.courseColor, href: `/courses/${a.courseId}` })),
  ].sort((x, y) => (x.dueAt < y.dueAt ? -1 : 1));
}
