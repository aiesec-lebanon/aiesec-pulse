import { describe, expect, it } from "vitest";

import { __testing } from "@/lib/env";

const { serverSchema } = __testing;

// A .env file writes an unset variable as `FOO=`, which loads as an empty
// string — present, and therefore validated. These pin blankAsAbsent.

const VALID = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/pulse",
  AIESEC_OAUTH_AUTH_URL: "https://auth.aiesec.org/oauth",
  AIESEC_OAUTH_CLIENT_ID: "client-id",
  AIESEC_OAUTH_CLIENT_SECRET: "client-secret",
  AIESEC_OAUTH_REDIRECT_URI: "http://localhost:3000/api/auth/callback",
  GIS_GRAPHQL_URL: "https://gis-api.aiesec.org/graphql",
  SESSION_SECRET: "a".repeat(32),
  TOKEN_ENCRYPTION_KEY: "b".repeat(32),
  NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
};

/** Every optional variable, written the way a `.env` template writes them. */
const BLANK_OPTIONALS = {
  DIRECT_URL: "",
  SUPABASE_URL: "",
  SUPABASE_PUBLIC_URL: "",
  SUPABASE_S3_ACCESS_KEY_ID: "",
  SUPABASE_S3_SECRET_ACCESS_KEY: "",
  SUPABASE_S3_REGION: "",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  INNGEST_EVENT_KEY: "",
  INNGEST_SIGNING_KEY: "",
  SENTRY_DSN: "",
  OTEL_EXPORTER_OTLP_ENDPOINT: "",
  BREAK_GLASS_ALERT_WEBHOOK: "",
  PULSE_DEPLOYMENT: "",
  PULSE_TERM_LABEL: "",
};

describe("server environment schema", () => {
  it("accepts a minimal configuration with every optional key absent", () => {
    expect(serverSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts blank optionals — an unset .env line is FOO=, not a missing key", () => {
    const result = serverSchema.safeParse({ ...VALID, ...BLANK_OPTIONALS });
    if (!result.success) {
      throw new Error(
        `Blank optionals rejected:\n${result.error.issues
          .map((i) => `  ${i.path.join(".")}: ${i.message}`)
          .join("\n")}`
      );
    }
    expect(result.success).toBe(true);
  });

  it("normalises a blank optional to undefined, matching how has.*() reads it", () => {
    const parsed = serverSchema.parse({ ...VALID, SENTRY_DSN: "", UPSTASH_REDIS_REST_URL: "" });
    expect(parsed.SENTRY_DSN).toBeUndefined();
    expect(parsed.UPSTASH_REDIS_REST_URL).toBeUndefined();
  });

  it("treats whitespace-only as absent too", () => {
    const parsed = serverSchema.parse({ ...VALID, OTEL_EXPORTER_OTLP_ENDPOINT: "   " });
    expect(parsed.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it("still validates an optional that is actually set", () => {
    const bad = serverSchema.safeParse({ ...VALID, UPSTASH_REDIS_REST_URL: "not-a-url" });
    expect(bad.success).toBe(false);

    const good = serverSchema.safeParse({
      ...VALID,
      UPSTASH_REDIS_REST_URL: "https://eu1.upstash.io",
    });
    expect(good.success).toBe(true);
  });
});

describe("required variables", () => {
  it("rejects a missing database URL", () => {
    const rest: Record<string, string> = { ...VALID };
    delete rest.DATABASE_URL;
    expect(serverSchema.safeParse(rest).success).toBe(false);
  });

  it("does not let a blank required variable through", () => {
    // The blank-as-absent rule must not leak onto required fields, or a
    // half-configured deployment would start and fail on the first request.
    expect(serverSchema.safeParse({ ...VALID, AIESEC_OAUTH_CLIENT_ID: "" }).success).toBe(false);
    expect(serverSchema.safeParse({ ...VALID, DATABASE_URL: "" }).success).toBe(false);
  });

  it("enforces the 32-character floor on both secrets", () => {
    // 32 bytes is the floor for HS256 and the exact width of an AES-256 key.
    expect(serverSchema.safeParse({ ...VALID, SESSION_SECRET: "short" }).success).toBe(false);
    expect(serverSchema.safeParse({ ...VALID, TOKEN_ENCRYPTION_KEY: "short" }).success).toBe(false);
  });

  it("reports every problem at once, not one per deploy", () => {
    const result = serverSchema.safeParse({ ...VALID, DATABASE_URL: "", SESSION_SECRET: "x" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects a malformed URL in a required field", () => {
    expect(
      serverSchema.safeParse({ ...VALID, GIS_GRAPHQL_URL: "gis-api.aiesec.org" }).success
    ).toBe(false);
  });
});
