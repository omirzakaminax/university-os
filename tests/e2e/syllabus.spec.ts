import { expect, test } from "@playwright/test";
import { PASSWORD, completeOnboarding, register, uniqueEmail } from "./helpers";

test.describe.configure({ mode: "serial" });

// Fictional syllabus text used only as test input — NOT real course requirements.
const SYLLABUS = `Data Structures
Course code: CS 201
Instructor: Dr. Alan Example
Credits: 6
Week 1: Arrays and lists
Week 2: Trees and hashing
Grading
Quizzes 20%
Midterm exam 30%
Final exam 50%
`;
const LECTURE = "Hashing basics. A hash function maps keys to buckets. Collisions are resolved by chaining or open addressing.";

const emailA = uniqueEmail("syl-a");
const emailB = uniqueEmail("syl-b");
let importId = "";
let courseId = "";
let documentId = "";

test("A: upload syllabus → review → approve → workspace → materials → grades → required final → persisted", async ({ page }) => {
  await register(page, "Syllabus Student", emailA);
  await completeOnboarding(page);

  // Nothing exists yet; AI is honestly reported as unavailable.
  await page.goto("/courses/import");
  await expect(page.getByText(/No AI provider is configured/)).toBeVisible();

  // A disguised executable is rejected by content, not extension.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Syllabus file").setInputFiles({ name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ\u0000\u0000 not a pdf") });
  await page.getByRole("button", { name: "Analyse syllabus" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(/Unsupported|not valid|Only/i);

  // Real syllabus
  await page.getByLabel("Syllabus file").setInputFiles({ name: "cs201-syllabus.txt", mimeType: "text/plain", buffer: Buffer.from(SYLLABUS) });
  await page.getByRole("button", { name: "Analyse syllabus" }).click();
  await page.waitForURL(/\/courses\/import\/[0-9a-f-]{36}$/);
  importId = page.url().split("/").pop()!;

  // Review: values come from the document, are editable, and carry their evidence.
  await expect(page.getByLabel("Course title")).toHaveValue("Data Structures");
  await expect(page.getByLabel("Code")).toHaveValue("CS 201");
  await expect(page.getByTestId("import-warnings")).toContainText("nothing is saved until you approve");
  await expect(page.getByLabel("Assessment title")).toHaveCount(3);
  await expect(page.getByText("Total 100%")).toBeVisible();
  await expect(page.getByText("Midterm exam 30%")).toBeVisible(); // evidence quote
  await expect(page.getByText("Extracted by rules — no AI used")).toBeVisible();

  // Not a course yet.
  await page.goto("/courses");
  await expect(page.getByText(/No courses in/)).toBeVisible();

  // Approve
  await page.goto(`/courses/import/${importId}`);
  await page.getByRole("button", { name: "Approve & create course" }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
  courseId = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Data Structures" })).toBeVisible();
  await expect(page.getByText("Week 1: Arrays and lists")).toBeVisible();
  await expect(page.getByText("Final exam", { exact: true })).toBeVisible();
  await expect(page.getByText("cs201 syllabus")).toBeVisible(); // syllabus attached to the workspace

  // Re-opening an approved import is read-only and cannot create a duplicate.
  await page.goto(`/courses/import/${importId}`);
  await expect(page.getByRole("button", { name: "Approve & create course" })).toHaveCount(0);

  // Materials: upload + cited search
  await page.goto(`/courses/${courseId}`);
  await page.waitForLoadState("networkidle"); // let React hydrate the file input's onChange handler
  await page.getByLabel("Upload materials").setInputFiles({ name: "lecture3.md", mimeType: "text/markdown", buffer: Buffer.from(LECTURE) });
  await expect(page.getByText("lecture3", { exact: true })).toBeVisible();
  await page.getByLabel("Search this course's materials").fill("chaining");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByTestId("material-hits")).toContainText("lecture3");
  await expect(page.getByTestId("material-hits").locator("mark")).toHaveText("chaining");

  // Grades: quizzes 80, midterm 70 → earned 16 + 21 = 37 over 50 % graded = 74 %
  await page.getByLabel("Score for Quizzes").fill("80");
  await page.getByLabel("Score for Quizzes").blur();
  await expect(page.getByTestId("grade-percent")).toHaveText("80.00%");
  await page.getByLabel("Score for Midterm exam").fill("70");
  await page.getByLabel("Score for Midterm exam").blur();
  await expect(page.getByTestId("grade-percent")).toHaveText("74.00%");

  // Required final for a target of 85 %: (85 − 37) / 50 = 96 %
  await page.getByLabel("…or a custom percent").fill("85");
  await expect(page.getByTestId("required-result")).toContainText("96.00%");
  // Unreachable target is explained
  await page.getByLabel("…or a custom percent").fill("95");
  await expect(page.getByTestId("required-result")).toContainText("Not reachable");

  // Persistence across reload
  await page.reload();
  await expect(page.getByTestId("grade-percent")).toHaveText("74.00%");
  await page.getByLabel("Search this course's materials").fill("hash");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByTestId("material-hits")).toContainText("lecture3");

  // Document id for the isolation test
  const href = await page.getByRole("link", { name: "Download lecture3" }).getAttribute("href");
  documentId = href!.split("/")[4]!;

  // Requirements: configured by the student, evaluated against grades
  await page.goto("/grades");
  await page.getByLabel("Name").fill("Avoid retake (my handbook)");
  await page.getByLabel("Minimum percent").fill("50");
  await page.getByRole("button", { name: "Add requirement" }).click();
  const ev = page.getByTestId("requirement-evaluations");
  await expect(ev).toContainText("Avoid retake (my handbook)");
  await expect(ev).toContainText("Data Structures");
  await expect(ev).toContainText(/needs an average of|already secured/i);
});

test("course lifecycle: archiving removes it from active views but keeps the data", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(`/courses/${courseId}`);
  await page.getByLabel("Course status").selectOption("archived");
  await expect(page.getByText("Course status updated")).toBeVisible();
  await page.goto("/courses");
  await expect(page.getByText("Data Structures")).toHaveCount(0);
  await page.goto(`/courses/${courseId}`);
  await expect(page.getByTestId("grade-percent")).toHaveText("74.00%"); // still there
  await page.getByLabel("Course status").selectOption("active");
  await expect(page.getByText("Course status updated").first()).toBeVisible();
});

