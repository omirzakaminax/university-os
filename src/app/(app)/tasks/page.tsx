import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/card";
import { NewTaskButton, TaskList } from "@/components/tasks/task-list";
import { TaskBoard } from "@/components/tasks/board";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { listTasks } from "@/server/services/tasks";
import { cn } from "@/lib/cn";
import { ViewSwitch } from "./view-switch";

export const metadata: Metadata = { title: "Tasks" };

const STATUSES = [{ id: "open", label: "Open" }, { id: "done", label: "Completed" }, { id: "all", label: "All" }] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string; course?: string }> }) {
  const sp = await searchParams;
  const app = await getAppContext();
  const status = (STATUSES.find((s) => s.id === sp.status)?.id ?? "open") as "open" | "done" | "all";
  const view = sp.view === "board" ? "board" : "list";
  const courseId = app.courses.some((c) => c.id === sp.course) ? sp.course : undefined;
  // The board always needs every status to be useful.
  const tasks = await withUser(app.userId, (tx) => listTasks(tx, { status: view === "board" ? "all" : status, courseId, limit: 200 }));
  const courses = app.courses.map((c) => ({ id: c.id, title: c.title }));
  const qs = (s: string) => `/tasks?view=${view}&status=${s}${courseId ? `&course=${courseId}` : ""}`;

  return (
    <>
      <PageHeader title="Tasks" description="Assignments, to-dos and recurring work in one place." actions={<><ViewSwitch view={view} status={status} courseId={courseId} /><NewTaskButton tz={app.profile.timezone} courses={courses} defaultCourseId={courseId} /></>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {view === "list" && (
          <div role="group" aria-label="Status" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
            {STATUSES.map((s) => (
              <Link key={s.id} href={qs(s.id)} aria-current={status === s.id ? "page" : undefined} className={cn("flex h-7 items-center rounded-md px-2.5 text-xs", status === s.id ? "bg-raised text-fg" : "text-subtle hover:text-fg")}>{s.label}</Link>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {courseId && <Link href={`/tasks?view=${view}&status=${status}`} className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-fg">Clear course filter ×</Link>}
          {!courseId && app.courses.slice(0, 8).map((c) => (
            <Link key={c.id} href={`/tasks?view=${view}&status=${status}&course=${c.id}`} className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-line-strong hover:text-fg">{c.title}</Link>
          ))}
        </div>
      </div>
      {view === "board" ? (
        <TaskBoard tasks={tasks} tz={app.profile.timezone} />
      ) : (
        <Card>
          <TaskList tasks={tasks} tz={app.profile.timezone} courses={courses} defaultCourseId={courseId} emptyTitle={status === "done" ? "No completed tasks yet" : "No open tasks"} emptyDescription="Press C anywhere to capture one, or create a task with a due date, priority and reminder." />
        </Card>
      )}
    </>
  );
}
