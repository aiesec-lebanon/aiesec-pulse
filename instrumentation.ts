import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  const { assertProductionEnv } = await import("@/lib/env");
  assertProductionEnv();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import("@/lib/logger");

  logger.error("Unhandled server error", {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
    // `digest` is the id surfaced to the user by app/error.tsx — it's the only
    // thing they can quote, so it must be logged to be useful.
    digest: (error as { digest?: string }).digest,
    error,
  });
};
