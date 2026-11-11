import { describe, expect, it } from "vitest";
import { extractSyllabus, findExplicitDate, inferKind } from "@/domain/syllabus/heuristic";
import { verifyDraftAgainstText } from "@/domain/syllabus/verify";
import { emptyDraft, syllabusDraftSchema } from "@/domain/syllabus/schema";

// A fictional syllabus used only as test input (NOT real course requirements).
const SAMPLE = `Introduction to Programming
Course code: CS 101
Instructor: Dr. Jane Doe (jane.doe@example.edu)
Credits: 5

Course Description:
This course introduces programming concepts using C++.
It covers variables, control flow and functions.

Learning Objectives
• Write simple C++ programs
• Debug programs systematically

Weekly Schedule
Week 1: Introduction and tooling
Week 2 - Variables and types
Week 3. Control flow

Grading
Attendance 10%
Assignments - 20%
Midterm exam | 30%
Final exam: 40%
Total 100%

Midterm exam on 15.03.2027
Assignment 1 is due 2027-02-20.
Students must obtain at least 50% in the final exam to pass.

Required Reading
Stroustrup, Programming: Principles and Practice Using C++
`;

describe("rules-based syllabus extraction", () => {
  const { draft, warnings } = extractSyllabus(SAMPLE);
  it("extracts identity fields only when present", () => {
    expect(draft.title).toBe("Introduction to Programming");
    expect(draft.code).toBe("CS 101");
    expect(draft.credits).toBe(5);
    expect(draft.instructor).toEqual({ name: "Dr. Jane Doe", email: "jane.doe@example.edu" });
    expect(draft.description).toContain("introduces programming concepts");
  });
  it("extracts objectives, topics and readings", () => {
    expect(draft.objectives).toEqual(["Write simple C++ programs", "Debug programs systematically"]);
    expect(draft.topics).toEqual([
      { week: 1, title: "Introduction and tooling" },
      { week: 2, title: "Variables and types" },
      { week: 3, title: "Control flow" },
    ]);
    expect(draft.readings[0]).toContain("Stroustrup");
  });
  it("extracts weighted assessments with the line as evidence and sums to 100", () => {
    const byTitle = Object.fromEntries(draft.assessments.map((a) => [a.title, a]));
    expect(byTitle["Attendance"]).toMatchObject({ weightPercent: 10, kind: "participation", evidence: "Attendance 10%" });
    expect(byTitle["Assignments"]).toMatchObject({ weightPercent: 20, kind: "assignment" });
    expect(byTitle["Midterm exam"]).toMatchObject({ weightPercent: 30, kind: "midterm" });
    expect(byTitle["Final exam"]).toMatchObject({ weightPercent: 40, kind: "final" });
    expect(draft.assessments).toHaveLength(4); // "Total 100%" and "at least 50%" lines are not assessments
    expect(warnings.some((w) => w.message.includes("not 100%"))).toBe(false);
  });
  it("captures explicit dates and grading rules as notes without interpreting them", () => {
    expect(draft.importantDates.map((d) => d.date).sort()).toEqual(["2027-02-20", "2027-03-15"]);
    expect(draft.gradingNotes.some((n) => /at least 50%/.test(n))).toBe(true);
  });
  it("always passes the draft schema and always asks for review", () => {
    expect(syllabusDraftSchema.safeParse(draft).success).toBe(true);
    expect(warnings.at(-1)!.message).toMatch(/nothing is saved until you approve/);
  });
  it("warns when weights do not add up, and finds nothing in unrelated text", () => {
    const w = extractSyllabus("Course X\nQuiz 10%\nFinal 50%").warnings;
    expect(w.some((x) => x.message.includes("60%"))).toBe(true);
    const none = extractSyllabus("Hello there.\nNothing useful here.");
    expect(none.draft.assessments).toEqual([]);
    expect(none.warnings.some((x) => x.message.includes("No assessment weights"))).toBe(true);
  });
  it("never invents dates or years", () => {
    expect(findExplicitDate("Exam in December")).toBeNull();
    expect(findExplicitDate("Exam on 12 December")).toBeNull();
    expect(findExplicitDate("Exam on 12 December 2026")).toBe("2026-12-12");
    expect(findExplicitDate("31.02.2027")).toBeNull(); // impossible date
  });
  it("infers kinds in English and Russian", () => {
    expect(inferKind("Итоговый экзамен")).toBe("final");
    expect(inferKind("Quiz 2")).toBe("quiz");
    expect(inferKind("Lab work")).toBe("lab");
    expect(inferKind("Group stuff")).toBe("other");
  });
});

describe("evidence verification of AI output", () => {
  const text = "Grading:\nMidterm exam 30%\nFinal exam 40%";
  const draft = {
    ...emptyDraft(),
    assessments: [
      { title: "Midterm", kind: "midterm" as const, weightPercent: 30, dueDate: null, evidence: "Midterm exam 30%", verified: true },
      { title: "Final", kind: "final" as const, weightPercent: 50, dueDate: null, evidence: "Final exam 40%", verified: true }, // wrong weight
      { title: "Quiz", kind: "quiz" as const, weightPercent: 10, dueDate: null, evidence: "Weekly quizzes 10%", verified: true }, // not in document
    ],
  };
  it("flags items whose evidence is missing or contradicts the claimed weight", () => {
    const r = verifyDraftAgainstText(draft, text);
    expect(r.draft.assessments.map((a) => a.verified)).toEqual([true, false, false]);
    expect(r.warnings[0]!.message).toMatch(/2 suggested items/);
  });
  it("ignores case and whitespace differences", () => {
    const r = verifyDraftAgainstText({ ...draft, assessments: [draft.assessments[0]!] }, "MIDTERM   EXAM\n30%");
    expect(r.draft.assessments[0]!.verified).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});
