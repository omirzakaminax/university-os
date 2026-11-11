/**
 * Rules-based syllabus extraction — pure, deterministic, no AI, no network.
 *
 * It only reports what is literally present in the text (every assessment carries the line it came from as
 * evidence). It is intentionally conservative: when a pattern is ambiguous it leaves the field empty and lets
 * the student fill it in during review.
 */
import { emptyDraft, type DraftAssessment, type DraftWarning, type SyllabusDraft } from "@/domain/syllabus/schema";

type Kind = DraftAssessment["kind"];

// JS `\b` is ASCII-only, so keyword boundaries use Unicode-aware lookbehinds (works for Cyrillic too).
const L = String.raw`(?<![\p{L}])`;
const KIND_RULES: [RegExp, Kind][] = [
  [new RegExp(`${L}(final|итогов|финал)`, "iu"), "final"],
  [new RegExp(`${L}(mid[\\s-]?term|рубежн|мидтерм)`, "iu"), "midterm"],
  [new RegExp(`${L}(exam|экзамен)`, "iu"), "exam"],
  [new RegExp(`${L}(quiz|тест|контрольн)`, "iu"), "quiz"],
  [new RegExp(`${L}(lab|labs|laboratory|лаборатор)`, "iu"), "lab"],
  [new RegExp(`${L}(project|проект)`, "iu"), "project"],
  [new RegExp(`${L}(attendance|participation|посещаем|активност)`, "iu"), "participation"],
  [new RegExp(`${L}(assign|homework|hw\\b|задани|домашн)`, "iu"), "assignment"],
];

export const inferKind = (title: string): Kind => KIND_RULES.find(([re]) => re.test(title))?.[1] ?? "other";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const validDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Finds an explicit calendar date in a line (ISO, DD.MM.YYYY, or "12 December 2026"). Never infers a missing year. */
export function findExplicitDate(line: string): string | null {
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(line);
  if (m && validDate(+m[1]!, +m[2]!, +m[3]!)) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/.exec(line);
  if (m && validDate(+m[3]!, +m[2]!, +m[1]!)) return `${m[3]}-${pad(+m[2]!)}-${pad(+m[1]!)}`;
  m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(line);
  if (m && MONTHS[m[2]!.toLowerCase()] && validDate(+m[3]!, MONTHS[m[2]!.toLowerCase()]!, +m[1]!)) return `${m[3]}-${pad(MONTHS[m[2]!.toLowerCase()]!)}-${pad(+m[1]!)}`;
  return null;
}

const HEADING_OBJECTIVES = /^(learning\s+(objectives|outcomes)|course\s+(objectives|outcomes|aims)|objectives|цели|результаты обучения)\b/i;
const HEADING_READINGS = /^(required\s+reading|readings?|textbooks?|references|recommended\s+reading|literature|литература|учебники)\b/i;
const ANY_HEADING = /^(grading|assessment|evaluation|schedule|weekly|course\s+(description|content|schedule|policies)|policies|learning|objectives|readings?|textbooks?|references|instructor|contact|academic|attendance|оценивани|расписание)\b/i;

const cleanBullet = (s: string) => s.replace(/^[\s•·▪●◦\-–*\d.)]+/, "").trim();

