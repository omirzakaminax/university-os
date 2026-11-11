/**
 * User-configured academic requirements, evaluated against stored grades.
 *
 * The app ships NO thresholds. "Pass mark", "minimum final exam", "avoid a retake", "scholarship GPA" are all
 * rules the student (or the institution preset they confirmed) enters, each with its own meaning. The app never
 * says a student "will need summer school" — it can only say whether a *configured* requirement is met, at risk,
 * or mathematically unreachable, and show the arithmetic.
 */
import { requiredOnRemaining, type AssessmentInput, type CourseGrade, type GpaResult } from "@/domain/grades/engine";

export type RequirementKind = "course_percent" | "final_exam_percent" | "period_gpa" | "cumulative_gpa";

export interface Requirement {
  id: string;
  name: string;
  kind: RequirementKind;
  threshold: number;
  /** Restrict a course-level requirement to one course (otherwise it applies to every course in scope). */
  courseId: string | null;
}

export type RequirementStatus = "met" | "on_track" | "at_risk" | "unreachable" | "not_met" | "pending" | "unknown";

export interface RequirementEvaluation {
  requirementId: string;
  name: string;
  kind: RequirementKind;
  subject: string;
  status: RequirementStatus;
  summary: string;
  /** Score/percent still needed, when that is meaningful. */
  needed: number | null;
  steps: string[];
}

export interface EvalCourse {
  id: string;
  title: string;
  assessments: (AssessmentInput & { kind: string })[];
  grade: CourseGrade;
}

const f = (n: number, dp = 2) => Number(n.toFixed(dp)).toString();

export function evaluateRequirements(reqs: Requirement[], courses: EvalCourse[], periodGpa: GpaResult, cumulativeGpa: GpaResult): RequirementEvaluation[] {
  const out: RequirementEvaluation[] = [];
  for (const r of reqs) {
    if (r.kind === "period_gpa" || r.kind === "cumulative_gpa") {
      const g = r.kind === "period_gpa" ? periodGpa : cumulativeGpa;
      const label = r.kind === "period_gpa" ? "This period's GPA" : "Cumulative GPA";
      if (g.gpa === null) out.push({ requirementId: r.id, name: r.name, kind: r.kind, subject: label, status: "unknown", summary: "No graded, credited courses yet.", needed: null, steps: [] });
      else {
        const ok = g.gpa + 1e-9 >= r.threshold;
        out.push({
          requirementId: r.id, name: r.name, kind: r.kind, subject: label, status: ok ? "on_track" : "at_risk", needed: ok ? null : r.threshold,
          summary: `${f(g.gpa)} so far vs ${f(r.threshold)} required — ${ok ? "currently at or above" : "currently below"} the target. This moves as grades arrive.`,
          steps: g.steps,
        });
      }
      continue;
    }
    for (const c of courses.filter((x) => !r.courseId || x.id === r.courseId)) {
      if (r.kind === "course_percent") out.push(evalCourse(r, c));
      else out.push(...evalFinal(r, c));
    }
  }
  return out;
}

function base(r: Requirement, subject: string) {
  return { requirementId: r.id, name: r.name, kind: r.kind, subject };
}

function evalCourse(r: Requirement, c: EvalCourse): RequirementEvaluation {
  const b = base(r, c.title);
  const g = c.grade;
  if (!g.weightsValid) return { ...b, status: "unknown", summary: "Assessment weights do not add up to 100%, so this cannot be evaluated yet.", needed: null, steps: g.steps };
  if (g.finalPercent !== null) {
    const ok = g.finalPercent + 1e-9 >= r.threshold;
    return { ...b, status: ok ? "met" : "not_met", summary: `Final ${f(g.finalPercent)}% vs ${f(r.threshold)}% required — ${ok ? "met" : "not met"}.`, needed: null, steps: g.steps };
  }
  if (g.worstCasePercent !== null && g.worstCasePercent + 1e-9 >= r.threshold) return { ...b, status: "met", summary: `Already secured: even 0% on everything left gives ${f(g.worstCasePercent)}%, above ${f(r.threshold)}%.`, needed: 0, steps: g.steps };
  if (g.bestCasePercent !== null && g.bestCasePercent + 1e-9 < r.threshold) {
    return { ...b, status: "unreachable", summary: `Mathematically unreachable under the configured weights: full marks on everything left gives ${f(g.bestCasePercent)}%, below ${f(r.threshold)}%.`, needed: null, steps: g.steps };
  }
  const req = requiredOnRemaining(c.assessments, r.threshold);
  const need = req.requiredPercent;
  const onTrack = g.currentPercent !== null && g.currentPercent + 1e-9 >= r.threshold;
  return {
    ...b,
    status: onTrack ? "on_track" : "at_risk",
    summary: need === null ? "Cannot be evaluated." : `Needs an average of ${f(need)}% on the remaining ${req.remaining.length === 1 ? "assessment" : `${req.remaining.length} assessments`} to reach ${f(r.threshold)}%.`,
    needed: need,
    steps: req.steps,
  };
}

function evalFinal(r: Requirement, c: EvalCourse): RequirementEvaluation[] {
  const finals = c.assessments.filter((a) => a.kind === "final");
  if (finals.length === 0) return [];
  return finals.map((a) => {
    const b = base(r, `${c.title} — ${a.title}`);
    if (a.score !== null) {
      const pct = (a.score / a.maxScore) * 100;
      const ok = pct + 1e-9 >= r.threshold;
      return { ...b, status: ok ? "met" : "not_met", summary: `${f(pct)}% vs ${f(r.threshold)}% minimum — ${ok ? "met" : "not met"}.`, needed: null, steps: [`${f(a.score, 3)} / ${f(a.maxScore, 3)} = ${f(pct)}%`] } as RequirementEvaluation;
    }
    const raw = (r.threshold / 100) * a.maxScore;
    return { ...b, status: "pending", summary: `Not taken yet. The configured minimum is ${f(r.threshold)}% = ${f(raw)} / ${f(a.maxScore)}.`, needed: raw, steps: [`${f(r.threshold)}% × ${f(a.maxScore)} = ${f(raw)}`] } as RequirementEvaluation;
  });
}

/** Institution-level thresholds stored on the grading scale become ordinary requirements. */
export function policyRequirements(policy: { passPercent: number | null; minFinalPercent: number | null }): Requirement[] {
  const out: Requirement[] = [];
  if (policy.passPercent !== null) out.push({ id: "policy:pass", name: "Course pass mark (grading scale setting)", kind: "course_percent", threshold: policy.passPercent, courseId: null });
  if (policy.minFinalPercent !== null) out.push({ id: "policy:final", name: "Minimum final exam (grading scale setting)", kind: "final_exam_percent", threshold: policy.minFinalPercent, courseId: null });
  return out;
}
