"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { createCourseAction, updateCourseAction } from "@/app/actions/data";
import { cn } from "@/lib/cn";

const COLORS = ["violet", "blue", "cyan", "green", "amber", "rose", "slate"] as const;

export interface CourseFormValue {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  credits: number;
  color: string;
  includeInGpa: boolean;
  targetPercent: number | null;
  instructorName: string | null;
}

export function CourseDialog({ open, onOpenChange, periodId, course, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; periodId: string; course?: CourseFormValue; onSaved?: (id: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={course ? "Edit course" : "New course"} description={course ? undefined : "Courses belong to the period you have selected."}>
      {/* Mounted only while open, so the form state always starts from the current props. */}
      <CourseForm periodId={periodId} course={course} onClose={() => onOpenChange(false)} onSaved={onSaved} />
    </Dialog>
  );
}

function CourseForm({ periodId, course, onClose, onSaved }: { periodId: string; course?: CourseFormValue; onClose: () => void; onSaved?: (id: string) => void }) {
  const editing = !!course;
  const [f, setF] = useState(() => ({
    title: course?.title ?? "",
    code: course?.code ?? "",
    credits: course ? String(course.credits) : "",
    color: course?.color ?? "violet",
    instructor: course?.instructorName ?? "",
    description: course?.description ?? "",
    target: course?.targetPercent != null ? String(course.targetPercent) : "",
    gpa: course?.includeInGpa ?? true,
  }));
  const { run, pending, error, fieldErrors } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: f.title,
      code: f.code,
      description: f.description,
      credits: f.credits === "" ? 0 : Number(f.credits),
      color: f.color,
      instructorName: f.instructor,
      includeInGpa: f.gpa,
      targetPercent: f.target === "" ? null : Number(f.target),
    };
    const r = editing ? await run(() => updateCourseAction(course!.id, body), { success: "Course updated" }) : await run(() => createCourseAction({ ...body, periodId }), { success: "Course created" });
    if (r.ok) {
      onClose();
      if (!editing) onSaved?.((r.data as { id: string }).id);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
        <FormError message={error} />
        <Field label="Course title" error={fieldErrors.title}>{(p) => <Input {...p} autoFocus required maxLength={200} value={f.title} onChange={set("title")} placeholder="e.g. Calculus II" />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Course code" error={fieldErrors.code}>{(p) => <Input {...p} maxLength={30} value={f.code} onChange={set("code")} placeholder="e.g. MATH201" />}</Field>
          <Field label="Credits" hint="Used to weight your GPA" error={fieldErrors.credits}>{(p) => <Input {...p} type="number" min={0} max={60} step="0.5" value={f.credits} onChange={set("credits")} />}</Field>
          <Field label="Instructor" className="sm:col-span-2">{(p) => <Input {...p} maxLength={120} value={f.instructor} onChange={set("instructor")} />}</Field>
          <Field label="Target final grade (%)" hint="Optional personal goal" error={fieldErrors.targetPercent}>{(p) => <Input {...p} type="number" min={0} max={100} step="0.1" value={f.target} onChange={set("target")} />}</Field>
          <Field label="Counts toward GPA">
            {(p) => (
              <Select {...p} value={f.gpa ? "yes" : "no"} onChange={(e) => setF((s) => ({ ...s, gpa: e.target.value === "yes" }))}>
                <option value="yes">Yes</option><option value="no">No (e.g. pass/fail, audit)</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Colour">
          {() => (
            <div role="radiogroup" aria-label="Course colour" className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} data-color={c} onClick={() => setF((s) => ({ ...s, color: c }))} className={cn("h-6 w-6 rounded-full bg-[var(--c)] ring-offset-2 ring-offset-surface transition", f.color === c ? "ring-2 ring-fg" : "opacity-70 hover:opacity-100")} />
              ))}
            </div>
          )}
        </Field>
        <Field label="Description" error={fieldErrors.description}>{(p) => <Textarea {...p} rows={3} maxLength={5000} value={f.description} onChange={set("description")} />}</Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending} disabled={!f.title.trim()}>{editing ? "Save changes" : "Create course"}</Button>
        </div>
    </form>
  );
}
