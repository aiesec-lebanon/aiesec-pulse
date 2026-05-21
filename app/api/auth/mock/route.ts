import { NextResponse, type NextRequest } from "next/server";

// Dev-only mock OAuth provider. Only active when USE_MOCK_OAUTH=true.
// TODO: issue a fake session JWT for a configurable mock user/role.
export async function GET(_req: NextRequest) {
  if (process.env.USE_MOCK_OAUTH !== "true") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  return NextResponse.json({ message: "Mock OAuth — not yet implemented" }, { status: 501 });
}
