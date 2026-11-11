import { expect, test } from "@playwright/test";
import { PASSWORD, completeOnboarding, createCourseWithGrades, register, uniqueEmail } from "./helpers";

test.describe.configure({ mode: "serial" });

const emailA = uniqueEmail("alice");
const emailB = uniqueEmail("bob");
let courseIdA = "";

test("User A: register → onboarding → course → grades → required final score → tasks, persisted across reload", async ({ page }) => {
  await register(page, "Alice Student", emailA);
  await completeOnboarding(page);
  await expect(page.getByRole("heading", { name: /Alice/ })).toBeVisible();
  // A brand-new workspace has no invented data.
  await expect(page.getByText("No classes today")).toBeVisible();
  await expect(page.getByText("No grades yet")).toBeVisible();

  courseIdA = await createCourseWithGrades(page, "Calculus II");

  // 40 % weight at 90 % → 90 % so far, letter A- on the Kazakhstan scale (90–94.99).
  await expect(page.getByTestId("grade-percent")).toHaveText("90.00%");
  await expect(page.getByTestId("grade-letter")).toHaveText("A-");

  // Required final: target A (≥95 %) → (95 − 36) / 60 = 98.33 %
  await page.getByLabel("Target letter").selectOption("A");
  await expect(page.getByTestId("required-result")).toContainText("98.33%");

  // Unreachable target is explained, not hidden: a custom 100 % target needs (100−36)/60 = 106.67 %
  await page.getByLabel("…or a custom percent").fill("100");
  await expect(page.getByTestId("required-result")).toContainText("Not reachable");

  // What-if: 80 on the final → 36 + 48 = 84 % → B
  await page.getByLabel(/Final exam \(out of 100\)/).fill("80");
  await expect(page.getByTestId("whatif-result")).toContainText("84.00%");

  // Record the real final score and the grade becomes final.
  await page.getByLabel("Score for Final exam").fill("80");
  await page.getByLabel("Score for Final exam").blur();
  await expect(page.getByTestId("grade-percent")).toHaveText("84.00%");
  await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();

  // Quick capture via keyboard shortcut
  await page.goto("/dashboard");
  await page.keyboard.press("c");
  await page.getByLabel("What needs doing?").fill("Finish problem set 4");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Finish problem set 4").first()).toBeVisible();

  // Persistence: reload everything.
  await page.reload();
  await expect(page.getByText("Finish problem set 4").first()).toBeVisible();
  await page.goto("/grades");
  await expect(page.getByText("Calculus II").first()).toBeVisible();
  await expect(page.getByText("3.00").first()).toBeVisible(); // 84 % → B → 3.00 grade points, GPA 3.00
  await page.goto(`/courses/${courseIdA}`);
  await expect(page.getByTestId("grade-percent")).toHaveText("84.00%");
});

test("Command palette searches the user's own data", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search courses/).fill("calc");
  await expect(page.getByRole("option", { name: /Calculus II/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/courses\//);
});

test("User B gets a separate empty workspace and cannot reach A's data (UI and direct API)", async ({ page, request, browser }) => {
  await register(page, "Bob Student", emailB);
  await completeOnboarding(page);
  await page.goto("/courses");
  await expect(page.getByText(/No courses in/)).toBeVisible();
  await page.goto("/tasks");
  await expect(page.getByText("No open tasks")).toBeVisible();
  await expect(page.getByText("Finish problem set 4")).toHaveCount(0);

  // A's course page is a 404 for B.
  // (Next streams the not-found UI behind loading.tsx, so assert on content rather than the HTTP status.)
  await page.goto(`/courses/${courseIdA}`);
  await expect(page.getByText("We couldn’t find that page")).toBeVisible();
  await expect(page.getByText("Calculus II")).toHaveCount(0);
  await expect(page.getByTestId("grade-percent")).toHaveCount(0);

  // Direct API calls with B's session cookie.
  const api = page.context().request;
  const origin = "http://localhost:3100";
  const get = await api.get(`/api/v1/courses/${courseIdA}`);
  expect(get.status()).toBe(404);
  const list = await api.get("/api/v1/courses");
  expect((await list.json()).data).toEqual([]);
  const patch = await api.patch(`/api/v1/courses/${courseIdA}`, { data: { title: "pwned" }, headers: { origin } });
  expect(patch.status()).toBe(404);
  const del = await api.delete(`/api/v1/courses/${courseIdA}`, { headers: { origin } });
  expect(del.status()).toBe(404);
  const addAssessment = await api.post(`/api/v1/courses/${courseIdA}/assessments`, { data: { title: "x", weightPercent: 10 }, headers: { origin } });
  expect(addAssessment.status()).toBe(404);
  const search = await api.get("/api/v1/search?q=Calculus");
  expect((await search.json()).data).toEqual([]);
  const exp = await api.get("/api/v1/me/export");
  expect(await exp.text()).not.toContain("Calculus II");

  // Unauthenticated and cross-origin requests are rejected.
  const anon = await request.get("/api/v1/courses");
  expect(anon.status()).toBe(401);
  const csrf = await api.post("/api/v1/tasks", { data: { title: "csrf" }, headers: { origin: "https://evil.example" } });
  expect(csrf.status()).toBe(403);
  const noOrigin = await api.post("/api/v1/tasks", { data: { title: "csrf" } });
  expect(noOrigin.status()).toBe(403);
  const invalid = await api.post("/api/v1/tasks", { data: { title: "" }, headers: { origin } });
  expect(invalid.status()).toBe(400);

  // A garbage bearer token is not a session.
  const bad = await request.get("/api/v1/courses", { headers: { authorization: "Bearer nope" } });
  expect(bad.status()).toBe(401);

  // A fresh context for A still sees A's data (B did not damage it).
  const ctxA = await browser.newContext();
  const pa = await ctxA.newPage();
  await pa.goto("/login");
  await pa.getByLabel("Email").fill(emailA);
  await pa.getByLabel("Password").fill(PASSWORD);
  await pa.getByRole("button", { name: "Sign in" }).click();
  await pa.waitForURL("**/dashboard");
  await pa.goto(`/courses/${courseIdA}`);
  await expect(pa.getByRole("heading", { name: "Calculus II" })).toBeVisible();
  await ctxA.close();
});

test("Wrong password is rejected with a generic message; logout ends the session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill("definitely wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Incorrect email or password");

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.waitForURL("**/login");
  await page.goto("/dashboard");
  await page.waitForURL("**/login");
});
