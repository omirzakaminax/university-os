import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Badge, Card, CardHeader, CourseDot, EmptyState, PageHeader, Progress } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GpaChart } from "@/components/grades/gpa-chart";
import { fmtGpa, fmtPercent } from "@/components/format";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { gpaByPeriod, gpaFor, loadGradebook } from "@/server/services/grades";
import { percentForGpa } from "@/domain/grades/engine";
import { evaluateRequirements, policyRequirements } from "@/domain/grades/requirements";
import { RequirementsCard } from "@/components/grades/requirements-card";
import { listRequirements } from "@/server/services/requirements";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesPage() {
  const app = await getAppContext();
  const { scale, activePeriod, periods } = app.academic;
  const [book, userReqs] = await withUser(app.userId, async (tx) => [await loadGradebook(tx, scale), await listRequirements(tx)] as const);
  const inPeriod = book.filter((c) => c.periodId === activePeriod.id);
  const periodGpa = gpaFor(inPeriod, scale);
  const cumulative = gpaFor(book, scale);
  const perPeriod = gpaByPeriod(book, periods, scale).filter((p) => p.gpa !== null);
  // Requirements apply to the courses of the selected period (history stays untouched).
  const reqs = [...policyRequirements({ passPercent: scale.passPercent, minFinalPercent: scale.minFinalPercent }), ...userReqs];
  const evaluations = evaluateRequirements(reqs, inPeriod.map((c) => ({ id: c.id, title: c.title, assessments: c.assessments.map((a) => ({ ...a, kind: c.assessmentKinds[a.id] ?? "other" })), grade: c.grade })), periodGpa, cumulative);

  return (
    <>
      <PageHeader title="Grades" description={`${activePeriod.yearLabel} · ${activePeriod.name} · scale: ${scale.name}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="This period GPA" value={fmtGpa(periodGpa.gpa)} sub={`${periodGpa.courses.length} graded ${periodGpa.courses.length === 1 ? "course" : "courses"} · ${periodGpa.credits} credits`} max={scale.maxPoints} />
        <Summary label="Cumulative GPA" value={fmtGpa(cumulative.gpa)} sub={`${cumulative.courses.length} graded courses · ${cumulative.credits} credits`} max={scale.maxPoints} />
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-subtle">How to read this</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">GPA is a credit-weighted average of <em>grade points</em> from your scale — not an average of percentages. Courses still in progress count using the percent earned so far, so the number moves as grades arrive.</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Courses this period" description="Percent is shown separately from grade points" />
        {inPeriod.length === 0 ? (
          <EmptyState icon={<GraduationCap className="h-4 w-4" />} title="No courses in this period" description="Create courses and add assessments to see grades here." action={<Link href="/courses?new=1"><Button size="sm" variant="primary">Add a course</Button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[34rem] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-subtle">
                  <th className="px-4 py-1.5 font-medium">Course</th><th className="px-2 py-1.5 font-medium">Credits</th><th className="px-2 py-1.5 font-medium">Percent</th><th className="px-2 py-1.5 font-medium">Letter</th><th className="px-2 py-1.5 font-medium">Points</th><th className="px-2 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inPeriod.map((c) => {
                  const pct = percentForGpa(c.grade);
                  return (
                    <tr key={c.id} className="hover:bg-hover/50">
                      <td className="px-4 py-2"><Link href={`/courses/${c.id}`} className="flex items-center gap-2 hover:text-accent-text"><CourseDot color={c.color} />{c.title}</Link></td>
                      <td className="px-2 py-2 tabular-nums text-muted">{c.credits}</td>
                      <td className="w-40 px-2 py-2"><div className="flex items-center gap-2"><span className="w-12 tabular-nums">{fmtPercent(pct)}</span>{pct !== null && <Progress className="w-16" value={pct} label={`${c.title} percent`} />}</div></td>
                      <td className="px-2 py-2 font-medium">{c.grade.letter ?? "—"}</td>
                      <td className="px-2 py-2 tabular-nums">{c.grade.points?.toFixed(2) ?? "—"}</td>
                      <td className="px-2 py-2">
                        {!c.includeInGpa ? <Badge>Not in GPA</Badge> : c.grade.isFinal ? <Badge tone="success">Final</Badge> : pct === null ? <Badge>No grades</Badge> : !c.grade.weightsValid ? <Badge tone="warning">Weights ≠ 100%</Badge> : <Badge tone="accent">In progress</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="GPA by period" description="Historical comparison across academic periods" />
          <div className="p-4">
            {perPeriod.length < 1 ? <p className="py-8 text-center text-xs text-subtle">Graded courses will appear here, one bar per academic period.</p> : <GpaChart data={perPeriod.map((p) => ({ label: `${p.name}`, gpa: p.gpa! }))} max={scale.maxPoints} />}
          </div>
        </Card>
        <Card>
          <CardHeader title="GPA working" description="Exactly how the numbers above are obtained" />
          <ol className="list-decimal space-y-1 p-4 pl-8 text-xs text-muted">{periodGpa.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          {periodGpa.excluded.length > 0 && (
            <div className="border-t border-line px-4 py-3 text-xs text-subtle">
              <p className="mb-1 font-medium text-muted">Not included</p>
              <ul className="space-y-0.5">{periodGpa.excluded.map((e) => <li key={e.id}>{e.title} — {e.reason}</li>)}</ul>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4"><RequirementsCard evaluations={evaluations} definitions={reqs.map((r) => ({ id: r.id, name: r.name, sourceNote: null }))} courses={inPeriod.map((c) => ({ id: c.id, title: c.title }))} /></div>

      <Card className="mt-4">
        <CardHeader title="Grading scale" description={scale.name} action={<Link href="/settings" className="text-xs text-muted hover:text-fg">Edit in settings</Link>} />
        <div className="flex flex-wrap gap-1.5 p-4">
          {scale.bands.map((b) => <Badge key={b.letter} className="tabular-nums">{b.letter} · ≥{b.minPercent}% · {b.points.toFixed(2)}</Badge>)}
        </div>
      </Card>
    </>
  );
}

function Summary({ label, value, sub, max }: { label: string; value: string; sub: string; max: number }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}<span className="ml-1 text-sm font-normal text-subtle">/ {max.toFixed(1)}</span></p>
      <p className="mt-0.5 text-xs text-subtle">{sub}</p>
    </Card>
  );
}
