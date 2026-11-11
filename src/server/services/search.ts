import type { Tx } from "@/server/db/client";

export interface SearchHit {
  type: "course" | "task" | "note" | "assessment";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

/** Escape LIKE wildcards so user input is matched literally. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;

/** Search the signed-in user's own data (RLS guarantees nobody else's rows can match). */
export async function searchAll(tx: Tx, q: string, perType = 5): Promise<SearchHit[]> {
  const p = likePattern(q);
  const [courses, tasks, notes, assessments] = await Promise.all([
    tx<{ id: string; title: string; code: string | null }[]>`select id, title, code from courses where deleted_at is null and (title ilike ${p} or code ilike ${p}) order by title limit ${perType}`,
    tx<{ id: string; title: string; status: string }[]>`select id, title, status from tasks where deleted_at is null and title ilike ${p} order by (status = 'done'), due_at nulls last limit ${perType}`,
    tx<{ id: string; title: string; body: string }[]>`select id, title, body from notes where deleted_at is null and (title ilike ${p} or body ilike ${p}) order by updated_at desc limit ${perType}`,
    tx<{ id: string; title: string; courseId: string; courseTitle: string }[]>`
      select a.id, a.title, a.course_id, c.title as course_title from assessments a join courses c on c.id = a.course_id
      where c.deleted_at is null and a.title ilike ${p} order by a.title limit ${perType}`,
  ]);
  return [
    ...courses.map((c): SearchHit => ({ type: "course", id: c.id, title: c.title, subtitle: c.code, href: `/courses/${c.id}` })),
    ...tasks.map((t): SearchHit => ({ type: "task", id: t.id, title: t.title, subtitle: t.status === "done" ? "Completed task" : "Task", href: "/tasks" })),
    ...assessments.map((a): SearchHit => ({ type: "assessment", id: a.id, title: a.title, subtitle: a.courseTitle, href: `/courses/${a.courseId}` })),
    ...notes.map((n): SearchHit => ({ type: "note", id: n.id, title: n.title || n.body.slice(0, 60), subtitle: "Note", href: "/notes" })),
  ];
}
