/**
 * The credential admin the suite signs in as. Passed to the server under test
 * through `playwright.config.ts`, so the suite never depends on whatever
 * ADMIN_* a developer happens to have in their own `.env`.
 */
export const E2E_ADMIN = {
  email: "e2e-admin@example.invalid",
  password: "e2e-admin-password",
  sessionSecret: "e2e-admin-session-secret-at-least-32-chars",
} as const;
