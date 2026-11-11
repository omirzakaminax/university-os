import { expect, test } from "@playwright/test";
import { PASSWORD, completeOnboarding, register, uniqueEmail } from "./helpers";

const email = uniqueEmail("theme");

test("light / dark / system themes persist per user with no flash", async ({ page, browser }) => {
  await register(page, "Theme Tester", email);
  await completeOnboarding(page);
  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Light theme" }).first().click();
  await expect.poll(theme).toBe("light");
  const lightBg = await bg();

  await page.getByRole("radio", { name: "Dark theme" }).first().click();
  await expect.poll(theme).toBe("dark");
  const darkBg = await bg();
  expect(darkBg).not.toBe(lightBg);

  // Server-rendered with the right theme before any JavaScript runs → no flash.
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  await noJs.addCookies((await page.context().cookies()).map((c) => ({ ...c })));
  const p2 = await noJs.newPage();
  await p2.goto("/login");
  expect(await p2.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark");
  await noJs.close();

  // Stored on the account: a brand-new browser (no cookie) signs in and adopts "dark".
  const fresh = await browser.newContext({ colorScheme: "light" });
  const p3 = await fresh.newPage();
  await p3.goto("/login");
  await p3.getByLabel("Email").fill(email);
  await p3.getByLabel("Password").fill(PASSWORD);
  await p3.getByRole("button", { name: "Sign in" }).click();
  await p3.waitForURL("**/dashboard");
  await expect.poll(() => p3.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark");
  await fresh.close();

  // System follows the OS preference.
  await page.getByRole("radio", { name: "System theme" }).first().click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect.poll(theme).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect.poll(theme).toBe("dark");
});

for (const t of ["light", "dark"] as const) {
  test(`mobile layout (${t}): no horizontal overflow, drawer navigation works`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, colorScheme: t });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard");
    for (const path of ["/dashboard", "/courses", "/tasks", "/grades", "/timetable", "/calendar", "/notes", "/notifications", "/settings"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
    }
    await page.goto("/dashboard");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Courses" }).click();
    await page.waitForURL("**/courses");
    await page.screenshot({ path: `test-results/mobile-${t}.png` });
    await ctx.close();
  });
}
