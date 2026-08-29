import "server-only";

import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const url = z.string().url();

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
  DATABASE_POOL_MAX: blankAsAbsent(z.coerce.number().int().positive()),

  AIESEC_OAUTH_AUTH_URL: url,
  AIESEC_OAUTH_CLIENT_ID: nonEmpty,
  AIESEC_OAUTH_CLIENT_SECRET: nonEmpty,
  AIESEC_OAUTH_REDIRECT_URI: url,
  GIS_GRAPHQL_URL: url,

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY must be at least 32 characters (base64 of 32 raw bytes)"),

  NEXT_PUBLIC_BASE_URL: url,

  ADMIN_EMAIL: z.string().trim().email("ADMIN_EMAIL must be an email address"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  ADMIN_SESSION_SECRET: z.string().min(32, "ADMIN_SESSION_SECRET must be at least 32 characters"),

  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),

  SUPABASE_URL: blankAsAbsent(url),
  SUPABASE_PUBLIC_URL: blankAsAbsent(url),
  SUPABASE_S3_ACCESS_KEY_ID: blankAsAbsent(nonEmpty),
  SUPABASE_S3_SECRET_ACCESS_KEY: blankAsAbsent(nonEmpty),
  SUPABASE_S3_REGION: blankAsAbsent(nonEmpty),

  PULSE_DEPLOYMENT: blankAsAbsent(nonEmpty),
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
  storage: () =>
    Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_S3_ACCESS_KEY_ID &&
      process.env.SUPABASE_S3_SECRET_ACCESS_KEY
    ),
};

export const isProductionDeployment = (): boolean =>
  process.env.VERCEL_ENV === "production" || process.env.PULSE_DEPLOYMENT === "production";

const isProductionBuild = () => process.env.NODE_ENV === "production";

export function assertProductionEnv(): void {
  load();

  if (!isProductionDeployment()) {
    warnIfUndeclaredProduction();
    return;
  }

  const missing: string[] = [];
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
  if (has.storage()) return;

  console.warn(
    JSON.stringify({
      level: "warn",
      time: new Date().toISOString(),
      message: "Production build running without a declared deployment environment",
      detail:
        "The storage check was skipped. If this is the live site, set PULSE_DEPLOYMENT=production. Vercel sets VERCEL_ENV automatically.",
    })
  );
}
