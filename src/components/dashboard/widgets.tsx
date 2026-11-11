import Link from "next/link";
import { BookOpen, CalendarClock, CheckSquare, GraduationCap, NotebookPen, Sparkles } from "lucide-react";
import { Badge, Card, CardHeader, CourseDot, EmptyState, Progress } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DueBadge, fmtGpa, fmtPercent, formatDateTime, PRIORITY } from "@/components/format";
import { TaskCheck } from "@/components/tasks/task-check";
import { QuickNotes } from "@/components/dashboard/quick-notes";
import type { DashboardData } from "@/server/services/dashboard";

interface WidgetProps {
  data: DashboardData;
  tz: string;
  maxPoints: number;
}

function Rows({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line px-1 py-1.5">{children}</ul>;
}

function TodayWidget({ data }: WidgetProps) {
  // Free-time detection between today's classes.
  const gaps: string[] = [];
  for (let i = 1; i < data.sessions.length; i++) {
    const prev = data.sessions[i - 1]!;
    const cur = data.sessions[i]!;
    const mins = toMin(cur.startsAt) - toMin(prev.endsAt);
    if (mins >= 45) gaps.push(`${prev.endsAt}–${cur.startsAt} (${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ""}${mins % 60 ? `${mins % 60}m` : ""})`.replace(" )", ")"));
  }
  return (
    <Card>
      <CardHeader title="Today's timetable" description={`${data.sessions.length} ${data.sessions.length === 1 ? "class" : "classes"}`} action={<Link href="/timetable" className="text-xs text-muted hover:text-fg">Full timetable</Link>} />
      {data.sessions.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-4 w-4" />} title="No classes today" description="Add your weekly classes in the timetable and they will appear here." action={<Link href="/timetable"><Button size="sm">Open timetable</Button></Link>} />
      ) : (
        <>
          <Rows>
            {data.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-24 shrink-0 font-mono text-xs text-muted">{s.startsAt}–{s.endsAt}</span>
                <CourseDot color={s.courseColor} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{s.courseTitle}</span>
                <span className="shrink-0 text-xs text-subtle">{[s.kind, s.location].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </Rows>
          {gaps.length > 0 && <p className="border-t border-line px-4 py-2 text-xs text-subtle">Free time: {gaps.join(", ")}</p>}
        </>
      )}
    </Card>
  );
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function DeadlinesWidget({ data, tz }: WidgetProps) {
  return (
    <Card>
      <CardHeader title="Upcoming deadlines" description="Next 14 days, plus anything overdue" action={<Link href="/tasks" className="text-xs text-muted hover:text-fg">All tasks</Link>} />
      {data.deadlines.length === 0 ? (
        <EmptyState icon={<CheckSquare className="h-4 w-4" />} title="Nothing due soon" description="Tasks and assessments with due dates appear here." />
      ) : (
        <Rows>
          {data.deadlines.map((d) => (
            <li key={`${d.type}:${d.id}`} className="flex items-center gap-2.5 px-3 py-2">
              {d.courseColor ? <CourseDot color={d.courseColor} /> : <span className="h-2 w-2 shrink-0" />}
              <Link href={d.href} className="min-w-0 flex-1 truncate text-[13px] hover:text-accent-text">{d.title}</Link>
              {d.type === "assessment" && <Badge tone="accent">Assessment</Badge>}
              <DueBadge iso={d.dueAt} tz={tz} />
            </li>
          ))}
        </Rows>
      )}
    </Card>
  );
}

function ExamsWidget({ data, tz }: WidgetProps) {
  return (
    <Card>
      <CardHeader title="Upcoming exams" description="Midterms, finals and exams within 90 days" />
      {data.exams.length === 0 ? (
        <EmptyState icon={<GraduationCap className="h-4 w-4" />} title="No exams scheduled" description="Add an exam assessment with a date to a course and it will show up here." />
      ) : (
        <Rows>
          {data.exams.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 px-3 py-2">
              <CourseDot color={e.courseColor} />
              <div className="min-w-0 flex-1">
                <Link href={`/courses/${e.courseId}`} className="block truncate text-[13px] hover:text-accent-text">{e.title}</Link>
                <span className="text-xs text-subtle">{e.courseTitle} · {formatDateTime(e.dueAt, tz)}</span>
              </div>
              <DueBadge iso={e.dueAt} tz={tz} />
            </li>
          ))}
        </Rows>
      )}
    </Card>
  );
}

function TasksWidget({ data, tz }: WidgetProps) {
  return (
    <Card>
      <CardHeader title="Priority tasks" description="Ranked by priority, then due date" action={<Link href="/tasks" className="text-xs text-muted hover:text-fg">Open</Link>} />
      {data.tasks.length === 0 ? (
        <EmptyState icon={<CheckSquare className="h-4 w-4" />} title="You're all caught up" description="Press C anywhere to capture a task." />
      ) : (
        <Rows>
          {data.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 px-3 py-2">
              <TaskCheck id={t.id} done={false} title={t.title} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{t.title}</span>
              {t.priority >= 2 && <Badge tone={PRIORITY[t.priority]!.tone}>{PRIORITY[t.priority]!.label}</Badge>}
              <DueBadge iso={t.dueAt} tz={tz} />
            </li>
          ))}
        </Rows>
      )}
    </Card>
  );
}

