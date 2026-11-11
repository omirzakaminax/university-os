import { test } from "@playwright/test";
import { completeOnboarding, createCourseWithGrades, register, uniqueEmail } from "./helpers";

// Produces review screenshots in test-results/ (not assertions).
test("capture light and dark screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await register(page, "Aigerim Student", uniqueEmail("shots"));
  await completeOnboarding(page);
  const courseId = await createCourseWithGrades(page, "Calculus II");
  await page.goto("/timetable");
  await page.keyboard.press("c");
  await page.getByLabel("What needs doing?").fill("Finish problem set 4");
  await page.getByLabel("Due (optional)").fill("2026-11-11T23:59");
  await page.getByRole("button", { name: "Add task" }).click();
  for (const theme of ["light", "dark"] as const) {
    await page.goto("/settings");
    await page.getByRole("radio", { name: `${theme[0]!.toUpperCase()}${theme.slice(1)} theme` }).first().click();
    for (const [name, path] of [["dashboard", "/dashboard"], ["course", `/courses/${courseId}`], ["tasks", "/tasks"]] as const) {
      await page.goto(path);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `test-results/shot-${name}-${theme}.png` });
    }
  }
});
