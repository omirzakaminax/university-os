"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { createRequirementAction, deleteRequirementAction } from "@/app/actions/data";
import type { RequirementEvaluation, RequirementStatus } from "@/domain/grades/requirements";

const TONE: Record<RequirementStatus, "success" | "accent" | "warning" | "danger" | "neutral"> = { met: "success", on_track: "accent", at_risk: "warning", unreachable: "danger", not_met: "danger", pending: "neutral", unknown: "neutral" };
const LABEL: Record<RequirementStatus, string> = { met: "Met", on_track: "On track", at_risk: "At risk", unreachable: "Unreachable", not_met: "Not met", pending: "Pending", unknown: "Can’t tell yet" };
const KINDS = [
  { value: "course_percent", label: "Course percent (e.g. pass mark, retake threshold)" },
  { value: "final_exam_percent", label: "Final exam percent (minimum on the final)" },
  { value: "period_gpa", label: "This period's GPA (e.g. scholarship)" },
  { value: "cumulative_gpa", label: "Cumulative GPA" },
];

export function RequirementsCard({ evaluations, definitions, courses }: { evaluations: RequirementEvaluation[]; definitions: { id: string; name: string; sourceNote: string | null }[]; courses: { id: string; title: string }[] }) {
  const [f, setF] = useState({ name: "", kind: "course_percent", threshold: "", courseId: "", note: "" });
  const { run, pending, error, fieldErrors } = useAction();
  const isGpa = f.kind.endsWith("gpa");
  return (
    <Card id="requirements">
      <CardHeader title="Requirements I’m tracking" description="Rules you define — pass mark, minimum final, avoiding a retake, scholarship GPA. The app never assumes them; it only checks them against your grades." />
      <div className="space-y-4 p-4">
        {evaluations.length === 0 ? (
          <p className="text-xs text-subtle">No requirements yet. Add the rules from your university handbook below, and note where each came from.</p>
        ) : (
          <ul className="space-y-2" data-testid="requirement-evaluations">
            {evaluations.map((e, i) => (
              <li key={`${e.requirementId}:${i}`} className="rounded-lg border border-line bg-bg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONE[e.status]}>{LABEL[e.status]}</Badge>
                  <span className="text-[13px] font-medium">{e.name}</span>
                  <span className="text-xs text-subtle">· {e.subject}</span>
                  {!e.requirementId.startsWith("policy:") && <Button variant="ghost" size="icon" className="ml-auto" aria-label={`Delete requirement ${e.name}`} onClick={() => void run(() => deleteRequirementAction(e.requirementId), { success: "Requirement removed" })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
                <p className="mt-1 text-xs text-muted">{e.summary}</p>
              </li>
            ))}
          </ul>
        )}
        {definitions.filter((d) => !evaluations.some((e) => e.requirementId === d.id) && !d.id.startsWith("policy:")).map((d) => (
          <p key={d.id} className="flex items-center gap-2 text-xs text-subtle">“{d.name}” has nothing to evaluate yet (for example: no final exam added).<Button variant="ghost" size="icon" aria-label={`Delete requirement ${d.name}`} onClick={() => void run(() => deleteRequirementAction(d.id), { success: "Requirement removed" })}><Trash2 className="h-3.5 w-3.5" /></Button></p>
        ))}
        <form className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => createRequirementAction({ name: f.name, kind: f.kind, threshold: Number(f.threshold), courseId: isGpa || !f.courseId ? null : f.courseId, sourceNote: f.note || null }), { success: "Requirement added" }); if (r.ok) setF({ name: "", kind: f.kind, threshold: "", courseId: "", note: "" }); }}>
          <div className="sm:col-span-2"><FormError message={error} /></div>
          <Field label="Name" error={fieldErrors.name}>{(p) => <Input {...p} required maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Avoid retake (per handbook §4.2)" />}</Field>
          <Field label="Type">{(p) => <Select {...p} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select>}</Field>
          <Field label={isGpa ? "Minimum GPA" : "Minimum percent"} error={fieldErrors.threshold}>{(p) => <Input {...p} type="number" required min={0} max={100} step="0.01" value={f.threshold} onChange={(e) => setF({ ...f, threshold: e.target.value })} />}</Field>
          {!isGpa && <Field label="Only for course (optional)">{(p) => <Select {...p} value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>}</Field>}
          <Field label="Where does this rule come from? (optional)" className="sm:col-span-2">{(p) => <Input {...p} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Academic regulations 2026, page 12" />}</Field>
          <div className="sm:col-span-2"><Button type="submit" loading={pending} disabled={!f.name.trim() || f.threshold === ""}><Plus className="h-3.5 w-3.5" /> Add requirement</Button></div>
        </form>
      </div>
    </Card>
  );
}