function PerformanceWidget({ data, maxPoints }: WidgetProps) {
  const { periodGpa, cumulativeGpa, courses } = data.performance;
  const graded = courses.filter((c) => c.grade.currentPercent !== null);
  return (
    <Card>
      <CardHeader title="Academic performance" description="Based on graded work so far — not a prediction" action={<Link href="/grades" className="text-xs text-muted hover:text-fg">Grades</Link>} />
      <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr]">
        <div className="flex gap-6 sm:flex-col sm:gap-3">
          <Stat label="This period GPA" value={fmtGpa(periodGpa.gpa)} sub={`of ${maxPoints.toFixed(1)} · ${periodGpa.credits} credits`} />
          <Stat label="Cumulative GPA" value={fmtGpa(cumulativeGpa.gpa)} sub={`of ${maxPoints.toFixed(1)} · ${cumulativeGpa.credits} credits`} />
        </div>
        <div className="min-w-0 space-y-2.5">
          {graded.length === 0 ? (
            <EmptyState icon={<GraduationCap className="h-4 w-4" />} title="No grades yet" description="Add assessments with weights to a course, then record scores as you receive them." action={<Link href="/courses"><Button size="sm">Go to courses</Button></Link>} />
          ) : (
            graded.slice(0, 6).map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <Link href={`/courses/${c.id}`} className="flex min-w-0 items-center gap-2 text-fg hover:text-accent-text"><CourseDot color={c.color} /><span className="truncate">{c.title}</span></Link>
                  <span className="shrink-0 text-muted">{fmtPercent(c.grade.currentPercent)} <span className="text-subtle">· {c.grade.letter}</span></span>
                </div>
                <Progress value={c.grade.currentPercent ?? 0} label={`${c.title} grade`} />
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-subtle">{sub}</p>
    </div>
  );
}

function CoursesWidget({ data }: WidgetProps) {
  return (
    <Card>
      <CardHeader title="Pinned courses" action={<Link href="/courses" className="text-xs text-muted hover:text-fg">All courses</Link>} />
      {data.courses.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-4 w-4" />} title="No pinned courses" description="Pin a course from its page to keep it one click away." />
      ) : (
        <Rows>
          {data.courses.map((c) => (
            <li key={c.id}>
              <Link href={`/courses/${c.id}`} className="flex items-center gap-2.5 px-3 py-2 hover:bg-hover">
                <CourseDot color={c.color} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{c.title}</span>
                <span className="text-xs text-subtle">{c.openTasks} open</span>
              </Link>
            </li>
          ))}
        </Rows>
      )}
    </Card>
  );
}

function NotesWidget({ data }: WidgetProps) {
  return (
    <Card>
      <CardHeader title="Quick notes" action={<Link href="/notes" className="text-xs text-muted hover:text-fg">All notes</Link>} />
      <QuickNotes notes={data.notes.map((n) => ({ id: n.id, title: n.title, body: n.body }))} />
    </Card>
  );
}

export function AiWidget({ configured, provider }: { configured: boolean; provider: string | null }) {
  return (
    <Card>
      <CardHeader title="AI daily briefing" action={<Badge tone="neutral">Not connected</Badge>} />
      <EmptyState
        icon={<Sparkles className="h-4 w-4" />}
        title="AI features are not available yet"
        description={
          configured
            ? `A ${provider} provider is configured, but the AI tutor and daily briefing are not built yet. AI is currently used only for optional syllabus analysis.`
            : "The AI tutor and daily briefing arrive in a later milestone. They will need a provider key (GEMINI_API_KEY) set on the server."
        }
      />
    </Card>
  );
}

export const WIDGET_COMPONENTS: Record<string, (p: WidgetProps) => React.ReactNode> = {
  today: (p) => <TodayWidget {...p} />,
  deadlines: (p) => <DeadlinesWidget {...p} />,
  exams: (p) => <ExamsWidget {...p} />,
  tasks: (p) => <TasksWidget {...p} />,
  performance: (p) => <PerformanceWidget {...p} />,
  courses: (p) => <CoursesWidget {...p} />,
  notes: (p) => <NotesWidget {...p} />,
};

export const NotesIcon = NotebookPen;
