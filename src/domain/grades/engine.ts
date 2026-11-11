/**
 * Grade & GPA engine — pure functions, no I/O.
 *
 * Terminology (never mixed up in the UI):
 *   percent   0–100 score in a course or assessment ("87.5 %")
 *   points    grade points on the institution's scale ("3.67 / 4.0")
 *   GPA       credit-weighted mean of points across courses
 *
 * Formulas (also returned as human-readable `steps` so the UI can show its working):
 *   assessment percent        = score / maxScore × 100
 *   earned weighted points    = Σ weight_i × (score_i / maxScore_i)         over graded assessments
 *   current percent (so far)  = earned / Σ weight_i(graded) × 100
 *   final percent             = earned / Σ weight_i(all) × 100               (only when weights sum to 100)
 *   required avg on remaining = (target/100 × Σ weight(all) − earned) / Σ weight(remaining) × 100
 *   GPA                       = Σ(points_c × credits_c) / Σ credits_c
 */

export interface GradeBand {
  letter: string;
  minPercent: number;
  points: number;
}

export interface GradingScale {
  bands: GradeBand[];
  rounding: "none" | "half_up";
  maxPoints: number;
}

export interface AssessmentInput {
  id: string;
  title: string;
  /** Weight as a percentage of the course grade (0–100). */
  weight: number;
  /** null = not graded yet */
  score: number | null;
  maxScore: number;
}

const EPS = 1e-9;
/** Floating-point tolerance for "weights add up to 100". */
export const WEIGHT_TOLERANCE = 0.001;

export const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Percent of an assessment, or null if it has no score. */
export function assessmentPercent(a: Pick<AssessmentInput, "score" | "maxScore">): number | null {
  if (a.score === null) return null;
  if (a.maxScore <= 0) return null;
  return (a.score / a.maxScore) * 100;
}

export type WeightIssue =
  | { kind: "no_assessments" }
  | { kind: "weights_under_100"; total: number }
  | { kind: "weights_over_100"; total: number };

export function validateWeights(assessments: Pick<AssessmentInput, "weight">[]): { total: number; valid: boolean; issues: WeightIssue[] } {
  if (assessments.length === 0) return { total: 0, valid: false, issues: [{ kind: "no_assessments" }] };
  const total = assessments.reduce((s, a) => s + a.weight, 0);
  if (Math.abs(total - 100) <= WEIGHT_TOLERANCE) return { total: round(total, 3), valid: true, issues: [] };
  return {
    total: round(total, 3),
    valid: false,
    issues: [total < 100 ? { kind: "weights_under_100", total: round(total, 3) } : { kind: "weights_over_100", total: round(total, 3) }],
  };
}

// ---------------------------------------------------------------------------
// Scale lookup
// ---------------------------------------------------------------------------

/** Validate a scale: non-empty, a band starting at 0, unique thresholds, points non-increasing as percent drops. */
export function validateScale(bands: GradeBand[]): string[] {
  const errors: string[] = [];
  if (bands.length === 0) return ["The grading scale needs at least one band."];
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  if (sorted[sorted.length - 1]!.minPercent !== 0) errors.push("The lowest band must start at 0 %.");
  for (let i = 1; i < sorted.length; i++) {
    const hi = sorted[i - 1]!;
    const lo = sorted[i]!;
    if (hi.minPercent === lo.minPercent) errors.push(`Two bands start at ${hi.minPercent} %.`);
    if (lo.points > hi.points) errors.push(`${lo.letter} (${lo.minPercent} %) gives more points than ${hi.letter} (${hi.minPercent} %).`);
  }
  return errors;
}

export function bandForPercent(scale: GradingScale, percent: number): GradeBand | null {
  const p = scale.rounding === "half_up" ? Math.floor(percent + 0.5 + EPS) : percent;
  const sorted = [...scale.bands].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((b) => p + EPS >= b.minPercent) ?? null;
}

/** Lowest percent that earns `letter`, if the letter exists on the scale. */
export function minPercentForLetter(scale: GradingScale, letter: string): number | null {
  const b = scale.bands.find((x) => x.letter === letter);
  if (!b) return null;
  return scale.rounding === "half_up" ? Math.max(0, b.minPercent - 0.5) : b.minPercent;
}

// ---------------------------------------------------------------------------
// Course grade
// ---------------------------------------------------------------------------

export interface CourseGrade {
  weightTotal: number;
  weightGraded: number;
  weightRemaining: number;
  /** Σ weight × fraction over graded assessments, in "weight points" (out of weightTotal). */
  earned: number;
  weightsValid: boolean;
  weightIssues: WeightIssue[];
  /** Percent over the work graded so far; null if nothing is graded. */
  currentPercent: number | null;
  /** Final course percent; only when every assessment is graded AND weights sum to 100. */
  finalPercent: number | null;
  /** Lowest the final could end up if every ungraded assessment scores 0. */
  worstCasePercent: number | null;
  /** Highest the final could end up if every ungraded assessment scores 100 %. */
  bestCasePercent: number | null;
  /** Band & points for the *current* percent (or final when complete). */
  letter: string | null;
  points: number | null;
  isFinal: boolean;
  steps: string[];
}

