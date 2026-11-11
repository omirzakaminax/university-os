import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeAll, createOnboardedUser, withUser } from "./helpers";
import { setProviderForTests } from "@/server/ai";
import type { LlmProvider } from "@/server/ai/provider";
import { deleteDocument, getDocumentFile, ingestDocument, listDocuments, searchMaterials } from "@/server/services/documents";
import { analyzeSyllabus, approveImport, discardImport, getImport, listImports } from "@/server/services/syllabus";
import { listAssessments, listCourses, listTopics } from "@/server/services/courses";
import { updatePreferences } from "@/server/services/profile";
import { usageToday } from "@/server/ai";

afterAll(async () => {
  setProviderForTests(undefined);
  await closeAll();
});
beforeEach(() => setProviderForTests(null));

// Fictional text — test input only.
const SYLLABUS = `Data Structures
Course code: CS 201
Instructor: Dr. Alan Example
Credits: 6
Week 1: Arrays and lists
Week 2: Trees
Grading
Quizzes 20%
Midterm exam 30%
Final exam 50%
Midterm exam on 2027-03-15
`;
const bytes = (s: string) => new TextEncoder().encode(s);
const code = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);

/** A scripted provider that records calls. */
function stubProvider(reply: object | string): LlmProvider & { calls: number } {
  const p = {
    id: "stub",
    calls: 0,
    async generateJson() {
      p.calls++;
      return { text: typeof reply === "string" ? reply : JSON.stringify(reply), model: "stub-model", inputTokens: 100, outputTokens: 50 };
    },
  };
  return p;
}

