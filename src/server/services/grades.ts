import type { Tx } from "@/server/db/client";
import { computeCourseGrade, computeGpa, percentForGpa, type AssessmentInput, type CourseGrade, type GpaResult, type GradingScale } from "@/domain/grades/engine";
import type { Period } from "@/server/services/academics";

export interface GradebookCourse {
  id: string;
  title: string;
  code: string | null;
  color: string;
  credits: number;
  includeInGpa: boolean;
  periodId: string;
  targetPercent: number | null;
  assessments: AssessmentInput[];
  /** assessment id → kind (final, midterm, …) for rule evaluation */
  assessmentKinds: Record<string, string>;
  grade: CourseGrade;
}

/** Load every non-deleted course with its assessments and compute grades with the institution's scale. */
export async function loadGradebook(tx: Tx, scale: GradingScale): Promise<GradebookCourse[]> {
  const courses = await tx<{ id: string; title: string; code: string | null; color: string; credits: number; includeInGpa: boolean; periodId: string; targetPercent: number | null }[]>`
    select id, title, code, color, credits, include_in_gpa, period_id, target_percent from courses where deleted_at is null order by lower(title)`;
  const rows = await tx<{ id: string; courseId: string; title: string; kind: string; weightPercent: number; score: number | null; maxScore: number }[]>`
    select a.id, a.course_id, a.title, a.kind, a.weight_percent, a.score, a.max_score
    from assessments a join courses c on c.id = a.course_id where c.deleted_at is null order by a.due_at nulls last, a.created_at`;
  const byCourse = new Map<string, AssessmentInput[]>();
  const kinds = new Map<string, Record<string, string>>();
  for (const r of rows) {
    const list = byCourse.get(r.courseId) ?? [];
    list.push({ id: r.id, title: r.title, weight: r.weightPercent, score: r.score, maxScore: r.maxScore });
    byCourse.set(r.courseId, list);
    kinds.set(r.courseId, { ...(kinds.get(r.courseId) ?? {}), [r.id]: r.kind });
  }
  return courses.map((c) => {
    const assessments = byCourse.get(c.id) ?? [];
    return { ...c, assessments, assessmentKinds: kinds.get(c.id) ?? {}, grade: computeCourseGrade(assessments, scale) };
  });
}

export function gpaFor(courses: GradebookCourse[], scale: GradingScale): GpaResult {
  return computeGpa(
    courses.map((c) => ({ id: c.id, title: c.title, credits: c.credits, percent: percentForGpa(c.grade), includeInGpa: c.includeInGpa })),
    scale,
  );
}

export interface PeriodGpa { periodId: string; name: string; yearLabel: string; gpa: number | null; credits: number; courseCount: number }

export function gpaByPeriod(courses: GradebookCourse[], periods: Period[], scale: GradingScale): PeriodGpa[] {
  return periods
    .map((p) => {
      const inPeriod = courses.filter((c) => c.periodId === p.id);
      const r = gpaFor(inPeriod, scale);
      return { periodId: p.id, name: p.name, yearLabel: p.yearLabel, gpa: r.gpa, credits: r.credits, courseCount: inPeriod.length };
    })
    .filter((p) => p.courseCount > 0);
}
