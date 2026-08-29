import type { Instrumentation } from "next";

// Lazy imports: register() must finish before the first request, and an
// unconfigured integration should cost nothing.

export async function register(): Promise<void> {
  const { assertProductionEnv } = await import("@/lib/env");
  assertProductionEnv();

  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { registerOTel } = await import("@vercel/otel");
    registerOTel({ serviceName: "aiesec-pulse" });
  }

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      // Sampled rather than exhaustive: full tracing on a free tier exhausts the
      // quota in a day and then reports nothing at all.
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // Member names and entity affiliations do not belong in a third-party
      // error tracker; a pseudonymous id is enough to correlate.
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.user) {
          event.user = { id: event.user.id };
        }
        if (event.request?.cookies) delete event.request.cookies;
        if (event.request?.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        return event;
      },
    });
  }
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

  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
};
