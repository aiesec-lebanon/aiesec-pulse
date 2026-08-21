import "server-only";

import { z } from "zod";

// Validation is lazy rather than at import: `next build` evaluates modules
// without runtime secrets. assertProductionEnv() closes the gap at boot.

const nonEmpty = z.string().trim().min(1);
const url = z.string().url();

// `.optional()` alone only permits a missing key, but an unset variable in a
// .env file is written `FOO=` and loads as an empty string.
function blankAsAbsent<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional()
  );
}

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: nonEmpty,
  DIRECT_URL: blankAsAbsent(nonEmpty),

  // Not NEXT_PUBLIC_*: /api/auth/start performs the redirect server-side, so the
  // client id never needs to reach the browser.
  AIESEC_OAUTH_AUTH_URL: url,
  AIESEC_OAUTH_CLIENT_ID: nonEmpty,
  AIESEC_OAUTH_CLIENT_SECRET: nonEmpty,
  AIESEC_OAUTH_REDIRECT_URI: url,
  GIS_GRAPHQL_URL: url,

  // 32 bytes is the floor for HS256 and the exact size of an AES-256 key.
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY must be at least 32 characters (base64 of 32 raw bytes)"),

  NEXT_PUBLIC_BASE_URL: url,

  // Platform administration is a separate credential login, not an AIESEC
  // position — no GIS response confers it.
  ADMIN_EMAIL: z.string().trim().email("ADMIN_EMAIL must be an email address"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  ADMIN_SESSION_SECRET: z.string().min(32, "ADMIN_SESSION_SECRET must be at least 32 characters"),

  // SUPABASE_URL is the S3 endpoint used for presigned uploads. Public object
  // URLs are derived from it by `publicStorageBase()`; SUPABASE_PUBLIC_URL
  // overrides that for a custom media domain or a self-hosted deployment.
  SUPABASE_URL: blankAsAbsent(url),
  SUPABASE_PUBLIC_URL: blankAsAbsent(url),
  SUPABASE_S3_ACCESS_KEY_ID: blankAsAbsent(nonEmpty),
  SUPABASE_S3_SECRET_ACCESS_KEY: blankAsAbsent(nonEmpty),
  SUPABASE_S3_REGION: blankAsAbsent(nonEmpty),

  UPSTASH_REDIS_REST_URL: blankAsAbsent(url),
  UPSTASH_REDIS_REST_TOKEN: blankAsAbsent(nonEmpty),
  INNGEST_EVENT_KEY: blankAsAbsent(nonEmpty),
  INNGEST_SIGNING_KEY: blankAsAbsent(nonEmpty),
  SENTRY_DSN: blankAsAbsent(nonEmpty),
  OTEL_EXPORTER_OTLP_ENDPOINT: blankAsAbsent(url),

  // Declares a non-Vercel host as the live deployment (see isProductionDeployment).
  PULSE_DEPLOYMENT: blankAsAbsent(nonEmpty),
  // AIESEC term label, e.g. "26.27". Only set during a term-transition rehearsal.
  PULSE_TERM_LABEL: blankAsAbsent(nonEmpty),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export const __testing = { serverSchema };

let cached: ServerEnv | null = null;

function load(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as ServerEnv, {
  get: (_target, key: string) => load()[key as keyof ServerEnv],
});

export const has = {
  redis: () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  inngest: () => Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY),
  sentry: () => Boolean(process.env.SENTRY_DSN),
  otel: () => Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT),
  storage: () =>
    Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_S3_ACCESS_KEY_ID &&
      process.env.SUPABASE_S3_SECRET_ACCESS_KEY
    ),
};

// NODE_ENV cannot answer this: `next start` sets it to "production"
// unconditionally, so CI, a local smoke test and the live site are
// indistinguishable by it.
export const isProductionDeployment = (): boolean =>
  process.env.VERCEL_ENV === "production" || process.env.PULSE_DEPLOYMENT === "production";

export const isProductionBuild = () => process.env.NODE_ENV === "production";

export function assertProductionEnv(): void {
  load();

  if (!isProductionDeployment()) {
    warnIfUndeclaredProduction();
    return;
  }

  const missing: string[] = [];
  if (!has.redis())
    missing.push("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (distributed rate limiting)");
  if (!has.sentry()) missing.push("SENTRY_DSN (error tracking)");
  if (!has.storage()) missing.push("SUPABASE_URL / SUPABASE_S3_* (media uploads)");

  if (missing.length > 0) {
    throw new Error(
      `Production boot refused — required integrations are unconfigured:\n${missing
        .map((m) => `  · ${m}`)
        .join("\n")}`
    );
  }
}

function warnIfUndeclaredProduction(): void {
  if (!isProductionBuild()) return;
  if (has.redis() && has.sentry()) return;

  console.warn(
    JSON.stringify({
      level: "warn",
      time: new Date().toISOString(),
      message: "Production build running without a declared deployment environment",
      detail:
        "Integration checks were skipped. If this is the live site, set PULSE_DEPLOYMENT=production. Vercel sets VERCEL_ENV automatically.",
    })
  );
}
