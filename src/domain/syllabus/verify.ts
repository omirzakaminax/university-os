import type { DraftWarning, SyllabusDraft } from "@/domain/syllabus/schema";

const squash = (s: string) => s.toLowerCase().replace(/[\s ]+/g, " ").replace(/[“”"'`]/g, "").trim();

/**
 * Anti-hallucination check for AI output: every assessment/date must quote text that is actually in the
 * document ("evidence"), and the quoted line must contain the weight/date it claims. Items that fail are
 * kept but flagged `verified: false`, so the student sees "could not be confirmed in your document".
 */
export function verifyDraftAgainstText(draft: SyllabusDraft, sourceText: string): { draft: SyllabusDraft; warnings: DraftWarning[] } {
  const hay = squash(sourceText);
  const warnings: DraftWarning[] = [];
  const evidenceOk = (e: string) => e.length >= 4 && hay.includes(squash(e));
  const hasNumber = (e: string, n: number) => new RegExp(`(^|[^\\d.])${String(n).replace(".", "[.,]")}\\s*%`).test(e);

  const assessments = draft.assessments.map((a) => {
    const ok = evidenceOk(a.evidence) && (a.weightPercent === null || hasNumber(a.evidence, a.weightPercent));
    return { ...a, verified: ok };
  });
  const importantDates = draft.importantDates.map((d) => ({ ...d, verified: evidenceOk(d.evidence) && d.evidence.includes(d.date.slice(0, 4)) }));
  const bad = assessments.filter((a) => !a.verified).length + importantDates.filter((d) => !d.verified).length;
  if (bad > 0) warnings.push({ level: "warning", message: `${bad} suggested item${bad === 1 ? "" : "s"} could not be confirmed in your document and ${bad === 1 ? "is" : "are"} marked “unverified”. Check or remove ${bad === 1 ? "it" : "them"}.` });
  return { draft: { ...draft, assessments, importantDates }, warnings };
}
