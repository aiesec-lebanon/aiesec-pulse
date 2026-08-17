import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// The env values below are placeholders so modules that validate configuration
// at first use can be imported. None is a real secret.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // See the stub for why this is aliased rather than mocked per-file.
      "server-only": fileURLToPath(new URL("./__tests__/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts", "lib/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      SESSION_SECRET: "test-session-secret-that-is-at-least-32-chars",
      TOKEN_ENCRYPTION_KEY: "test-token-encryption-key-at-least-32-chars",
      DATABASE_URL: "postgresql://pulse:pulse@localhost:5432/pulse_test",
      AIESEC_OAUTH_AUTH_URL: "https://auth.example.invalid",
      AIESEC_OAUTH_CLIENT_ID: "test-client",
      AIESEC_OAUTH_CLIENT_SECRET: "test-secret",
      AIESEC_OAUTH_REDIRECT_URI: "http://localhost:3000/api/auth/callback",
      GIS_GRAPHQL_URL: "https://gis.example.invalid/graphql",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    },
  },
});
