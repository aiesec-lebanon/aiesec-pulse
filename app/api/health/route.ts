import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

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

  const ok = database.ok;
  if (!ok) logger.error("Health check failed", { database });

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      generatedAt: new Date().toISOString(),
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      checks: { database },
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