describe("document ingestion", () => {
  it("stores, extracts, chunks and indexes a text document; identical uploads are deduplicated", async () => {
    const u = await createOnboardedUser("doc");
    await withUser(u.userId, async (tx) => {
      const a = await ingestDocument(tx, { filename: "notes.txt", bytes: bytes("Binary search runs in logarithmic time.\nHash tables give constant lookups."), kind: "lecture" });
      expect(a.duplicate).toBe(false);
      expect(a.document).toMatchObject({ status: "ready", kind: "lecture", title: "notes", mimeType: "text/plain" });
      const b = await ingestDocument(tx, { filename: "renamed.txt", bytes: bytes("Binary search runs in logarithmic time.\nHash tables give constant lookups."), kind: "lecture" });
      expect(b.duplicate).toBe(true);
      expect(b.document.id).toBe(a.document.id);
      expect((await listDocuments(tx)).length).toBe(1);
      const file = await getDocumentFile(tx, a.document.id);
      expect(file.data.toString()).toContain("logarithmic");
    });
  });

  it("rejects disguised and unsupported files without leaving partial rows", async () => {
    const u = await createOnboardedUser("docbad");
    await withUser(u.userId, async (tx) => {
      await expect(ingestDocument(tx, { filename: "evil.pdf", bytes: bytes("MZ\u0000\u0000 not a pdf"), kind: "other" })).rejects.toMatchObject({ code: "validation" });
      await expect(ingestDocument(tx, { filename: "x.exe", bytes: bytes("hello"), kind: "other" })).rejects.toMatchObject({ code: "validation" });
      expect(await listDocuments(tx)).toHaveLength(0);
    });
  });

  it("marks files without extractable text honestly (images → needs_ocr) and corrupt PDFs as failed", async () => {
    const u = await createOnboardedUser("docimg");
    await withUser(u.userId, async (tx) => {
      const img = await ingestDocument(tx, { filename: "scan.png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), kind: "other" });
      expect(img.document.status).toBe("needs_ocr");
      expect(img.document.statusDetail).toMatch(/OCR/);
      const bad = await ingestDocument(tx, { filename: "broken.pdf", bytes: bytes("%PDF-1.4 this is not really a pdf"), kind: "other" });
      expect(bad.document.status).toBe("failed");
    });
  });

  it("searches materials with citations (document title + page) and soft-deleted documents disappear", async () => {
    const u = await createOnboardedUser("docsearch");
    await withUser(u.userId, async (tx) => {
      const d = await ingestDocument(tx, { filename: "lecture3.md", bytes: bytes("# Hashing\nA hash function maps keys to buckets. Collisions are resolved by chaining."), kind: "lecture" });
      await ingestDocument(tx, { filename: "other.txt", bytes: bytes("Completely unrelated text about cooking pasta."), kind: "other" });
      const hits = await searchMaterials(tx, "collisions chaining");
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ documentTitle: "lecture3", documentId: d.document.id, page: null });
      expect(hits[0]!.snippet).toContain("«");
      expect(await searchMaterials(tx, "quantum")).toEqual([]);
      expect((await searchMaterials(tx, "100% _ \\"))).toEqual([]); // special characters are harmless
      await deleteDocument(tx, d.document.id);
      expect(await searchMaterials(tx, "collisions")).toEqual([]);
      await expect(getDocumentFile(tx, d.document.id)).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("falls back to substring search for scripts without word boundaries (Chinese)", async () => {
    const u = await createOnboardedUser("docjp");
    await withUser(u.userId, async (tx) => {
      await ingestDocument(tx, { filename: "hsk.txt", bytes: bytes("你好，世界。我喜欢学习汉语。"), kind: "other" });
      expect((await searchMaterials(tx, "学习汉语")).length).toBe(1);
    });
  });

  it("is isolated per user (another user's search and fetch find nothing)", async () => {
    const a = await createOnboardedUser("isoA");
    const b = await createOnboardedUser("isoB");
    const docId = await withUser(a.userId, async (tx) => (await ingestDocument(tx, { filename: "secret.txt", bytes: bytes("Confidential tuition waiver details."), kind: "regulation" })).document.id);
    await withUser(b.userId, async (tx) => {
      expect(await searchMaterials(tx, "tuition")).toEqual([]);
      await expect(getDocumentFile(tx, docId)).rejects.toMatchObject({ code: "not_found" });
      // Same bytes uploaded by B are B's own document, not a dedupe hit on A's.
      const mine = await ingestDocument(tx, { filename: "secret.txt", bytes: bytes("Confidential tuition waiver details."), kind: "regulation" });
      expect(mine.duplicate).toBe(false);
      expect(mine.document.id).not.toBe(docId);
    });
  });
});

describe("syllabus-first workflow", () => {
  it("rules analysis → draft (no course yet) → approve creates course, topics, assessments atomically", async () => {
    const u = await createOnboardedUser("syl");
    await withUser(u.userId, async (tx) => {
      const { document } = await ingestDocument(tx, { filename: "cs201.txt", bytes: bytes(SYLLABUS), kind: "syllabus" });
      const imp = await analyzeSyllabus(tx, { documentId: document.id, periodId: u.periodId, useAi: false });
      expect(imp).toMatchObject({ status: "draft", method: "rules" });
      expect(imp.extracted.title).toBe("Data Structures");
      expect(imp.extracted.assessments.map((a) => [a.title, a.weightPercent])).toEqual([["Quizzes", 20], ["Midterm exam", 30], ["Final exam", 50]]);
      // Staging only: no academic records exist before approval.
      expect(await listCourses(tx)).toHaveLength(0);
      // Re-analysing is a cache hit, not a second draft.
      expect((await analyzeSyllabus(tx, { documentId: document.id, useAi: false })).id).toBe(imp.id);
      expect(await listImports(tx)).toHaveLength(1);

      const { courseId } = await approveImport(tx, imp.id, {
        periodId: u.periodId,
        course: { title: "Data Structures", code: "CS 201", credits: 6, instructorName: "Dr. Alan Example" },
        topics: ["Arrays and lists", "Trees"],
        assessments: [
          { title: "Quizzes", kind: "quiz", weightPercent: 20 },
          { title: "Midterm exam", kind: "midterm", weightPercent: 30, dueAt: "2027-03-15T05:00:00Z" },
          { title: "Final exam", kind: "final", weightPercent: 50 },
        ],
        acceptWeightMismatch: false,
      });
      const [course] = await listCourses(tx);
      expect(course).toMatchObject({ id: courseId, title: "Data Structures", credits: 6, instructorName: "Dr. Alan Example" });
      expect((await listTopics(tx, courseId)).map((t) => t.title)).toEqual(["Arrays and lists", "Trees"]);
      const as = await listAssessments(tx, courseId);
      expect(as.map((a) => a.origin)).toEqual(["syllabus", "syllabus", "syllabus"]);
      expect((await getImport(tx, imp.id)).status).toBe("approved");
      // The syllabus document is now attached to the new course workspace.
      expect((await listDocuments(tx, { courseId })).map((d) => d.kind)).toEqual(["syllabus"]);
      // Approving twice is refused (no duplicate courses).
      await expect(approveImport(tx, imp.id, { periodId: u.periodId, course: { title: "Dup" }, topics: [], assessments: [], acceptWeightMismatch: false })).rejects.toMatchObject({ code: "conflict" });
      expect(await listCourses(tx)).toHaveLength(1);
    });
  });

  it("refuses weights that do not total 100% unless the student explicitly accepts, and never half-saves", async () => {
    const u = await createOnboardedUser("sylw");
    await withUser(u.userId, async (tx) => {
      const { document } = await ingestDocument(tx, { filename: "w.txt", bytes: bytes("Course\nQuiz 10%\nFinal 50%"), kind: "syllabus" });
      const imp = await analyzeSyllabus(tx, { documentId: document.id, useAi: false });
      const base = { periodId: u.periodId, course: { title: "Course" }, topics: [], assessments: [{ title: "Quiz", kind: "quiz" as const, weightPercent: 10 }, { title: "Final", kind: "final" as const, weightPercent: 50 }] };
      await expect(approveImport(tx, imp.id, { ...base, acceptWeightMismatch: false })).rejects.toMatchObject({ code: "validation", message: expect.stringContaining("60%") });
      expect(await listCourses(tx)).toHaveLength(0);
      await approveImport(tx, imp.id, { ...base, acceptWeightMismatch: true });
      expect(await listCourses(tx)).toHaveLength(1);
    });
  });

  it("drafts can be discarded; unreadable documents cannot be analysed", async () => {
    const u = await createOnboardedUser("syld");
    await withUser(u.userId, async (tx) => {
      const { document } = await ingestDocument(tx, { filename: "s.txt", bytes: bytes("Algo\nFinal 100%"), kind: "syllabus" });
      const imp = await analyzeSyllabus(tx, { documentId: document.id, useAi: false });
      await discardImport(tx, imp.id);
      expect((await getImport(tx, imp.id)).status).toBe("discarded");
      await expect(approveImport(tx, imp.id, { periodId: u.periodId, course: { title: "x" }, topics: [], assessments: [], acceptWeightMismatch: false })).rejects.toMatchObject({ code: "conflict" });
      const img = await ingestDocument(tx, { filename: "scan.jpg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 1, 2]), kind: "syllabus" });
      await expect(analyzeSyllabus(tx, { documentId: img.document.id, useAi: false })).rejects.toMatchObject({ code: "validation" });
    });
  });

  it("another user cannot read, analyse or approve my draft", async () => {
    const a = await createOnboardedUser("syl-a");
    const b = await createOnboardedUser("syl-b");
    const imp = await withUser(a.userId, async (tx) => {
      const { document } = await ingestDocument(tx, { filename: "a.txt", bytes: bytes("Private Course\nFinal 100%"), kind: "syllabus" });
      return analyzeSyllabus(tx, { documentId: document.id, useAi: false });
    });
    await withUser(b.userId, async (tx) => {
      await expect(getImport(tx, imp.id)).rejects.toMatchObject({ code: "not_found" });
      await expect(analyzeSyllabus(tx, { documentId: imp.documentId, useAi: false })).rejects.toMatchObject({ code: "not_found" });
      expect(await code(approveImport(tx, imp.id, { periodId: b.periodId, course: { title: "stolen" }, topics: [], assessments: [], acceptWeightMismatch: false }))).toBe("not_found");
      expect(await listImports(tx)).toEqual([]);
    });
  });
});

describe("AI provider layer (stub provider — not a live API)", () => {
  const AI_REPLY = {
    title: "Data Structures", code: "CS 201", description: null, credits: 6, instructor: { name: "Dr. Alan Example", email: null },
    objectives: [], topics: [{ week: 1, title: "Arrays and lists" }], readings: [],
    assessments: [
      { title: "Quizzes", kind: "quiz", weightPercent: 20, dueDate: null, evidence: "Quizzes 20%" },
      { title: "Final exam", kind: "final", weightPercent: 50, dueDate: null, evidence: "Final exam 50%" },
      { title: "Lab", kind: "lab", weightPercent: 30, dueDate: null, evidence: "Weekly labs 30%" }, // hallucinated: not in the document
    ],
    gradingNotes: [], importantDates: [],
  };

  it("does nothing without a provider and never calls AI without consent", async () => {
    const u = await createOnboardedUser("ai0");
    await withUser(u.userId, async (tx) => {
      const { document } = await ingestDocument(tx, { filename: "s.txt", bytes: bytes(SYLLABUS), kind: "syllabus" });
      await expect(analyzeSyllabus(tx, { documentId: document.id, useAi: true })).rejects.toMatchObject({ code: "unavailable" }); // no provider
      const p = stubProvider(AI_REPLY);
      setProviderForTests(p);
      await expect(analyzeSyllabus(tx, { documentId: document.id, useAi: true })).rejects.toMatchObject({ code: "forbidden" }); // no consent
      expect(p.calls).toBe(0);
    });
  });

  it("verifies AI output against the document, flags hallucinations, records usage, and caches", async () => {
    const u = await createOnboardedUser("ai1");
    const p = stubProvider(AI_REPLY);
    setProviderForTests(p);
    await withUser(u.userId, async (tx) => {
      await tx`update user_preferences set ai_consent_at = now()`;
      const { document } = await ingestDocument(tx, { filename: "s.txt", bytes: bytes(SYLLABUS), kind: "syllabus" });
      const imp = await analyzeSyllabus(tx, { documentId: document.id, useAi: true });
      expect(imp).toMatchObject({ method: "ai", provider: "stub" });
      expect(imp.extracted.assessments.map((a) => [a.title, a.verified])).toEqual([["Quizzes", true], ["Final exam", true], ["Lab", false]]);
      expect(imp.warnings.some((w) => w.message.includes("could not be confirmed"))).toBe(true);
      expect(p.calls).toBe(1);
      await analyzeSyllabus(tx, { documentId: document.id, useAi: true });
      expect(p.calls).toBe(1); // cached draft: no second model call
      const usage = await usageToday(tx);
      expect(usage).toMatchObject({ requests: 1, inputTokens: 100, outputTokens: 50 });
      const [row] = await tx`select est_cost_usd, task from ai_usage`;
      expect(row).toMatchObject({ estCostUsd: null, task: "syllabus.extract" }); // cost is never invented
    });
  });

  it("falls back to the rules result when the model returns garbage", async () => {
    const u = await createOnboardedUser("ai2");
    setProviderForTests(stubProvider("this is not json"));
    await withUser(u.userId, async (tx) => {
      await tx`update user_preferences set ai_consent_at = now()`;
      const { document } = await ingestDocument(tx, { filename: "s.txt", bytes: bytes(SYLLABUS), kind: "syllabus" });
      const imp = await analyzeSyllabus(tx, { documentId: document.id, useAi: true });
      expect(imp.method).toBe("rules");
      expect(imp.warnings[0]!.message).toMatch(/AI analysis failed/);
      expect(imp.extracted.assessments).toHaveLength(3);
    });
  });

  it("enforces the per-user daily request limit", async () => {
    const u = await createOnboardedUser("ai3");
    setProviderForTests(stubProvider(AI_REPLY));
    await withUser(u.userId, async (tx) => {
      await tx`update user_preferences set ai_consent_at = now()`;
      for (let i = 0; i < 30; i++) await tx`insert into ai_usage (provider, model, task) values ('stub', 'm', 'seed')`;
      const { document } = await ingestDocument(tx, { filename: "s.txt", bytes: bytes(SYLLABUS), kind: "syllabus" });
      await expect(analyzeSyllabus(tx, { documentId: document.id, useAi: true })).rejects.toMatchObject({ code: "rate_limited" });
    });
  });

  it("the usage ledger is append-only and private", async () => {
    const a = await createOnboardedUser("ai4a");
    const b = await createOnboardedUser("ai4b");
    await withUser(a.userId, async (tx) => {
      await tx`insert into ai_usage (provider, model, task) values ('stub', 'm', 't')`;
      expect(await code(tx.savepoint((sp) => sp`update ai_usage set task = 'x'`))).toBe("42501");
      expect(await code(tx.savepoint((sp) => sp`delete from ai_usage`))).toBe("42501");
    });
    await withUser(b.userId, async (tx) => expect(await tx`select 1 from ai_usage`).toHaveLength(0));
    void updatePreferences;
  });
});
