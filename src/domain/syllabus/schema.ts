import { z } from "zod";

const ASSESSMENT_KINDS = ["assignment", "quiz", "lab", "project", "midterm", "final", "exam", "participation", "other"] as const;

/**
 * What an analysis proposes. Everything is optional/nullable on purpose: a field is null when the document
 * does not state it — never guessed. `evidence` quotes the source text so the student (and the verifier) can check it.
 */
export const syllabusDraftSchema = z.object({
  title: z.string().trim().max(200).nullable(),
  code: z.string().trim().max(30).nullable(),
  description: z.string().trim().max(5000).nullable(),
  credits: z.number().min(0).max(60).nullable(),
  instructor: z.object({ name: z.string().trim().max(120), email: z.string().trim().max(254).nullable() }).nullable(),
  objectives: z.array(z.string().trim().min(1).max(500)).max(40),
  topics: z.array(z.object({ week: z.number().int().min(1).max(60).nullable(), title: z.string().trim().min(1).max(200) })).max(80),
  readings: z.array(z.string().trim().min(1).max(500)).max(40),
  assessments: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        kind: z.enum(ASSESSMENT_KINDS),
        weightPercent: z.number().min(0).max(100).nullable(),
        dueDate: z.iso.date().nullable(),
        evidence: z.string().trim().max(400),
        verified: z.boolean().default(true),
      }),
    )
    .max(40),
  gradingNotes: z.array(z.string().trim().min(1).max(500)).max(20),
  importantDates: z.array(z.object({ title: z.string().trim().min(1).max(200), date: z.iso.date(), evidence: z.string().trim().max(400), verified: z.boolean().default(true) })).max(40),
});
export type SyllabusDraft = z.infer<typeof syllabusDraftSchema>;
export type DraftAssessment = SyllabusDraft["assessments"][number];

export const emptyDraft = (): SyllabusDraft => ({
  title: null,
  code: null,
  description: null,
  credits: null,
  instructor: null,
  objectives: [],
  topics: [],
  readings: [],
  assessments: [],
  gradingNotes: [],
  importantDates: [],
});

export interface DraftWarning {
  level: "info" | "warning";
  message: string;
}
