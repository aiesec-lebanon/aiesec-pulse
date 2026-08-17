import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { has } from "@/lib/env";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

// A cached 200 is not a health signal, so monitoring asserts on generatedAt
// rather than the status code. Unauthenticated: the body carries nothing.

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Check = { ok: boolean; latencyMs: number; detail?: string };

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const started = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export async function GET() {
  const database = await timed(() => db.$queryRaw`SELECT 1`);

  // Redis is a hard dependency in production (distributed rate limiting) but
  // optional locally, so its absence is reported as "skipped" rather than as a
  // failure. `assertProductionEnv` is what refuses the production boot.
  const cache: Check | { ok: true; skipped: true } = has.redis()
    ? await timed(async () => {
        const client = redis();
        if (!client) throw new Error("Redis client unavailable");
        await client.ping();
      })
    : { ok: true, skipped: true };

  const ok = database.ok && cache.ok;
  if (!ok) logger.error("Health check failed", { database, cache });

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      generatedAt: new Date().toISOString(),
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      checks: { database, cache },
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/json",
      },
    }
  );
}
