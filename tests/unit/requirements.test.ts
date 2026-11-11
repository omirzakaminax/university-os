import { describe, expect, it } from "vitest";
import { computeCourseGrade, computeGpa, type AssessmentInput } from "@/domain/grades/engine";
import { evaluateRequirements, policyRequirements, type EvalCourse, type Requirement } from "@/domain/grades/requirements";
import { GRADING_PRESETS } from "@/domain/presets";

const scale = { bands: GRADING_PRESETS[0]!.bands, rounding: "none" as const, maxPoints: 4 };
const a = (id: string, kind: string, weight: number, score: number | null, maxScore = 100): AssessmentInput & { kind: string } => ({ id, title: id, kind, weight, score, maxScore });
const course = (id: string, assessments: (AssessmentInput & { kind: string })[]): EvalCourse => ({ id, title: `Course ${id}`, assessments, grade: computeCourseGrade(assessments, scale) });
const noGpa = computeGpa([], scale);
const req = (kind: Requirement["kind"], threshold: number, extra: Partial<Requirement> = {}): Requirement => ({ id: "r1", name: "Rule", kind, threshold, courseId: null, ...extra });

describe("requirement evaluation", () => {
  it("course pass: in progress → required average; secured; unreachable; final met/not met", () => {
    const inProgress = course("c1", [a("hw", "assignment", 50, 40), a("final", "final", 50, null)]); // earned 20
    const [r1] = evaluateRequirements([req("course_percent", 50)], [inProgress], noGpa, noGpa);
    expect(r1).toMatchObject({ status: "at_risk" }); // current 40 % < 50 %
    expect(r1!.needed).toBeCloseTo(60); // (50−20)/50
    expect(r1!.summary).toMatch(/average of 60%/);

    const secured = course("c2", [a("hw", "assignment", 80, 100), a("final", "final", 20, null)]);
    expect(evaluateRequirements([req("course_percent", 70)], [secured], noGpa, noGpa)[0]).toMatchObject({ status: "met", needed: 0 });

    const unreachable = course("c3", [a("hw", "assignment", 50, 10), a("final", "final", 50, null)]); // best case 55 %
    const [u] = evaluateRequirements([req("course_percent", 60)], [unreachable], noGpa, noGpa);
    expect(u).toMatchObject({ status: "unreachable" });
    expect(u!.summary).toMatch(/Mathematically unreachable/);

    const done1 = course("c4", [a("x", "final", 100, 49)]);
    const done2 = course("c5", [a("x", "final", 100, 50)]);
    const evs = evaluateRequirements([req("course_percent", 50)], [done1, done2], noGpa, noGpa);
    expect(evs.map((e) => e.status)).toEqual(["not_met", "met"]);
  });

  it("refuses to evaluate when weights are invalid instead of guessing", () => {
    const bad = course("c6", [a("hw", "assignment", 40, 90), a("final", "final", 40, null)]);
    expect(evaluateRequirements([req("course_percent", 50)], [bad], noGpa, noGpa)[0]).toMatchObject({ status: "unknown" });
  });

  it("minimum final exam: pending shows the raw score needed; graded finals are judged", () => {
    const pending = course("c7", [a("hw", "assignment", 60, 90), a("final", "final", 40, null, 50)]);
    const [p] = evaluateRequirements([req("final_exam_percent", 40)], [pending], noGpa, noGpa);
    expect(p).toMatchObject({ status: "pending", needed: 20 }); // 40 % of 50
    const ok = course("c8", [a("final", "final", 100, 45, 50)]);
    const bad = course("c9", [a("final", "final", 100, 15, 50)]);
    expect(evaluateRequirements([req("final_exam_percent", 40)], [ok, bad], noGpa, noGpa).map((e) => e.status)).toEqual(["met", "not_met"]);
    // Courses without a final exam produce nothing (no invented requirement).
    expect(evaluateRequirements([req("final_exam_percent", 40)], [course("c10", [a("q", "quiz", 100, 80)])], noGpa, noGpa)).toEqual([]);
  });

  it("GPA targets compare against the computed GPA and say they move", () => {
    const g = computeGpa([{ id: "1", title: "A", credits: 5, percent: 82, includeInGpa: true }], scale); // B = 3.0
    expect(evaluateRequirements([req("period_gpa", 3.0)], [], g, g)[0]).toMatchObject({ status: "on_track", subject: "This period's GPA" });
    const low = evaluateRequirements([req("cumulative_gpa", 3.5, { id: "r2" })], [], g, g)[0]!;
    expect(low.status).toBe("at_risk");
    expect(low.summary).toMatch(/moves as grades arrive/);
    expect(evaluateRequirements([req("period_gpa", 3)], [], noGpa, noGpa)[0]!.status).toBe("unknown");
  });

  it("can be limited to one course, and institution policy becomes ordinary requirements", () => {
    const c1 = course("c11", [a("x", "final", 100, 90)]);
    const c2 = course("c12", [a("x", "final", 100, 10)]);
    expect(evaluateRequirements([req("course_percent", 50, { courseId: "c12" })], [c1, c2], noGpa, noGpa).map((e) => e.subject)).toEqual(["Course c12"]);
    expect(policyRequirements({ passPercent: null, minFinalPercent: null })).toEqual([]); // nothing assumed
    expect(policyRequirements({ passPercent: 50, minFinalPercent: 30 }).map((r) => [r.kind, r.threshold])).toEqual([["course_percent", 50], ["final_exam_percent", 30]]);
  });
});
