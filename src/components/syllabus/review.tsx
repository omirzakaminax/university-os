"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { approveSyllabusAction, discardSyllabusAction } from "@/app/actions/data";
import { validateWeights } from "@/domain/grades/engine";
import { zonedLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { SyllabusImport } from "@/server/services/syllabus";

const KINDS = ["assignment", "quiz", "lab", "project", "midterm", "final", "exam", "participation", "other"] as const;
const COLORS = ["violet", "blue", "cyan", "green", "amber", "rose", "slate"] as const;

interface Row { title: string; kind: string; weight: string; due: string; evidence: string; verified: boolean }

export function SyllabusReview({ imp, periods, defaultPeriodId, tz }: { imp: SyllabusImport; periods: { id: string; label: string }[]; defaultPeriodId: string; tz: string }) {
  const d = imp.extracted;
  const router = useRouter();
  const { run, pending, error, fieldErrors } = useAction();
  const [course, setCourse] = useState({ title: d.title ?? "", code: d.code ?? "", credits: d.credits != null ? String(d.credits) : "", instructor: d.instructor?.name ?? "", description: d.description ?? "", color: "blue" as string });
  const [periodId, setPeriodId] = useState(imp.periodId ?? defaultPeriodId);
  const [topics, setTopics] = useState<string[]>(d.topics.map((t) => (t.week ? `Week ${t.week}: ${t.title}` : t.title)));
  const [rows, setRows] = useState<Row[]>(d.assessments.map((a) => ({ title: a.title, kind: a.kind, weight: a.weightPercent != null ? String(a.weightPercent) : "", due: a.dueDate ?? "", evidence: a.evidence, verified: a.verified })));
  const [accept, setAccept] = useState(false);
  const readOnly = imp.status !== "draft";

  const parsedWeights = rows.map((r) => ({ weight: Number(r.weight) }));
  const w = validateWeights(parsedWeights);
  const missingWeight = rows.some((r) => r.weight.trim() === "" || Number.isNaN(Number(r.weight)));
  const mismatch = rows.length > 0 && !w.valid;
  const canApprove = !readOnly && course.title.trim().length > 0 && !missingWeight && (!mismatch || accept) && periodId;

  async function approve() {
    const r = await run(
      () =>
        approveSyllabusAction(imp.id, {
          periodId,
          course: { title: course.title, code: course.code || null, description: course.description || null, credits: course.credits === "" ? 0 : Number(course.credits), color: course.color, instructorName: course.instructor || null },
          topics: topics.map((t) => t.trim()).filter(Boolean),
          assessments: rows.map((r) => ({ title: r.title, kind: r.kind, weightPercent: Number(r.weight), dueAt: r.due ? zonedLocalToUtc(`${r.due}T23:59`, tz) : null })),
          acceptWeightMismatch: accept,
        }),
      { success: "Course created from your syllabus" },
    );
    if (r.ok) router.push(`/courses/${(r.data as { courseId: string }).courseId}`);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={imp.method === "ai" ? "accent" : "neutral"}>{imp.method === "ai" ? `AI-suggested (${imp.provider})` : "Extracted by rules — no AI used"}</Badge>
          <span className="text-xs text-subtle">from “{imp.documentTitle}”</span>
          {readOnly && <Badge tone={imp.status === "approved" ? "success" : "neutral"}>{imp.status}</Badge>}
        </div>
        <ul className="mt-3 space-y-1.5" data-testid="import-warnings">
          {imp.warnings.map((x, i) => (
            <li key={i} className={cn("flex gap-2 text-xs", x.level === "warning" ? "text-warning" : "text-muted")}>
              {x.level === "warning" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              {x.message}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Course" description="Leave anything the syllabus did not state empty — you can add it later." />
        <div className="grid gap-3.5 p-4 sm:grid-cols-2">
          <Field label="Course title" error={fieldErrors["course.title"]} className="sm:col-span-2">{(p) => <Input {...p} disabled={readOnly} value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} />}</Field>
          <Field label="Code">{(p) => <Input {...p} disabled={readOnly} value={course.code} onChange={(e) => setCourse({ ...course, code: e.target.value })} />}</Field>
          <Field label="Credits">{(p) => <Input {...p} type="number" min={0} step="0.5" disabled={readOnly} value={course.credits} onChange={(e) => setCourse({ ...course, credits: e.target.value })} />}</Field>
          <Field label="Instructor">{(p) => <Input {...p} disabled={readOnly} value={course.instructor} onChange={(e) => setCourse({ ...course, instructor: e.target.value })} />}</Field>
          <Field label="Add to period">{(p) => <Select {...p} disabled={readOnly} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>{periods.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>}</Field>
          <Field label="Description" className="sm:col-span-2">{(p) => <Textarea {...p} rows={3} disabled={readOnly} value={course.description} onChange={(e) => setCourse({ ...course, description: e.target.value })} />}</Field>
          <div className="sm:col-span-2"><p className="mb-1.5 text-xs font-medium text-muted">Colour</p><div role="radiogroup" aria-label="Course colour" className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={course.color === c} aria-label={c} data-color={c} disabled={readOnly} onClick={() => setCourse({ ...course, color: c })} className={cn("h-6 w-6 rounded-full bg-[var(--c)] ring-offset-2 ring-offset-surface", course.color === c ? "ring-2 ring-fg" : "opacity-70 hover:opacity-100")} />)}</div></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Assessments & weights" description="Check each weight against your syllabus. These become the grading structure of the course." action={<Badge tone={w.valid ? "success" : rows.length ? "warning" : "neutral"}>Total {Number(w.total.toFixed(3))}%</Badge>} />
        <div className="space-y-2.5 p-4">
          {rows.length === 0 && <p className="text-xs text-subtle">No assessments were found. You can add them now or later on the course page.</p>}
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-line bg-bg p-2.5">
              <div className="grid gap-2 sm:grid-cols-[1fr_8.5rem_5.5rem_9rem_auto]">
                <Input aria-label="Assessment title" disabled={readOnly} value={r.title} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Select aria-label="Type" disabled={readOnly} value={r.kind} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select>
                <Input aria-label="Weight percent" type="number" min={0} max={100} step="any" disabled={readOnly} value={r.weight} placeholder="%" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                <Input aria-label="Date (only if stated)" type="date" disabled={readOnly} value={r.due} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} />
                {!readOnly && <Button variant="ghost" size="icon" aria-label={`Remove ${r.title}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
              {r.evidence && (
                <p className={cn("mt-1.5 flex items-start gap-1.5 text-xs", r.verified ? "text-subtle" : "text-warning")}>
                  {r.verified ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" /> : <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />}
                  <span>{r.verified ? "From your document: " : "Unverified — could not be found in your document: "}<q className="italic">{r.evidence}</q></span>
                </p>
              )}
            </div>
          ))}
          {!readOnly && <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { title: "", kind: "assignment", weight: "", due: "", evidence: "", verified: true }])}><Plus className="h-3.5 w-3.5" /> Add assessment</Button>}
          {mismatch && !readOnly && (
            <label className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft p-2.5 text-xs text-warning">
              <input type="checkbox" className="mt-0.5" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              The weights add up to {Number(w.total.toFixed(3))}%, not 100%. I understand grades for this course will not be calculated until I fix them.
            </label>
          )}
          {missingWeight && <p className="text-xs text-danger">Every assessment needs a weight before you can approve.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Weekly topics (${topics.length})`} description="Become the syllabus checklist of the course." />
        <div className="space-y-1.5 p-4">
          {topics.length === 0 && <p className="text-xs text-subtle">No topics detected. You can add them later.</p>}
          {topics.map((t, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Topic ${i + 1}`} disabled={readOnly} value={t} onChange={(e) => setTopics(topics.map((x, j) => (j === i ? e.target.value : x)))} />
              {!readOnly && <Button variant="ghost" size="icon" aria-label={`Remove topic ${i + 1}`} onClick={() => setTopics(topics.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          ))}
          {!readOnly && <Button variant="ghost" size="sm" onClick={() => setTopics([...topics, ""])}><Plus className="h-3.5 w-3.5" /> Add topic</Button>}
        </div>
      </Card>

      {(d.objectives.length > 0 || d.readings.length > 0 || d.gradingNotes.length > 0 || d.importantDates.length > 0) && (
        <Card>
          <CardHeader title="Also found in the syllabus" description="For your reference — not saved as structured data yet. Read the grading rules yourself; they are not interpreted." />
          <div className="grid gap-4 p-4 text-xs text-muted sm:grid-cols-2">
            {d.gradingNotes.length > 0 && <Block title="Grading & policy lines" items={d.gradingNotes} />}
            {d.importantDates.length > 0 && <Block title="Dates mentioned" items={d.importantDates.map((x) => `${x.date} — ${x.title}${x.verified ? "" : " (unverified)"}`)} />}
            {d.objectives.length > 0 && <Block title="Learning objectives" items={d.objectives} />}
            {d.readings.length > 0 && <Block title="Readings" items={d.readings} />}
          </div>
        </Card>
      )}

      <FormError message={error} />
      {!readOnly && (
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface p-3 shadow-pop">
          <Button variant="danger" onClick={async () => { const r = await run(() => discardSyllabusAction(imp.id), { success: "Draft discarded" }); if (r.ok) router.push("/courses"); }}>Discard draft</Button>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-subtle sm:block">Nothing is saved until you approve.</p>
            <Button variant="primary" size="lg" loading={pending} disabled={!canApprove} onClick={approve}>Approve & create course</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 font-medium text-fg">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4">{items.slice(0, 10).map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
