import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

import { E2E_ADMIN } from "./e2e/admin-credentials";

// Runs against a real `next build`: CSP nonce, dynamic rendering and
// security headers differ under the dev server.
//
// PULSE_E2E_PORT avoids colliding with a stray `next dev` (real `.env`),
// which would send sign-in to real auth.aiesec.org and fail every spec.
const APP_PORT = process.env.PULSE_E2E_PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${APP_PORT}`;

// Stub answering as auth.aiesec.org and gis-api.aiesec.org; sign-in is
// otherwise the real production path (see e2e/gis-stub/server.ts).
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
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        // Cold `next build` eats most of this budget without a warm .next
        // cache; 180s wasn't enough to reach a first request.
        timeout: 300_000,
        env: {
          // Points the two AIESEC endpoints at the stub; app/lib code never
          // knows the difference — a bypass wired into app code would test
          // the bypass, not the app.
          AIESEC_OAUTH_AUTH_URL: STUB_ORIGIN,
          GIS_GRAPHQL_URL: `${STUB_ORIGIN}/graphql`,
          // Opens /api/test/publish-scheduled to run the cron logic
          // synchronously; refused in production (see lib/test-hooks.ts).
          PULSE_E2E_TEST_HOOKS: "1",
          // next start forces NODE_ENV=production, so declare the deployment
          // explicitly — anything but "production" keeps the hook available.
          PULSE_DEPLOYMENT: "test",
          // Inlined into the client bundle at build time; a stale value here
          // sends the callback redirect at whatever else is on that port.
          NEXT_PUBLIC_BASE_URL: baseURL,
          AIESEC_OAUTH_REDIRECT_URI: `${baseURL}/api/auth/callback`,
          PORT: APP_PORT,
          // One long-lived server serves every worker at once; the
          // 10-connection serverless default (lib/db.ts) becomes a queue.
          DATABASE_POOL_MAX: "25",
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

  // Real database writes need cleanup: setup clears a prior interrupted
  // run's leftovers, teardown clears this run's (see e2e/cleanup.ts).
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  // 4 workers against one remote database queue behind real network/pool
  // contention; the 5s default is too tight, especially after a publish.
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer,
});