export function extractSyllabus(text: string): { draft: SyllabusDraft; warnings: DraftWarning[] } {
  const draft = emptyDraft();
  const warnings: DraftWarning[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const nonEmpty = lines.filter(Boolean);

  // ---- title / code ------------------------------------------------------------------------------------------
  const labelled = nonEmpty.find((l) => /^(course\s*(title|name)|title|название курса|дисциплина)\s*[:：]/i.test(l));
  if (labelled) draft.title = labelled.replace(/^[^:：]+[:：]\s*/, "").slice(0, 200) || null;
  else if (nonEmpty[0] && nonEmpty[0].length <= 120 && !/%/.test(nonEmpty[0])) draft.title = nonEmpty[0];
  const codeMatch = /\b([A-Z]{2,5}[\s-]?\d{3,4}[A-Z]?)\b/.exec(nonEmpty.slice(0, 15).join("\n"));
  if (codeMatch) draft.code = codeMatch[1]!.replace(/\s+/, " ");

  // ---- instructor / credits ----------------------------------------------------------------------------------
  const instr = nonEmpty.find((l) => /^(instructor|lecturer|teacher|professor|преподаватель|лектор)\s*[:：-]/i.test(l));
  if (instr) {
    const rest = instr.replace(/^[^:：-]+[:：-]\s*/, "");
    const email = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(rest)?.[0] ?? null;
    const name = rest.replace(email ?? "", "").replace(/[()<>,;]+/g, " ").replace(/\s+/g, " ").trim();
    if (name) draft.instructor = { name: name.slice(0, 120), email };
  }
  const cr = /(\d+(?:[.,]\d+)?)\s*(?:credits?|ects|кредит)/i.exec(text) ?? /(?:credits?|ects|кредит\w*)\s*[:：]?\s*(\d+(?:[.,]\d+)?)/i.exec(text);
  if (cr) {
    const v = Number(cr[1]!.replace(",", "."));
    if (v >= 0 && v <= 60) draft.credits = v;
  }

  // ---- sections by heading ------------------------------------------------------------------------------------
  const collect = (heading: RegExp): string[] => {
    const out: string[] = [];
    const idx = lines.findIndex((l) => heading.test(l.replace(/[:：]\s*$/, "")));
    if (idx < 0) return out;
    const inline = lines[idx]!.split(/[:：]/).slice(1).join(":").trim();
    if (inline) out.push(cleanBullet(inline));
    for (let i = idx + 1; i < lines.length && out.length < 40; i++) {
      const l = lines[i]!;
      if (!l) {
        if (out.length) break;
        continue;
      }
      if (ANY_HEADING.test(l) && !/^[•\-–*\d]/.test(l)) break;
      out.push(cleanBullet(l));
    }
    return out.filter((s) => s.length > 1);
  };
  draft.objectives = collect(HEADING_OBJECTIVES).slice(0, 40);
  draft.readings = collect(HEADING_READINGS).slice(0, 40);

  const descIdx = lines.findIndex((l) => /^(course\s+description|description|about the course|описание)\s*[:：]?/i.test(l));
  if (descIdx >= 0) {
    const first = lines[descIdx]!.replace(/^[^:：]+[:：]\s*/, "");
    const body: string[] = first && first !== lines[descIdx] ? [first] : [];
    for (let i = descIdx + 1; i < lines.length && body.join(" ").length < 1500; i++) {
      if (!lines[i]) {
        if (body.length) break;
        continue;
      }
      if (ANY_HEADING.test(lines[i]!)) break;
      body.push(lines[i]!);
    }
    if (body.length) draft.description = body.join(" ").slice(0, 5000);
  }

  // ---- weekly topics ---------------------------------------------------------------------------------------------
  for (const l of lines) {
    const m = /^(?:week|wk|неделя|тема|lecture|lec)\s*#?\s*(\d{1,2})\s*[:.\-–—)]\s*(.+)$/i.exec(l);
    if (m && m[2] && m[2].length <= 200) draft.topics.push({ week: Number(m[1]), title: m[2].trim() });
  }

  // ---- assessments: "<name> ... 30%" ----------------------------------------------------------------------------
  const seen = new Set<string>();
  for (const l of lines) {
    if (!l || l.length > 200) continue;
    const m = /^(.*?)[\s:–—|.\-]*\b(\d{1,3}(?:[.,]\d+)?)\s*%/.exec(l);
    if (!m) continue;
    const title = m[1]!.replace(/[|:–—\-.\s(]+$/, "").replace(/^[\s•·▪●◦\-–*\d.)]+/, "").trim();
    const weight = Number(m[2]!.replace(",", "."));
    if (!title || title.length > 120 || weight > 100 || /^\d+$/.test(title)) continue;
    if (/^total\b|^итого|^pass|^minimum|^at least|attendance (below|less)/i.test(title)) continue;
    // Rules written as sentences ("Students must obtain at least 50% …") are grading notes, not assessments.
    if (title.split(" ").length > 6 || /\b(must|should|shall|need|require[sd]?|obtain|minimum|at least|below|less than|more than|to pass)\b/i.test(title)) continue;
    const key = `${title.toLowerCase()}|${weight}`;
    if (seen.has(key)) continue;
    seen.add(key);
    draft.assessments.push({ title, kind: inferKind(title), weightPercent: weight, dueDate: findExplicitDate(l), evidence: l.slice(0, 400), verified: true });
  }

  // ---- explicit dates near deadline keywords ----------------------------------------------------------------------
  for (const l of lines) {
    if (!/\b(exam|midterm|final|deadline|due|quiz|submission|экзамен|дедлайн|срок)\b/i.test(l)) continue;
    const date = findExplicitDate(l);
    if (date) draft.importantDates.push({ title: l.replace(/\s*[-–:]?\s*\d.*$/, "").slice(0, 120) || l.slice(0, 120), date, evidence: l.slice(0, 400), verified: true });
  }

  // ---- grading notes (free text rules the student should read; not interpreted) ----------------------------------
  for (const l of lines) {
    if (/\b(minimum|at least|must (obtain|score|pass)|passing|pass mark|fail|retake|resit|attendance)\b/i.test(l) && l.length <= 300 && !/^\d+\s*%/.test(l)) draft.gradingNotes.push(l);
  }
  draft.gradingNotes = [...new Set(draft.gradingNotes)].slice(0, 20);

  // ---- warnings -------------------------------------------------------------------------------------------------
  if (draft.assessments.length === 0) warnings.push({ level: "warning", message: "No assessment weights (like “Final exam 40%”) were found. Add them manually." });
  else {
    const total = draft.assessments.reduce((s, a) => s + (a.weightPercent ?? 0), 0);
    if (Math.abs(total - 100) > 0.001) warnings.push({ level: "warning", message: `The weights found add up to ${Number(total.toFixed(2))}%, not 100%. Check for missing or duplicated lines before approving.` });
  }
  if (draft.topics.length === 0) warnings.push({ level: "info", message: "No weekly topics were detected. You can add topics later." });
  if (!draft.title) warnings.push({ level: "warning", message: "No course title was detected." });
  warnings.push({ level: "info", message: "Extracted by rules from the document text. Review every value — nothing is saved until you approve." });
  return { draft, warnings };
}
