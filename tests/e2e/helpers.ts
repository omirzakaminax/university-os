import { expect, type Page } from "@playwright/test";

let n = 0;
export const uniqueEmail = (label: string) => `${label}-${Date.now()}-${n++}@example.test`;
export const PASSWORD = "correct horse battery";

export async function register(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
}

/** Walk the onboarding wizard using the AITU starting point (all values remain editable defaults). */
export async function onboardWithAitu(page: Page) {
  await page.getByRole("button", { name: /Astana IT University/ }).click(); // only visible on step 2
}

export async function completeOnboarding(page: Page) {
  await expect(page.getByRole("heading", { name: /set up your workspace/i })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click(); // About you → University
  await page.getByRole("button", { name: /Astana IT University/ }).click();
  await expect(page.getByLabel("University", { exact: true })).toHaveValue("Astana IT University");
  await page.getByRole("button", { name: "Continue" }).click(); // → Grading
  await expect(page.getByLabel("Letter").first()).toHaveValue("A");
  await page.getByRole("button", { name: "Continue" }).click(); // → Calendar
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await page.waitForURL("**/dashboard");
}

export async function createCourseWithGrades(page: Page, title: string) {
  await page.goto("/courses?new=1");
  await page.getByLabel("Course title").fill(title);
  await page.getByLabel("Credits").fill("6");
  await page.getByRole("button", { name: "Create course" }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
  const courseId = page.url().split("/").pop()!;

  await page.getByRole("button", { name: "Add assessment" }).click();
  await page.getByLabel("Title").fill("Labs");
  await page.getByLabel("Weight (% of course grade)").fill("40");
  await page.getByLabel("Your score").fill("90");
  await page.getByRole("button", { name: "Add assessment" }).click();
  await expect(page.getByText("Labs", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await page.getByLabel("Title").fill("Final exam");
  await page.getByLabel("Type", { exact: true }).selectOption("final");
  await page.getByLabel("Weight (% of course grade)").fill("60");
  await page.getByRole("button", { name: "Add assessment" }).click();
  await expect(page.getByText("Final exam", { exact: true })).toBeVisible();
  return courseId;
}
