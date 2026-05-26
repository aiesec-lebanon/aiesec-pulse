import { type NextRequest, NextResponse } from "next/server";
import { requireMCP } from "@/lib/auth/guards";
import { getSignedUploadUrl } from "@/lib/storage";

export async function POST(req: NextRequest) {
  await requireMCP();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, contentType, size } = body as Record<string, unknown>;

  if (
    typeof filename !== "string" ||
    typeof contentType !== "string" ||
    typeof size !== "number"
  ) {
    return NextResponse.json(
      { error: "filename, contentType, and size are required" },
      { status: 400 },
    );
  }

  try {
    const result = await getSignedUploadUrl(filename, contentType, size);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
