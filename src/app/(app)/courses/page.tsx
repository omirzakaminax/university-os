import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileUp, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CourseDot, EmptyState, PageHeader, Progress } from "@/components/ui/card";
import { fmtPercent } from "@/components/format";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { loadGradebook } from "@/server/services/grades";
import { NewCourseButton } from "./new-course";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const app = await getAppContext();
  const period = app.academic.activePeriod;
  const book = await withUser(app.userId, (tx) => loadGradebook(tx, app.academic.scale));
  const grades = new Map(book.map((b) => [b.id, b.grade]));

  return (
    <>
      <PageHeader title="Courses" description={`${period.yearLabel} · ${period.name} — ${app.courses.length} ${app.courses.length === 1 ? "course" : "courses"}`} actions={<><Link href="/courses/import"><Button><FileUp className="h-3.5 w-3.5" /> Import syllabus</Button></Link><NewCourseButton periodId={period.id} initiallyOpen={sp.new === "1"} /></>} />
      {app.courses.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="h-4 w-4" />} title={`No courses in ${period.name} yet`} description="Add the courses you are taking this period. Then add assessments, a timetable and tasks to each one." action={<div className="flex gap-2"><Link href="/courses/import"><Button variant="primary"><FileUp className="h-3.5 w-3.5" /> Import a syllabus</Button></Link><NewCourseButton periodId={period.id} variant="secondary" /></div>} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {app.courses.map((c) => {
            const g = grades.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/courses/${c.id}`} className="group block h-full rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-raised">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CourseDot color={c.color} className="h-2.5 w-2.5" />
                      <h2 className="truncate text-sm font-semibold">{c.title}</h2>
                    </div>
                    {c.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-accent-text" aria-label="Pinned" />}
                  </div>
                  <p className="mt-1 truncate text-xs text-subtle">{[c.code, c.instructorName, `${c.credits} credits`].filter(Boolean).join(" · ")}</p>
                  <div className="mt-4">
                    {g && g.currentPercent !== null ? (
                      <>
                        <div className="mb-1 flex items-baseline justify-between text-xs">
                          <span className="text-muted">{g.isFinal ? "Final" : "So far"}</span>
                          <span className="font-medium tabular-nums">{fmtPercent(g.finalPercent ?? g.currentPercent)} <span className="text-subtle">· {g.letter}</span></span>
                        </div>
                        <Progress value={g.finalPercent ?? g.currentPercent} label={`${c.title} grade`} />
                      </>
                    ) : (
                      <p className="text-xs text-subtle">No grades recorded</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge>{c.openTasks} open {c.openTasks === 1 ? "task" : "tasks"}</Badge>
                    {g && !g.weightsValid && g.weightTotal > 0 && <Badge tone="warning">Weights ≠ 100%</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
