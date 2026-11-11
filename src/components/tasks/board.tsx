"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge, CourseDot } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DueBadge, PRIORITY } from "@/components/format";
import { useAction } from "@/components/ui/use-action";
import { updateTaskAction } from "@/app/actions/data";
import type { TaskRow } from "@/server/services/tasks";

const COLUMNS = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
] as const;

/** Kanban board. Cards move between columns with explicit buttons (keyboard-accessible, no drag-and-drop dependency). */
export function TaskBoard({ tasks, tz }: { tasks: TaskRow[]; tz: string }) {
  const { run } = useAction();
  const top = tasks.filter((t) => !t.parentTaskId);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((col, ci) => {
        const items = top.filter((t) => t.status === col.id);
        return (
          <section key={col.id} aria-label={col.label} className="rounded-xl border border-line bg-surface">
            <h3 className="flex items-center justify-between border-b border-line px-3 py-2 text-xs font-semibold">{col.label}<Badge>{items.length}</Badge></h3>
            <ul className="min-h-24 space-y-2 p-2">
              {items.length === 0 && <li className="px-2 py-4 text-center text-xs text-subtle">Nothing here</li>}
              {items.map((t) => (
                <li key={t.id} className="rounded-lg border border-line bg-raised p-2.5">
                  <p className="text-[13px]">{t.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {t.courseTitle && <span className="flex items-center gap-1 text-xs text-subtle"><CourseDot color={t.courseColor ?? "slate"} />{t.courseTitle}</span>}
                    {t.priority >= 2 && <Badge tone={PRIORITY[t.priority]!.tone}>{PRIORITY[t.priority]!.label}</Badge>}
                    <DueBadge iso={t.dueAt} tz={tz} done={t.status === "done"} />
                  </div>
                  <div className="mt-2 flex justify-between">
                    <Button variant="ghost" size="icon" aria-label={`Move ${t.title} to ${COLUMNS[ci - 1]?.label ?? ""}`} disabled={ci === 0} onClick={() => void run(() => updateTaskAction(t.id, { status: COLUMNS[ci - 1]!.id }))}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Move ${t.title} to ${COLUMNS[ci + 1]?.label ?? ""}`} disabled={ci === COLUMNS.length - 1} onClick={() => void run(() => updateTaskAction(t.id, { status: COLUMNS[ci + 1]!.id }))}><ArrowRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
