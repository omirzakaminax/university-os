import { describe, expect, it } from "vitest";
import {
  applyWhatIf,
  assessmentPercent,
  bandForPercent,
  computeCourseGrade,
  computeGpa,
  minPercentForLetter,
  percentForGpa,
  requiredOnRemaining,
  validateScale,
  validateWeights,
  type AssessmentInput,
  type GradingScale,
} from "@/domain/grades/engine";
import { GRADING_PRESETS } from "@/domain/presets";

const kz: GradingScale = (() => {
  const p = GRADING_PRESETS.find((x) => x.id === "kz-4.0")!;
  return { bands: p.bands, rounding: p.rounding, maxPoints: p.maxPoints };
})();

const a = (id: string, weight: number, score: number | null, maxScore = 100): AssessmentInput => ({ id, title: id, weight, score, maxScore });

describe("weights", () => {
  it("accepts weights that sum to 100", () => {
    expect(validateWeights([a("a", 40, null), a("b", 60, null)]).valid).toBe(true);
  });
  it("flags weights under and over 100 and empty courses", () => {
    expect(validateWeights([a("a", 40, null)]).issues[0]).toEqual({ kind: "weights_under_100", total: 40 });
    expect(validateWeights([a("a", 70, null), a("b", 40, null)]).issues[0]).toEqual({ kind: "weights_over_100", total: 110 });
    expect(validateWeights([]).issues[0]).toEqual({ kind: "no_assessments" });
  });
  it("tolerates floating point error (33.333 × 3)", () => {
    expect(validateWeights([a("a", 33.333, null), a("b", 33.333, null), a("c", 33.334, null)]).valid).toBe(true);
  });
});

describe("assessment percent", () => {
  it("handles non-100 max scores and ungraded", () => {
    expect(assessmentPercent({ score: 18, maxScore: 20 })).toBe(90);
    expect(assessmentPercent({ score: null, maxScore: 20 })).toBeNull();
    expect(assessmentPercent({ score: 110, maxScore: 100 })).toBeCloseTo(110); // extra credit is allowed
  });
});

describe("course grade", () => {
  it("computes current percent over graded work only", () => {
    // 30 % weight at 80 %, 20 % weight at 90 % → earned 24 + 18 = 42 over 50 % graded = 84 %
    const g = computeCourseGrade([a("hw", 30, 80), a("mid", 20, 90), a("final", 50, null)], kz);
    expect(g.earned).toBeCloseTo(42);
    expect(g.currentPercent).toBeCloseTo(84);
    expect(g.finalPercent).toBeNull();
    expect(g.isFinal).toBe(false);
    expect(g.weightRemaining).toBeCloseTo(50);
    expect(g.letter).toBe("B");
    expect(g.points).toBe(3);
  });
  it("gives best and worst case", () => {
    const g = computeCourseGrade([a("hw", 50, 80), a("final", 50, null)], kz);
    expect(g.worstCasePercent).toBeCloseTo(40);
    expect(g.bestCasePercent).toBeCloseTo(90);
  });
  it("returns a final percent only when complete and weights valid", () => {
    const done = computeCourseGrade([a("hw", 40, 90), a("final", 60, 70)], kz);
    expect(done.finalPercent).toBeCloseTo(78);
    expect(done.isFinal).toBe(true);
    expect(done.letter).toBe("B-");
    const bad = computeCourseGrade([a("hw", 40, 90), a("final", 50, 70)], kz);
    expect(bad.finalPercent).toBeNull();
    expect(bad.weightsValid).toBe(false);
    expect(bad.steps.join(" ")).toMatch(/not 100 %/);
  });
  it("normalises by max score", () => {
    const g = computeCourseGrade([a("quiz", 100, 17, 20)], kz);
    expect(g.finalPercent).toBeCloseTo(85);
    expect(g.letter).toBe("B+");
  });
  it("does not invent a grade when nothing is graded", () => {
    const g = computeCourseGrade([a("x", 100, null)], kz);
    expect(g.currentPercent).toBeNull();
    expect(g.letter).toBeNull();
    expect(g.points).toBeNull();
  });
  it("explains its working", () => {
    const g = computeCourseGrade([a("hw", 100, 88)], kz);
    expect(g.steps.some((s) => s.includes("88 %"))).toBe(true);
  });
});

