import type { Tx } from "@/server/db/client";
import type { AcademicContext } from "@/server/services/academics";
import { sessionsOnDate, type ClassSessionRow } from "@/server/services/timetable";
import { gpaFor, loadGradebook, type GradebookCourse } from "@/server/services/grades";
import { listCourses, type CourseRow } from "@/server/services/courses";
import { listNotes, type NoteRow } from "@/server/services/notes";
import { listTasks, type TaskRow } from "@/server/services/tasks";
import { todayInTz } from "@/lib/time";

export interface DeadlineItem {
  type: "task" | "assessment";
  id: string;
  title: string;
  dueAt: string;
  courseTitle: string | null;
  courseColor: string | null;
  href: string;
  priority?: number;
}

export interface ExamItem { id: string; title: string; kind: string; dueAt: string; courseId: string; courseTitle: string; courseColor: string }

export interface DashboardData {
  today: string;
  sessions: ClassSessionRow[];
  deadlines: DeadlineItem[];
  exams: ExamItem[];
  tasks: TaskRow[];
  courses: CourseRow[];
  notes: NoteRow[];
  performance: {
    periodGpa: { gpa: number | null; credits: number; maxPoints: number };
    cumulativeGpa: { gpa: number | null; credits: number; maxPoints: number };
    courses: GradebookCourse[];
  };
}

const HORIZON_DAYS = 14;

export async function loadDashboard(tx: Tx, ctx: AcademicContext, tz: string, now: Date = new Date()): Promise<DashboardData> {
  const today = todayInTz(tz, now);
  const nowIso = now.toISOString();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000).toISOString();
  const examHorizon = new Date(now.getTime() + 90 * 86_400_000).toISOString();

  const [sessions, taskDeadlines, assessmentDeadlines, exams, tasks, allCourses, notes, gradebook] = await Promise.all([
    sessionsOnDate(tx, today, ctx.activePeriod.id),
    tx<DeadlineItem[]>`
      select 'task' as type, t.id, t.title, t.due_at, c.title as course_title, c.color as course_color, '/tasks' as href, t.priority
      from tasks t left join courses c on c.id = t.course_id
      where t.status <> 'done' and t.deleted_at is null and t.due_at is not null and t.due_at <= ${horizon} order by t.due_at limit 12`,
    tx<DeadlineItem[]>`
      select 'assessment' as type, a.id, a.title, a.due_at, c.title as course_title, c.color as course_color, '/courses/' || c.id as href
      from assessments a join courses c on c.id = a.course_id
      where a.score is null and c.deleted_at is null and a.kind not in ('midterm', 'final', 'exam') and a.due_at is not null and a.due_at >= ${nowIso} and a.due_at <= ${horizon}
      order by a.due_at limit 12`,
    tx<ExamItem[]>`
      select a.id, a.title, a.kind, a.due_at, c.id as course_id, c.title as course_title, c.color as course_color
      from assessments a join courses c on c.id = a.course_id
      where a.score is null and c.deleted_at is null and a.kind in ('midterm', 'final', 'exam') and a.due_at >= ${nowIso} and a.due_at <= ${examHorizon}
      order by a.due_at limit 6`,
    listTasks(tx, { status: "open", limit: 50 }),
    listCourses(tx),
    listNotes(tx, 4),
    loadGradebook(tx, ctx.scale),
  ]);

  const deadlines = [...taskDeadlines, ...assessmentDeadlines].sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1)).slice(0, 8);
  const topTasks = tasks
    .filter((t) => !t.parentTaskId)
    .sort((a, b) => b.priority - a.priority || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"))
    .slice(0, 6);
  const inPeriod = gradebook.filter((c) => c.periodId === ctx.activePeriod.id);
  const period = gpaFor(inPeriod, ctx.scale);
  const cumulative = gpaFor(gradebook, ctx.scale);

  return {
    today,
    sessions,
    deadlines,
    exams,
    tasks: topTasks,
    courses: allCourses.filter((c) => c.pinned && c.periodId === ctx.activePeriod.id),
    notes,
    performance: {
      periodGpa: { gpa: period.gpa, credits: period.credits, maxPoints: period.maxPoints },
      cumulativeGpa: { gpa: cumulative.gpa, credits: cumulative.credits, maxPoints: cumulative.maxPoints },
      courses: inPeriod,
    },
  };
}
