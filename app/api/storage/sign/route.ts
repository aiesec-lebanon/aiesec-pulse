import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";
import { checkPermission } from "@/lib/rbac/guards";
import { isSameOrigin } from "@/lib/request";
import { getSignedUploadUrl } from "@/lib/storage";

// Hands out bucket write access, hence the permission check, per-user rate
// limit, and origin check that Route Handlers do not get for free.
export async function POST(req: NextRequest) {
  const authorised = await checkPermission("post.draft");
  if (!authorised.ok) {
    return NextResponse.json(
      { error: authorised.error },
      { status: authorised.code === "unauthenticated" ? 401 : 403 }
    );
  }

  if (!isSameOrigin(req.headers, env.NEXT_PUBLIC_BASE_URL)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const limit = await checkRateLimit("upload", authorised.user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: retryMessage(limit) },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, contentType, size } = body as Record<string, unknown>;
  if (typeof filename !== "string" || typeof contentType !== "string" || typeof size !== "number") {
    return NextResponse.json(
      { error: "filename, contentType, and size are required" },
      { status: 400 }
    );
  }

  try {
    const result = await getSignedUploadUrl(filename, contentType, size);
    return NextResponse.json(result);
  } catch (error) {
    logger.warn("Signed upload refused", { userId: authorised.user.id, contentType, size, error });
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
