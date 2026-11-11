"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { addAssessmentAction, deleteAssessmentAction, updateAssessmentAction } from "@/app/actions/data";
import { DueBadge } from "@/components/format";
import { utcToZonedLocalInput, zonedLocalToUtc } from "@/lib/time";
import { ClipboardList } from "lucide-react";
import type { AssessmentRow } from "@/server/services/courses";

const KINDS = ["assignment", "quiz", "lab", "project", "midterm", "final", "exam", "participation", "other"] as const;

export function Assessments({ courseId, assessments, tz }: { courseId: string; assessments: AssessmentRow[]; tz: string }) {
  const [dialog, setDialog] = useState<{ row?: AssessmentRow } | null>(null);
  const total = assessments.reduce((s, a) => s + a.weightPercent, 0);
  const ok = Math.abs(total - 100) <= 0.001;
  return (
    <Card>
      <CardHeader
        title="Assessments & grades"
        description="Each assessment has a weight. Record the score once you get it."
        action={<Button size="sm" onClick={() => setDialog({})}><Plus className="h-3.5 w-3.5" /> Add</Button>}
      />
      {assessments.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-4 w-4" />} title="No assessments yet" description="Add the graded components of this course (e.g. Assignments 30%, Midterm 30%, Final 40%). Weights must total 100%." action={<Button size="sm" variant="primary" onClick={() => setDialog({})}><Plus className="h-3.5 w-3.5" /> Add assessment</Button>} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[34rem] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-subtle">
                  <th className="px-4 py-1.5 font-medium">Assessment</th><th className="px-2 py-1.5 font-medium">Weight</th><th className="px-2 py-1.5 font-medium">Score</th><th className="px-2 py-1.5 font-medium">Due</th><th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {assessments.map((a) => <Row key={`${a.id}:${a.score}`} a={a} tz={tz} onEdit={() => setDialog({ row: a })} />)}
              </tbody>
            </table>
          </div>
          <p className={`border-t border-line px-4 py-2 text-xs ${ok ? "text-subtle" : "text-warning"}`}>Total weight: <span className="tabular-nums">{Number(total.toFixed(3))}%</span> {ok ? "✓" : "— must equal 100%"}</p>
        </>
      )}
      <AssessmentDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} courseId={courseId} row={dialog?.row} tz={tz} />
    </Card>
  );
}

function Row({ a, tz, onEdit }: { a: AssessmentRow; tz: string; onEdit: () => void }) {
  const [score, setScore] = useState(a.score == null ? "" : String(a.score));
  const { run, pending } = useAction();
  const save = () => {
    const next = score.trim() === "" ? null : Number(score);
    if (next === a.score || (next !== null && Number.isNaN(next))) return;
    void run(() => updateAssessmentAction(a.id, { score: next }), { success: next === null ? "Score cleared" : "Score saved" });
  };
  return (
    <tr className="group">
      <td className="px-4 py-2">
        <p className="font-medium">{a.title}</p>
        <p className="text-xs capitalize text-subtle">{a.kind}{a.origin !== "manual" && a.importedAt ? ` · imported (${a.origin})` : ""}</p>
      </td>
      <td className="px-2 py-2 tabular-nums">{Number(a.weightPercent.toFixed(3))}%</td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <Input aria-label={`Score for ${a.title}`} className="h-7 w-20 tabular-nums" type="number" min={0} step="any" value={score} onChange={(e) => setScore(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())} disabled={pending} placeholder="—" />
          <span className="text-xs text-subtle">/ {a.maxScore}</span>
        </div>
      </td>
      <td className="px-2 py-2">{a.score !== null ? <Badge tone="success">Graded</Badge> : a.dueAt ? <DueBadge iso={a.dueAt} tz={tz} /> : <span className="text-xs text-subtle">—</span>}</td>
      <td className="px-2 py-2">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" aria-label={`Edit ${a.title}`} onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <DeleteBtn id={a.id} title={a.title} />
        </div>
      </td>
    </tr>
  );
}

function DeleteBtn({ id, title }: { id: string; title: string }) {
  const { run } = useAction();
  return <Button variant="ghost" size="icon" aria-label={`Delete ${title}`} onClick={() => { if (confirm(`Delete assessment “${title}”? Its score is removed from your grade.`)) void run(() => deleteAssessmentAction(id), { success: "Assessment deleted" }); }}><Trash2 className="h-3.5 w-3.5" /></Button>;
}

function AssessmentDialog({ open, onOpenChange, courseId, row, tz }: { open: boolean; onOpenChange: (o: boolean) => void; courseId: string; row?: AssessmentRow; tz: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={row ? "Edit assessment" : "Add assessment"}>
      <AssessmentForm courseId={courseId} row={row} tz={tz} onClose={() => onOpenChange(false)} />
    </Dialog>
  );
}

function AssessmentForm({ courseId, row, tz, onClose }: { courseId: string; row?: AssessmentRow; tz: string; onClose: () => void }) {
  const [f, setF] = useState(() => ({ title: row?.title ?? "", kind: row?.kind ?? "assignment", weight: row ? String(row.weightPercent) : "", max: row ? String(row.maxScore) : "100", score: row?.score != null ? String(row.score) : "", due: row?.dueAt ? utcToZonedLocalInput(row.dueAt, tz) : "" }));
  const { run, pending, error, fieldErrors } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { title: f.title, kind: f.kind, weightPercent: Number(f.weight), maxScore: Number(f.max), score: f.score === "" ? null : Number(f.score), dueAt: f.due ? zonedLocalToUtc(f.due, tz) : null };
    const r = row ? await run(() => updateAssessmentAction(row.id, body), { success: "Assessment updated" }) : await run(() => addAssessmentAction(courseId, body), { success: "Assessment added" });
    if (r.ok) onClose();
  }
  return (
    <form onSubmit={submit} className="space-y-3.5">
      <FormError message={error} />
      <Field label="Title" error={fieldErrors.title}>{(p) => <Input {...p} autoFocus required maxLength={200} value={f.title} onChange={set("title")} placeholder="e.g. Midterm exam" />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">{(p) => <Select {...p} value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{k[0]!.toUpperCase() + k.slice(1)}</option>)}</Select>}</Field>
        <Field label="Weight (% of course grade)" error={fieldErrors.weightPercent}>{(p) => <Input {...p} type="number" required min={0} max={100} step="any" value={f.weight} onChange={set("weight")} />}</Field>
        <Field label="Maximum score" error={fieldErrors.maxScore}>{(p) => <Input {...p} type="number" required min={0.001} step="any" value={f.max} onChange={set("max")} />}</Field>
        <Field label="Your score" hint="Leave empty until graded" error={fieldErrors.score}>{(p) => <Input {...p} type="number" min={0} step="any" value={f.score} onChange={set("score")} />}</Field>
        <Field label="Due / exam date" className="sm:col-span-2">{(p) => <Input {...p} type="datetime-local" value={f.due} onChange={set("due")} />}</Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={!f.title.trim() || f.weight === ""}>{row ? "Save changes" : "Add assessment"}</Button>
      </div>
    </form>
  );
}
