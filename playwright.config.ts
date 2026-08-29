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
        timeout: 300_000,
        env: {
          AIESEC_OAUTH_AUTH_URL: STUB_ORIGIN,
          GIS_GRAPHQL_URL: `${STUB_ORIGIN}/graphql`,
          PULSE_E2E_TEST_HOOKS: "1",
          PULSE_DEPLOYMENT: "test",
          NEXT_PUBLIC_BASE_URL: baseURL,
          AIESEC_OAUTH_REDIRECT_URI: `${baseURL}/api/auth/callback`,
          PORT: APP_PORT,
          DATABASE_POOL_MAX: "25",
          ADMIN_EMAIL: E2E_ADMIN.email,
          ADMIN_PASSWORD: E2E_ADMIN.password,
          ADMIN_SESSION_SECRET: E2E_ADMIN.sessionSecret,
          CRON_SECRET: "e2e-cron-secret-that-is-at-least-32-chars",
        },
      },
    ];

export default defineConfig({
  testDir: "./e2e",

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer,
});
