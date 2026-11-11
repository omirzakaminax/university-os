"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Card, CourseDot } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { createClassSessionAction, deleteClassSessionAction } from "@/app/actions/data";
import { cn } from "@/lib/cn";
import type { ClassSessionRow } from "@/server/services/timetable";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmtGap = (m: number) => `${m >= 60 ? `${Math.floor(m / 60)}h ` : ""}${m % 60 ? `${m % 60}m` : ""}`.trim();

export function WeekTimetable({ sessions, courses, todayWeekday }: { sessions: ClassSessionRow[]; courses: { id: string; title: string }[]; todayWeekday: number }) {
  const [add, setAdd] = useState<number | null>(null);
  const { run } = useAction();
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {DAYS.map((name, i) => {
          const wd = i + 1;
          const day = sessions.filter((s) => s.weekday === wd);
          return (
            <Card key={name} className={cn("flex flex-col", wd === todayWeekday && "border-accent-border")}>
              <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                <h2 className="text-[13px] font-semibold">{name}</h2>
                <div className="flex items-center gap-1.5">
                  {wd === todayWeekday && <Badge tone="accent">Today</Badge>}
                  <Button variant="ghost" size="icon" aria-label={`Add class on ${name}`} onClick={() => setAdd(wd)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <ul className="flex-1 space-y-1.5 px-2 pb-2.5">
                {day.length === 0 && <li className="px-1 py-3 text-xs text-subtle">No classes</li>}
                {day.map((s, idx) => {
                  const prev = day[idx - 1];
                  const gap = prev ? toMin(s.startsAt) - toMin(prev.endsAt) : 0;
                  return (
                    <li key={s.id}>
                      {gap >= 45 && <p className="mb-1.5 px-1 text-[11px] text-subtle">Free · {fmtGap(gap)}</p>}
                      <div data-color={s.courseColor} className="group relative rounded-lg border border-line bg-raised py-2 pl-3 pr-2 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--c)]">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{s.courseTitle}</p>
                            <p className="font-mono text-xs text-muted">{s.startsAt}–{s.endsAt}</p>
                            <p className="truncate text-xs capitalize text-subtle">{[s.kind, s.location].filter(Boolean).join(" · ")}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="-mr-1 -mt-1 opacity-0 focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100" aria-label={`Remove ${s.courseTitle} on ${name} at ${s.startsAt}`} onClick={() => { if (confirm(`Remove this ${s.kind}?`)) void run(() => deleteClassSessionAction(s.id), { success: "Class removed" }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
      <ClassDialog weekday={add} onClose={() => setAdd(null)} courses={courses} />
    </>
  );
}

function ClassDialog({ weekday, onClose, courses }: { weekday: number | null; onClose: () => void; courses: { id: string; title: string }[] }) {
  const [f, setF] = useState({ courseId: "", day: "1", start: "09:00", end: "10:30", kind: "lecture", location: "" });
  const { run, pending, error, fieldErrors } = useAction();
  const open = weekday !== null;
  const day = f.day === "1" && weekday ? String(weekday) : f.day;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setF((s) => ({ ...s, day: "1" })); } }} title="Add a class" description="Classes repeat weekly while their course is active.">
      {courses.length === 0 ? (
        <p className="text-[13px] text-muted">Create a course for this period first, then add its classes here.</p>
      ) : (
        <form
          className="space-y-3.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => createClassSessionAction({ courseId: f.courseId || courses[0]!.id, weekday: Number(day), startsAt: f.start, endsAt: f.end, kind: f.kind, location: f.location }), { success: "Class added" });
            if (r.ok) onClose();
          }}
        >
          <FormError message={error} />
          <Field label="Course">{(p) => <Select {...p} value={f.courseId || courses[0]!.id} onChange={set("courseId")}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>}</Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Day">{(p) => <Select {...p} value={day} onChange={set("day")}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</Select>}</Field>
            <Field label="Starts">{(p) => <Input {...p} type="time" required value={f.start} onChange={set("start")} />}</Field>
            <Field label="Ends" error={fieldErrors.endsAt}>{(p) => <Input {...p} type="time" required value={f.end} onChange={set("end")} />}</Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">{(p) => <Select {...p} value={f.kind} onChange={set("kind")}>{["lecture", "lab", "seminar", "tutorial", "other"].map((k) => <option key={k} value={k}>{k[0]!.toUpperCase() + k.slice(1)}</option>)}</Select>}</Field>
            <Field label="Location">{(p) => <Input {...p} maxLength={120} value={f.location} onChange={set("location")} placeholder="e.g. C1.3.256" />}</Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending}>Add class</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export { CourseDot };
