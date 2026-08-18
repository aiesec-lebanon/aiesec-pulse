import { defineConfig, devices } from "@playwright/test";

// Runs against a real `next build` output: the CSP nonce, dynamic rendering and
// the security headers all behave differently under the dev server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Two servers against one database produce failures that look like
// application bugs and are not.
const webServer = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: "npm run build && npm run start",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PULSE_E2E_MOCK_AUTH: "1",
        // next start forces NODE_ENV=production, so the deployment is declared
        // explicitly instead. Anything but "production" keeps mock sign-in available.
        PULSE_DEPLOYMENT: "test",
      },
    };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  // 4 parallel workers against one dev server and one real (remote) database
  // means every request queues behind real network latency and connection-pool
  // contention, not just the app's own work — the 5s default leaves too little
  // margin, most visibly on the assertion right after a publish action.
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer,
});
