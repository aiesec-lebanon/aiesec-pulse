import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { mediaRouteUrl } from "@/lib/media";
import { checkPermission } from "@/lib/rbac/guards";
import { isSameOrigin } from "@/lib/request";
import { finalizeUpload, MEDIA_BUCKET, UploadError } from "@/lib/storage";

// Second half of an upload: the browser has PUT the file to `incoming/`; this
// checks the real bytes, strips metadata and stores it under a random name.
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

  let uploadKey: unknown;
  try {
    ({ uploadKey } = (await req.json()) as Record<string, unknown>);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof uploadKey !== "string") {
    return NextResponse.json({ error: "uploadKey is required" }, { status: 400 });
  }

  try {
    const stored = await finalizeUpload(uploadKey);
    return NextResponse.json({
      // Absolute, because the editor and the post actions treat image sources
      // as http(s) URLs and read the object key back out of them.
      url: `${env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}${mediaRouteUrl(MEDIA_BUCKET, stored.path)}`,
    });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("Upload could not be finalised", { userId: authorised.user.id, error });
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
