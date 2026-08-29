import "server-only";

// Redaction happens at the sink rather than at each call site, so a careless
// log line added later is contained by default.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const SECRET_KEYS = new Set([
  "access_token",
  "refresh_token",
  "accesstoken",
  "refreshtoken",
  "accesstokenenc",
  "refreshtokenenc",
  "code",
  "code_verifier",
  "client_secret",
  "clientsecret",
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwordhash",
  "totpsecret",
  "totpsecretenc",
  "session_secret",
  "token_encryption_key",
  "state",
]);

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.has(k.toLowerCase()) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };

  const serialised = JSON.stringify(line);
  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit("error", message, fields),

  child(bound: Record<string, unknown>) {
    return {
      debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, { ...bound, ...f }),
      info: (m: string, f?: Record<string, unknown>) => emit("info", m, { ...bound, ...f }),
      warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, { ...bound, ...f }),
      error: (m: string, f?: Record<string, unknown>) => emit("error", m, { ...bound, ...f }),
    };
  },
};

// Web Crypto rather than node:crypto — this is reachable from
// instrumentation.ts, which Next.js also loads in the Edge runtime.
export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export const __testing = { redact };
