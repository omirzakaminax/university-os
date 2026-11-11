"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FlaskConical, Target } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { applyWhatIf, bandForPercent, computeCourseGrade, minPercentForLetter, requiredOnRemaining, type AssessmentInput, type GradingScale } from "@/domain/grades/engine";
import { fmtPercent, fmtPercentFixed } from "@/components/format";

interface Props {
  assessments: AssessmentInput[];
  scale: GradingScale;
  courseTargetPercent: number | null;
  credits: number;
  /** Requirements the student configured (pass mark, retake threshold, …) offered as targets. */
  extraTargets?: { label: string; percent: number }[];
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function GradePanel({ assessments, scale, courseTargetPercent, credits, extraTargets = [] }: Props) {
  const grade = useMemo(() => computeCourseGrade(assessments, scale), [assessments, scale]);
  const ungraded = assessments.filter((a) => a.score === null);

  const [letter, setLetter] = useState("");
  const [custom, setCustom] = useState("");
  const [hypo, setHypo] = useState<Record<string, string>>({});

  const targetPercent = num(custom) ?? (letter.startsWith("pct:") ? Number(letter.slice(4)) : letter ? minPercentForLetter(scale, letter) : courseTargetPercent);
  const required = targetPercent !== null && targetPercent !== undefined && !Number.isNaN(targetPercent) ? requiredOnRemaining(assessments, targetPercent) : null;

  const hypotheticalScores = Object.fromEntries(Object.entries(hypo).filter(([, v]) => v.trim() !== "" && !Number.isNaN(Number(v))).map(([k, v]) => [k, Number(v)]));
  const whatIf = Object.keys(hypotheticalScores).length ? computeCourseGrade(applyWhatIf(assessments, hypotheticalScores), scale) : null;
  const shown = grade.finalPercent ?? grade.currentPercent;

  return (
    <Card>
      <CardHeader title="Grade" description={grade.isFinal ? "All assessments graded" : "Calculated from graded work so far — remaining work is not guessed"} action={<Badge tone={grade.isFinal ? "success" : "neutral"}>{grade.isFinal ? "Final" : "In progress"}</Badge>} />
      <div className="space-y-5 p-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-subtle">{grade.isFinal ? "Final percent" : "Current percent"}</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight" data-testid="grade-percent">{fmtPercentFixed(shown)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-subtle">Letter</p>
            <p className="text-3xl font-semibold tracking-tight" data-testid="grade-letter">{grade.letter ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-subtle">Grade points (not %)</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{grade.points !== null ? grade.points.toFixed(2) : "—"}<span className="ml-1 text-sm font-normal text-subtle">/ {scale.maxPoints.toFixed(1)}</span></p>
          </div>
          {credits > 0 && grade.points !== null && <p className="pb-1 text-xs text-subtle">× {credits} credits = {(grade.points * credits).toFixed(2)} quality points</p>}
        </div>

        {grade.weightTotal > 0 && grade.bestCasePercent !== null && grade.weightRemaining > 0 && (
          <p className="text-[13px] text-muted">
            With {grade.weightRemaining.toFixed(grade.weightRemaining % 1 ? 1 : 0)}% of the course still to be graded, your final could land anywhere from <strong className="text-fg">{fmtPercent(grade.worstCasePercent)}</strong> (0 on everything left) to <strong className="text-fg">{fmtPercent(grade.bestCasePercent)}</strong> (full marks).
          </p>
        )}

        {!grade.weightsValid && (
          <div role="alert" className="flex gap-2.5 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {grade.weightIssues[0]?.kind === "no_assessments"
                ? "Add assessments with weights to start calculating a grade."
                : `Assessment weights add up to ${grade.weightTotal}%, not 100%. A final grade and required-score estimates are disabled until this is fixed.`}
            </span>
          </div>
        )}

        <details className="group rounded-lg border border-line bg-bg">
          <summary className="cursor-pointer select-none px-3 py-2 text-[13px] text-muted hover:text-fg">How is this calculated?</summary>
          <div className="space-y-2 border-t border-line px-3 py-3 text-xs text-muted">
            <p className="font-mono text-[11px] text-subtle">percent = Σ(weight × score ÷ max) ÷ Σ(weight of graded work) × 100</p>
            <ol className="list-decimal space-y-1 pl-4">{grade.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            <p className="text-subtle">Grade points come from your institution’s scale ({scale.rounding === "half_up" ? "percent rounded half-up first" : "exact percent"}). Percentages and grade points are different units and are never mixed.</p>
          </div>
        </details>

        <section aria-labelledby="req-h" className="space-y-3">
          <h3 id="req-h" className="flex items-center gap-2 text-[13px] font-semibold"><Target className="h-3.5 w-3.5 text-accent-text" /> What do I need?</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target letter">
              {(p) => (
                <Select {...p} value={letter} onChange={(e) => { setLetter(e.target.value); setCustom(""); }}>
                  <option value="">{courseTargetPercent != null ? `Course goal (${courseTargetPercent}%)` : "Choose a letter"}</option>
                  {extraTargets.length > 0 && <optgroup label="My requirements">{extraTargets.map((t) => <option key={t.label} value={`pct:${t.percent}`}>{t.label} ({t.percent}%)</option>)}</optgroup>}
                  <optgroup label="Letter grades">{scale.bands.filter((b) => b.minPercent > 0).map((b) => <option key={b.letter} value={b.letter}>{b.letter} (from {minPercentForLetter(scale, b.letter)}%)</option>)}</optgroup>
                </Select>
              )}
            </Field>
            <Field label="…or a custom percent">{(p) => <Input {...p} type="number" min={0} max={100} step="0.1" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. 85" />}</Field>
          </div>
          {required ? (
            <div className="rounded-lg border border-line bg-bg px-3 py-2.5 text-[13px]" aria-live="polite" data-testid="required-result">
              {required.status === "invalid_weights" && <p className="text-warning">{required.steps[0]}</p>}
              {required.status === "nothing_remaining" && <p className="text-muted">{required.steps[0]}</p>}
              {required.status === "secured" && <p className="text-success">Target of {fmtPercent(required.targetPercent)} is already secured.</p>}
              {required.status === "impossible" && <p className="text-danger">Not reachable: you would need {fmtPercent(required.requiredPercent)} on the remaining work.</p>}
              {required.status === "achievable" && (
                <>
                  <p>
                    To finish with <strong>{fmtPercent(required.targetPercent)}</strong> you need an average of <strong className="text-accent-text">{fmtPercentFixed(required.requiredPercent)}</strong> on the remaining {required.remaining.length === 1 ? "assessment" : `${required.remaining.length} assessments`}.
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                    {required.remaining.map((r) => <li key={r.id}>{r.title}: <strong className="text-fg">{r.requiredScore}</strong> / {r.maxScore} <span className="text-subtle">({r.weight}% of grade)</span></li>)}
                  </ul>
                </>
              )}
              <details className="mt-2"><summary className="cursor-pointer text-xs text-subtle hover:text-muted">Show working</summary><ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-subtle">{required.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></details>
            </div>
          ) : (
            <p className="text-xs text-subtle">Pick a target to see the score you need on the remaining assessments.</p>
          )}
        </section>

        {ungraded.length > 0 && (
          <section aria-labelledby="wi-h" className="space-y-3">
            <h3 id="wi-h" className="flex items-center gap-2 text-[13px] font-semibold"><FlaskConical className="h-3.5 w-3.5 text-accent-text" /> What if…? <Badge>Not saved</Badge></h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {ungraded.map((a) => (
                <Field key={a.id} label={`${a.title} (out of ${a.maxScore})`}>{(p) => <Input {...p} type="number" min={0} step="any" value={hypo[a.id] ?? ""} onChange={(e) => setHypo({ ...hypo, [a.id]: e.target.value })} placeholder="Hypothetical score" />}</Field>
              ))}
            </div>
            {whatIf && (
              <p className="rounded-lg border border-line bg-bg px-3 py-2.5 text-[13px]" aria-live="polite" data-testid="whatif-result">
                {whatIf.finalPercent !== null
                  ? <>Hypothetical final: <strong className="text-accent-text">{fmtPercentFixed(whatIf.finalPercent)}</strong> → <strong>{bandForPercent(scale, whatIf.finalPercent)?.letter}</strong> ({bandForPercent(scale, whatIf.finalPercent)?.points.toFixed(2)} grade points).</>
                  : <>Hypothetical standing so far: <strong className="text-accent-text">{fmtPercentFixed(whatIf.currentPercent)}</strong>{whatIf.letter ? <> → <strong>{whatIf.letter}</strong></> : null}. Some assessments are still ungraded.</>}
              </p>
            )}
          </section>
        )}
      </div>
    </Card>
  );
}