describe("scale lookup", () => {
  it("uses band thresholds inclusively", () => {
    expect(bandForPercent(kz, 95)?.letter).toBe("A");
    expect(bandForPercent(kz, 94.99)?.letter).toBe("A-");
    expect(bandForPercent(kz, 0)?.letter).toBe("F");
    expect(bandForPercent(kz, 49.9)?.letter).toBe("F");
  });
  it("supports half-up rounding when configured", () => {
    const r: GradingScale = { ...kz, rounding: "half_up" };
    expect(bandForPercent(r, 94.5)?.letter).toBe("A");
    expect(bandForPercent(r, 94.49)?.letter).toBe("A-");
    expect(minPercentForLetter(r, "A")).toBe(94.5);
    expect(minPercentForLetter(kz, "A")).toBe(95);
    expect(minPercentForLetter(kz, "Z")).toBeNull();
  });
  it("all presets are valid scales", () => {
    for (const p of GRADING_PRESETS) expect(validateScale(p.bands), p.id).toEqual([]);
  });
  it("rejects malformed scales", () => {
    expect(validateScale([])).toHaveLength(1);
    expect(validateScale([{ letter: "A", minPercent: 50, points: 4 }])[0]).toMatch(/start at 0/);
    expect(validateScale([{ letter: "A", minPercent: 0, points: 1 }, { letter: "B", minPercent: 50, points: 0 }]).join()).toMatch(/more points/);
  });
});

describe("required score", () => {
  it("computes the required final exam score", () => {
    // hw 50 % at 80 % → earned 40. Target 85 %: need 45 of 50 → 90 %.
    const r = requiredOnRemaining([a("hw", 50, 80), a("final", 50, null)], 85);
    expect(r.status).toBe("achievable");
    expect(r.requiredPercent).toBeCloseTo(90);
    expect(r.remaining[0]!.requiredScore).toBe(90);
  });
  it("scales to the assessment max score", () => {
    const r = requiredOnRemaining([a("hw", 50, 80), a("final", 50, null, 40)], 85);
    expect(r.remaining[0]!.requiredScore).toBe(36);
  });
  it("detects secured and impossible targets", () => {
    expect(requiredOnRemaining([a("hw", 80, 100), a("final", 20, null)], 70).status).toBe("secured");
    const imp = requiredOnRemaining([a("hw", 50, 40), a("final", 50, null)], 90);
    expect(imp.status).toBe("impossible");
    expect(imp.requiredPercent).toBeCloseTo(140); // earned 20; need 70 of 50 remaining weight
  });
  it("refuses with invalid weights and when nothing remains", () => {
    expect(requiredOnRemaining([a("hw", 50, 80), a("final", 40, null)], 85).status).toBe("invalid_weights");
    expect(requiredOnRemaining([a("hw", 100, 80)], 85).status).toBe("nothing_remaining");
  });
  it("splits a requirement evenly over several remaining assessments", () => {
    const r = requiredOnRemaining([a("hw", 40, 70), a("mid", 30, null), a("final", 30, null)], 70);
    // earned 28, need 42 of 60 → 70 %
    expect(r.requiredPercent).toBeCloseTo(70);
    expect(r.remaining).toHaveLength(2);
  });
});

describe("GPA", () => {
  it("is credit-weighted and never confuses percent with points", () => {
    const res = computeGpa(
      [
        { id: "1", title: "Calculus", credits: 6, percent: 96, includeInGpa: true }, // A = 4.0
        { id: "2", title: "C++", credits: 4, percent: 82, includeInGpa: true }, // B = 3.0
      ],
      kz,
    );
    expect(res.gpa).toBeCloseTo((4 * 6 + 3 * 4) / 10); // 3.6
    expect(res.credits).toBe(10);
    expect(res.gpa).toBeLessThanOrEqual(res.maxPoints);
  });
  it("excludes ungraded, zero-credit and opted-out courses with reasons", () => {
    const res = computeGpa(
      [
        { id: "1", title: "A", credits: 5, percent: null, includeInGpa: true },
        { id: "2", title: "B", credits: 0, percent: 90, includeInGpa: true },
        { id: "3", title: "C", credits: 3, percent: 90, includeInGpa: false },
      ],
      kz,
    );
    expect(res.gpa).toBeNull();
    expect(res.excluded.map((e) => e.reason)).toEqual(["Nothing graded yet", "No credits set", "Marked as not counting toward GPA"]);
  });
  it("uses final percent when complete, current otherwise", () => {
    const inProgress = computeCourseGrade([a("hw", 50, 90), a("final", 50, null)], kz);
    expect(percentForGpa(inProgress)).toBeCloseTo(90);
    const complete = computeCourseGrade([a("hw", 50, 90), a("final", 50, 70)], kz);
    expect(percentForGpa(complete)).toBeCloseTo(80);
  });
});

describe("what-if", () => {
  it("overlays hypothetical scores without mutating input", () => {
    const base = [a("hw", 50, 80), a("final", 50, null)];
    const hypo = applyWhatIf(base, { final: 100 });
    expect(base[1]!.score).toBeNull();
    expect(computeCourseGrade(hypo, kz).finalPercent).toBeCloseTo(90);
  });
});