const fmt = (n: number, dp = 2) => round(n, dp).toString();

export function computeCourseGrade(assessments: AssessmentInput[], scale: GradingScale): CourseGrade {
  const { total, valid, issues } = validateWeights(assessments);
  const graded = assessments.filter((a) => assessmentPercent(a) !== null);
  const weightGraded = graded.reduce((s, a) => s + a.weight, 0);
  const weightRemaining = total - weightGraded;
  const earned = graded.reduce((s, a) => s + a.weight * (assessmentPercent(a)! / 100), 0);
  const steps: string[] = [];

  for (const a of graded) {
    const pct = assessmentPercent(a)!;
    steps.push(`${a.title}: ${fmt(a.score!, 3)}/${fmt(a.maxScore, 3)} = ${fmt(pct)} %, weight ${fmt(a.weight, 3)} % → ${fmt(a.weight * (pct / 100), 3)} weighted points`);
  }

  const currentPercent = weightGraded > EPS ? (earned / weightGraded) * 100 : null;
  const complete = assessments.length > 0 && graded.length === assessments.length;
  const finalPercent = complete && valid ? earned : null;
  const denom = total > EPS ? total : null;
  const worstCasePercent = denom ? (earned / denom) * 100 : null;
  const bestCasePercent = denom ? ((earned + weightRemaining) / denom) * 100 : null;

  if (currentPercent !== null) {
    steps.push(`Earned ${fmt(earned, 3)} weighted points over ${fmt(weightGraded, 3)} % of the course graded so far → ${fmt(earned, 3)} ÷ ${fmt(weightGraded, 3)} × 100 = ${fmt(currentPercent)} %`);
  } else {
    steps.push("Nothing is graded yet, so there is no current percentage.");
  }
  if (!valid) {
    for (const i of issues) {
      if (i.kind === "no_assessments") steps.push("No assessments defined for this course.");
      if (i.kind === "weights_under_100") steps.push(`Assessment weights add up to ${fmt(i.total, 3)} %, not 100 %. A final grade is not shown until the weights are corrected.`);
      if (i.kind === "weights_over_100") steps.push(`Assessment weights add up to ${fmt(i.total, 3)} %, which is more than 100 %. A final grade is not shown until the weights are corrected.`);
    }
  } else if (finalPercent !== null) {
    steps.push(`All assessments graded and weights total 100 % → final percent ${fmt(finalPercent)} %`);
  }

  const basis = finalPercent ?? currentPercent;
  const band = basis !== null ? bandForPercent(scale, basis) : null;
  if (band && basis !== null) {
    const r = scale.rounding === "half_up" ? ` (rounded half-up to ${Math.floor(basis + 0.5 + EPS)} %)` : "";
    steps.push(`${fmt(basis)} %${r} falls in the ${band.letter} band (from ${fmt(band.minPercent)} %) → ${fmt(band.points)} grade points`);
  }

  return {
    weightTotal: total,
    weightGraded,
    weightRemaining,
    earned,
    weightsValid: valid,
    weightIssues: issues,
    currentPercent,
    finalPercent,
    worstCasePercent,
    bestCasePercent,
    letter: band?.letter ?? null,
    points: band?.points ?? null,
    isFinal: finalPercent !== null,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Required score on remaining work
// ---------------------------------------------------------------------------

export type RequiredStatus = "secured" | "achievable" | "impossible" | "nothing_remaining" | "invalid_weights";

export interface RequiredScore {
  status: RequiredStatus;
  targetPercent: number;
  /** Average percent needed across ALL remaining assessments (same % on each). */
  requiredPercent: number | null;
  remaining: { id: string; title: string; weight: number; requiredPercent: number; requiredScore: number; maxScore: number }[];
  steps: string[];
}

/**
 * What average percent is required on the ungraded assessments to reach `targetPercent` for the course?
 * Assumes the same percentage on every remaining assessment — the only assumption that does not
 * invent information about which assessment the student will do better on.
 */
export function requiredOnRemaining(assessments: AssessmentInput[], targetPercent: number): RequiredScore {
  const g = computeCourseGrade(assessments, { bands: [], rounding: "none", maxPoints: 4 });
  const remainingItems = assessments.filter((a) => a.score === null);
  const base = { targetPercent, remaining: [] as RequiredScore["remaining"] };
  if (!g.weightsValid) {
    return { ...base, status: "invalid_weights", requiredPercent: null, steps: ["Assessment weights must add up to 100 % before required scores can be calculated."] };
  }
  if (remainingItems.length === 0) {
    return { ...base, status: "nothing_remaining", requiredPercent: null, steps: [`Everything is graded. Final percent is ${fmt(g.finalPercent ?? 0)} %.`] };
  }
  const needPoints = (targetPercent / 100) * g.weightTotal - g.earned;
  const req = (needPoints / g.weightRemaining) * 100;
  const steps = [
    `Target ${fmt(targetPercent)} % of ${fmt(g.weightTotal, 3)} weighted points = ${fmt((targetPercent / 100) * g.weightTotal, 3)}`,
    `Already earned ${fmt(g.earned, 3)} → still need ${fmt(needPoints, 3)} weighted points from ${fmt(g.weightRemaining, 3)} % of remaining weight`,
    `Required average on remaining work = ${fmt(needPoints, 3)} ÷ ${fmt(g.weightRemaining, 3)} × 100 = ${fmt(req)} %`,
  ];
  const remaining = remainingItems.map((a) => ({
    id: a.id,
    title: a.title,
    weight: a.weight,
    requiredPercent: Math.max(0, req),
    requiredScore: round((Math.max(0, req) / 100) * a.maxScore, 2),
    maxScore: a.maxScore,
  }));
  let status: RequiredStatus = "achievable";
  if (req <= EPS) {
    status = "secured";
    steps.push("The target is already secured, even with 0 % on everything that is left.");
  } else if (req > 100 + EPS) {
    status = "impossible";
    steps.push(`This needs more than 100 % on the remaining work (${fmt(req)} %), so the target can no longer be reached.`);
  }
  return { status, targetPercent, requiredPercent: req, remaining, steps };
}

// ---------------------------------------------------------------------------
// GPA
// ---------------------------------------------------------------------------

export interface GpaCourseInput {
  id: string;
  title: string;
  credits: number;
  /** The percent to convert (final if complete, otherwise current). null → excluded. */
  percent: number | null;
  includeInGpa: boolean;
}

export interface GpaResult {
  /** Credit-weighted GPA on the institution's scale; null when no course qualifies. */
  gpa: number | null;
  maxPoints: number;
  credits: number;
  courses: { id: string; title: string; credits: number; percent: number; letter: string; points: number }[];
  excluded: { id: string; title: string; reason: string }[];
  steps: string[];
}

export function computeGpa(inputs: GpaCourseInput[], scale: GradingScale): GpaResult {
  const courses: GpaResult["courses"] = [];
  const excluded: GpaResult["excluded"] = [];
  for (const c of inputs) {
    if (!c.includeInGpa) {
      excluded.push({ id: c.id, title: c.title, reason: "Marked as not counting toward GPA" });
      continue;
    }
    if (c.credits <= 0) {
      excluded.push({ id: c.id, title: c.title, reason: "No credits set" });
      continue;
    }
    if (c.percent === null) {
      excluded.push({ id: c.id, title: c.title, reason: "Nothing graded yet" });
      continue;
    }
    const band = bandForPercent(scale, c.percent);
    if (!band) {
      excluded.push({ id: c.id, title: c.title, reason: "No band matches this percent" });
      continue;
    }
    courses.push({ id: c.id, title: c.title, credits: c.credits, percent: c.percent, letter: band.letter, points: band.points });
  }
  const credits = courses.reduce((s, c) => s + c.credits, 0);
  const weighted = courses.reduce((s, c) => s + c.points * c.credits, 0);
  const gpa = credits > 0 ? weighted / credits : null;
  const steps = courses.map((c) => `${c.title}: ${fmt(c.percent)} % → ${c.letter} = ${fmt(c.points)} points × ${fmt(c.credits, 1)} credits = ${fmt(c.points * c.credits)}`);
  if (gpa !== null) steps.push(`GPA = ${fmt(weighted)} ÷ ${fmt(credits, 1)} credits = ${fmt(gpa)} (scale maximum ${fmt(scale.maxPoints)})`);
  else steps.push("GPA needs at least one graded course with credits.");
  return { gpa, maxPoints: scale.maxPoints, credits, courses, excluded, steps };
}

/** Course-level helper: percent to feed GPA — final when complete, else current ("so far"). */
export function percentForGpa(g: CourseGrade): number | null {
  return g.finalPercent ?? g.currentPercent;
}

// ---------------------------------------------------------------------------
// What-if
// ---------------------------------------------------------------------------

/** Overlay hypothetical raw scores (by assessment id) on top of real assessments. Never mutates the input. */
export function applyWhatIf(assessments: AssessmentInput[], hypothetical: Record<string, number | null>): AssessmentInput[] {
  return assessments.map((a) => (a.id in hypothetical ? { ...a, score: hypothetical[a.id]! } : a));
}
