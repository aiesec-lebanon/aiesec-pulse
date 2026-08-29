/**
 * The admin credential the suite signs in as, passed to the server under
 * test via playwright.config.ts — independent of a developer's own .env.
 */
export const E2E_ADMIN = {
  email: "e2e-admin@example.invalid",
  password: "e2e-admin-password",
  sessionSecret: "e2e-admin-session-secret-at-least-32-chars",
} as const;