test("B: independent workspace — cannot see or fetch A's syllabus drafts, courses, documents or search hits", async ({ page }) => {
  await register(page, "Other Student", emailB);
  await completeOnboarding(page);
  await page.goto("/courses/import");
  await expect(page.getByText("Drafts waiting for review")).toHaveCount(0);

  await page.goto(`/courses/import/${importId}`);
  await expect(page.getByText("We couldn’t find that page")).toBeVisible();
  await page.goto(`/courses/${courseId}`);
  await expect(page.getByText("We couldn’t find that page")).toBeVisible();

  const api = page.context().request;
  expect((await api.get(`/api/v1/documents/${documentId}/file`)).status()).toBe(404);
  expect(((await (await api.get("/api/v1/documents")).json()).data as unknown[]).length).toBe(0);
  const origin = "http://localhost:3100";
  const up = await api.post("/api/v1/documents", { multipart: { file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }, kind: "other", courseId }, headers: { origin } });
  expect(up.status()).toBe(400); // A's course id is not a valid reference for B (ownership foreign key)
  const csrf = await api.post("/api/v1/documents", { multipart: { file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("hello") } }, headers: { origin: "https://evil.example" } });
  expect(csrf.status()).toBe(403);

  // B repeats the whole workflow independently with the same syllabus text.
  await page.goto("/courses/import");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Syllabus file").setInputFiles({ name: "cs201-syllabus.txt", mimeType: "text/plain", buffer: Buffer.from(SYLLABUS) });
  await page.getByRole("button", { name: "Analyse syllabus" }).click();
  await page.waitForURL(/\/courses\/import\/[0-9a-f-]{36}$/);
  expect(page.url()).not.toContain(importId);
  await page.getByRole("button", { name: "Approve & create course" }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
  expect(page.url()).not.toContain(courseId);
  await expect(page.getByTestId("grade-percent")).toHaveText("—"); // no grades leaked from A
  await page.getByLabel("Search this course's materials").count();
});
