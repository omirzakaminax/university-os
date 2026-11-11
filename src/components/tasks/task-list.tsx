"use client";

import { useMemo, useState } from "react";
import { CornerDownRight, MoreHorizontal, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { Badge, CourseDot, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskCheck } from "@/components/tasks/task-check";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { DueBadge, PRIORITY } from "@/components/format";
import { useAction } from "@/components/ui/use-action";
import { deleteTaskAction } from "@/app/actions/data";
import { cn } from "@/lib/cn";
import type { TaskRow } from "@/server/services/tasks";

interface Props {
  tasks: TaskRow[];
  tz: string;
  courses: { id: string; title: string }[];
  emptyTitle?: string;
  emptyDescription?: string;
  defaultCourseId?: string | null;
  showCourse?: boolean;
}

/** Hierarchical task list: top-level tasks with their subtasks nested underneath. */
export function TaskList({ tasks, tz, courses, emptyTitle = "No tasks", emptyDescription, defaultCourseId, showCourse = true }: Props) {
  const [dialog, setDialog] = useState<{ task?: TaskRow | null; parentTaskId?: string | null } | null>(null);
  const { run } = useAction();
  const { roots, childrenOf } = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.id));
    const childrenOf = new Map<string, TaskRow[]>();
    const roots: TaskRow[] = [];
    for (const t of tasks) {
      if (t.parentTaskId && ids.has(t.parentTaskId)) childrenOf.set(t.parentTaskId, [...(childrenOf.get(t.parentTaskId) ?? []), t]);
      else roots.push(t);
    }
    return { roots, childrenOf };
  }, [tasks]);

  const row = (t: TaskRow, child = false) => (
    <li key={t.id}>
      <div className={cn("group flex items-center gap-2.5 px-3 py-2 hover:bg-hover/60", child && "pl-9")}>
        {child && <CornerDownRight className="-ml-5 h-3 w-3 shrink-0 text-subtle" aria-hidden />}
        <TaskCheck id={t.id} done={t.status === "done"} title={t.title} />
        <div className="min-w-0 flex-1">
          <button onClick={() => setDialog({ task: t })} className={cn("block max-w-full truncate text-left text-[13px] hover:text-accent-text", t.status === "done" && "text-subtle line-through")}>
            {t.title}
          </button>
          {showCourse && t.courseTitle && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle"><CourseDot color={t.courseColor ?? "slate"} />{t.courseTitle}</span>
          )}
        </div>
        {t.recurrence && <Repeat className="h-3 w-3 shrink-0 text-subtle" aria-label="Repeats" />}
        {t.kind === "assignment" && <Badge tone="accent">Assignment</Badge>}
        {t.priority >= 2 && t.status !== "done" && <Badge tone={PRIORITY[t.priority]!.tone}>{PRIORITY[t.priority]!.label}</Badge>}
        <DueBadge iso={t.dueAt} tz={tz} done={t.status === "done"} />
        <div className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          {!child && <Button variant="ghost" size="icon" aria-label={`Add subtask to ${t.title}`} onClick={() => setDialog({ parentTaskId: t.id })}><Plus className="h-3.5 w-3.5" /></Button>}
          <Button variant="ghost" size="icon" aria-label={`Edit ${t.title}`} onClick={() => setDialog({ task: t })}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${t.title}`} onClick={() => { if (confirm(`Delete “${t.title}”${childrenOf.has(t.id) ? " and its subtasks" : ""}?`)) void run(() => deleteTaskAction(t.id), { success: "Task deleted" }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {childrenOf.get(t.id)?.map((c) => row(c, true))}
    </li>
  );

  return (
    <>
      {roots.length === 0 ? (
        <EmptyState icon={<MoreHorizontal className="h-4 w-4" />} title={emptyTitle} description={emptyDescription} action={<Button size="sm" variant="primary" onClick={() => setDialog({})}><Plus className="h-3.5 w-3.5" /> New task</Button>} />
      ) : (
        <ul className="divide-y divide-line">{roots.map((t) => row(t))}</ul>
      )}
      <TaskDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} tz={tz} courses={courses} task={dialog?.task} parentTaskId={dialog?.parentTaskId} defaultCourseId={defaultCourseId} />
    </>
  );
}

export function NewTaskButton({ tz, courses, defaultCourseId, label = "New task" }: { tz: string; courses: { id: string; title: string }[]; defaultCourseId?: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> {label}</Button>
      <TaskDialog open={open} onOpenChange={setOpen} tz={tz} courses={courses} defaultCourseId={defaultCourseId} />
    </>
  );
}
