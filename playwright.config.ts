import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

import { E2E_ADMIN } from "./e2e/admin-credentials";

// Runs against a real `next build` output: the CSP nonce, dynamic rendering and
// the security headers all behave differently under the dev server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// The stub that answers as auth.aiesec.org and gis-api.aiesec.org. Sign-in is
// otherwise the production path end to end — see e2e/gis-stub/server.ts for why
// this is a server rather than Playwright route interception.
const STUB_PORT = process.env.PULSE_GIS_STUB_PORT ?? "3099";
const STUB_ORIGIN = `http://127.0.0.1:${STUB_PORT}`;

// Two servers against one database produce failures that look like
// application bugs and are not.
const webServer: PlaywrightTestConfig["webServer"] = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : [
      {
        command: "npx tsx e2e/gis-stub/server.ts",
        url: `${STUB_ORIGIN}/__health`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: { PULSE_GIS_STUB_PORT: STUB_PORT },
      },
      {
        command: "npm run build && npm run start",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !process.env.CI,
        // A cold `next build` is the whole of this budget and then some on a
        // machine without a warm .next cache; 180s was not enough to get to a
        // first request.
        timeout: 300_000,
        env: {
          // The whole of the test-only configuration: point the two AIESEC
          // endpoints at the stub. Nothing in `app/` or `lib/` knows the
          // difference, which is the property that makes this suite worth
          // having — a bypass wired into application code tests the bypass.
          AIESEC_OAUTH_AUTH_URL: STUB_ORIGIN,
          GIS_GRAPHQL_URL: `${STUB_ORIGIN}/graphql`,
          // Opens /api/test/publish-scheduled, which runs the scheduling cron's
          // own logic synchronously. Refused outright on a production
          // deployment — see lib/test-hooks.ts.
          PULSE_E2E_TEST_HOOKS: "1",
          // next start forces NODE_ENV=production, so the deployment is declared
          // explicitly instead. Anything but "production" keeps the hook available.
          PULSE_DEPLOYMENT: "test",
          // Inlined into the client bundle at build time, so it has to be right
          // here rather than only at run time: a stale value sends the callback's
          // redirects at whatever else is listening on that port.
          NEXT_PUBLIC_BASE_URL: baseURL,
          AIESEC_OAUTH_REDIRECT_URI: `${baseURL}/api/auth/callback`,
          // Platform administration is a credential login, so the suite needs
          // one it owns rather than whatever a developer's .env carries.
          ADMIN_EMAIL: E2E_ADMIN.email,
          ADMIN_PASSWORD: E2E_ADMIN.password,
          ADMIN_SESSION_SECRET: E2E_ADMIN.sessionSecret,
        },
      },
    ];

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
