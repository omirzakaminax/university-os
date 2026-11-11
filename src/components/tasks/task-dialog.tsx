"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { createTaskAction, updateTaskAction } from "@/app/actions/data";
import { utcToZonedLocalInput, zonedLocalToUtc } from "@/lib/time";
import type { TaskRow } from "@/server/services/tasks";

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tz: string;
  courses: { id: string; title: string }[];
  /** Edit this task; omit to create. */
  task?: TaskRow | null;
  defaultCourseId?: string | null;
  parentTaskId?: string | null;
}

const REMINDERS = [
  { value: "", label: "No reminder", ms: 0 },
  { value: "at", label: "At the due time", ms: 0 },
  { value: "1h", label: "1 hour before", ms: 3600_000 },
  { value: "1d", label: "1 day before", ms: 86_400_000 },
];

export function TaskDialog({ open, onOpenChange, tz, courses, task, defaultCourseId, parentTaskId }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={task ? "Edit task" : parentTaskId ? "New subtask" : "New task"}>
      {/* Mounted only while open, so the form state always starts from the current props. */}
      <TaskForm tz={tz} courses={courses} task={task} defaultCourseId={defaultCourseId} parentTaskId={parentTaskId} onClose={() => onOpenChange(false)} />
    </Dialog>
  );
}

function TaskForm({ tz, courses, task, defaultCourseId, parentTaskId, onClose }: Omit<TaskDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const editing = !!task;
  const [f, setF] = useState(() => ({
    title: task?.title ?? "",
    notes: task?.notes ?? "",
    courseId: task?.courseId ?? defaultCourseId ?? "",
    due: task?.dueAt ? utcToZonedLocalInput(task.dueAt, tz) : "",
    priority: String(task?.priority ?? 1),
    kind: task?.kind ?? "task",
    freq: task?.recurrence?.freq ?? "",
    interval: String(task?.recurrence?.interval ?? 1),
    reminder: "",
  }));
  const { run, pending, error, fieldErrors } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const dueAt = f.due ? zonedLocalToUtc(f.due, tz) : null;
    const recurrence = f.freq ? { freq: f.freq, interval: Number(f.interval) || 1 } : null;
    const base = { title: f.title, notes: f.notes, courseId: f.courseId || null, dueAt, priority: Number(f.priority), kind: f.kind, recurrence };
    let remindAt: string[] | undefined;
    if (!editing && f.reminder && dueAt) {
      const r = REMINDERS.find((x) => x.value === f.reminder)!;
      remindAt = [new Date(new Date(dueAt).getTime() - r.ms).toISOString()];
    }
    const r = editing ? await run(() => updateTaskAction(task!.id, base), { success: "Task updated" }) : await run(() => createTaskAction({ ...base, parentTaskId: parentTaskId ?? null, remindAt }), { success: "Task added" });
    if (r.ok) onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
        <FormError message={error} />
        <Field label="Title" error={fieldErrors.title}>{(p) => <Input {...p} autoFocus required maxLength={300} value={f.title} onChange={set("title")} />}</Field>
        <Field label="Notes" error={fieldErrors.notes}>{(p) => <Textarea {...p} rows={3} maxLength={5000} value={f.notes} onChange={set("notes")} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Course">
            {(p) => (
              <Select {...p} value={f.courseId} onChange={set("courseId")}>
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Type">
            {(p) => (
              <Select {...p} value={f.kind} onChange={set("kind")}>
                <option value="task">Task</option>
                <option value="assignment">Assignment</option>
              </Select>
            )}
          </Field>
          <Field label="Due" error={fieldErrors.dueAt}>{(p) => <Input {...p} type="datetime-local" value={f.due} onChange={set("due")} />}</Field>
          <Field label="Priority">
            {(p) => (
              <Select {...p} value={f.priority} onChange={set("priority")}>
                <option value="0">Low</option><option value="1">Normal</option><option value="2">High</option><option value="3">Urgent</option>
              </Select>
            )}
          </Field>
          <Field label="Repeats" error={fieldErrors.dueAt && f.freq ? "A due date is required to repeat" : undefined}>
            {(p) => (
              <Select {...p} value={f.freq} onChange={set("freq")}>
                <option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </Select>
            )}
          </Field>
          {f.freq && <Field label="Every">{(p) => <Input {...p} type="number" min={1} max={52} value={f.interval} onChange={set("interval")} />}</Field>}
          {!editing && (
            <Field label="Reminder" hint={f.due ? undefined : "Set a due date to add a reminder"}>
              {(p) => (
                <Select {...p} value={f.reminder} onChange={set("reminder")} disabled={!f.due}>
                  {REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              )}
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending} disabled={!f.title.trim()}>{editing ? "Save changes" : "Add task"}</Button>
        </div>
    </form>
  );
}
