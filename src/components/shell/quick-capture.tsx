"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { createNoteAction, createTaskAction } from "@/app/actions/data";
import { zonedLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/cn";

export interface CourseOption { id: string; title: string }

export function QuickCapture({ open, onOpenChange, courses, timezone }: { open: boolean; onOpenChange: (o: boolean) => void; courses: CourseOption[]; timezone: string }) {
  const [kind, setKind] = useState<"task" | "note">("task");
  const [text, setText] = useState("");
  const [courseId, setCourseId] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("1");
  const { run, pending, error, fieldErrors, clearErrors } = useAction();

  function reset() {
    setText("");
    setDue("");
    setPriority("1");
    clearErrors();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r =
      kind === "task"
        ? await run(() => createTaskAction({ title: text, courseId: courseId || null, dueAt: due ? zonedLocalToUtc(due, timezone) : null, priority: Number(priority) }), { success: "Task added" })
        : await run(() => createNoteAction({ body: text, courseId: courseId || null }), { success: "Note saved" });
    if (r.ok) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Quick capture" description="Get it out of your head. Organise it later.">
      <form onSubmit={submit} className="space-y-4">
        <div role="tablist" aria-label="What are you capturing?" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg p-1">
          {(["task", "note"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("rounded-md py-1 text-[13px] font-medium capitalize transition-colors", kind === k ? "bg-raised text-fg" : "text-subtle hover:text-fg")}>
              {k}
            </button>
          ))}
        </div>
        <FormError message={error} />
        {kind === "task" ? (
          <Field label="What needs doing?" error={fieldErrors.title}>{(p) => <Input {...p} autoFocus required maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Finish calculus problem set 4" />}</Field>
        ) : (
          <Field label="Note" error={fieldErrors._}>{(p) => <Textarea {...p} autoFocus required value={text} onChange={(e) => setText(e.target.value)} placeholder="Write anything…" />}</Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Course (optional)">
            {(p) => (
              <Select {...p} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
            )}
          </Field>
          {kind === "task" && (
            <Field label="Due (optional)">{(p) => <Input {...p} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
          )}
        </div>
        {kind === "task" && (
          <Field label="Priority">
            {(p) => (
              <Select {...p} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="0">Low</option><option value="1">Normal</option><option value="2">High</option><option value="3">Urgent</option>
              </Select>
            )}
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending} disabled={!text.trim()}>{kind === "task" ? "Add task" : "Save note"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
