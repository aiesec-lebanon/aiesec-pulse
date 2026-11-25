import { type NextRequest, NextResponse } from "next/server";

import { getActiveSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { isServableKey, MEDIA_BUCKET, signedViewUrl, VIEW_URL_TTL_SECONDS } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Post images live in a private bucket; only signed-in members get a link to
// one. The link is short-lived, so a copied URL stops working within minutes.
// The proxy skips image-extension paths, so this route checks the session itself.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bucket: string; key: string[] }> }
) {
  const session = await getActiveSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const { bucket, key: segments } = await params;
  const key = segments.join("/");
  if (bucket !== MEDIA_BUCKET || !isServableKey(key)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const location = await signedViewUrl(key);
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: location,
        // Reused by this browser only, and well inside the signed link's lifetime.
        "Cache-Control": `private, max-age=${Math.floor(VIEW_URL_TTL_SECONDS / 2)}`,
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    logger.error("Media link could not be signed", { error });
    return new NextResponse(null, { status: 503 });
  }
}
