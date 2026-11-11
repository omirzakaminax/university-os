import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const E2E_APP_URL = process.env.E2E_DATABASE_URL ?? "postgres://app_server:app_server@localhost:54329/university_os_e2e";
const E2E_ADMIN_URL = process.env.E2E_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:54329/university_os_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    // Use the pre-installed Chromium (see README). CI with `npx playwright install` can drop executablePath.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] } } }],
  webServer: {
    // Requires `npm run build` first (npm run test:e2e does both).
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATABASE_URL: E2E_APP_URL, DATABASE_ADMIN_URL: E2E_ADMIN_URL, AUTH_PROVIDER: "local", NODE_ENV: "production" },
  },
});
