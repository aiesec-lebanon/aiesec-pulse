import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      ADMIN_SESSION_SECRET: "test-admin-session-secret-123456789",
    },
  },
});
