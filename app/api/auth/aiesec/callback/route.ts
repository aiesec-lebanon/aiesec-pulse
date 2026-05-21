import { NextResponse, type NextRequest } from "next/server";

// TODO: validate state cookie, exchange code for tokens via AIESEC OAuth,
// call GIS currentPerson, deriveRole, upsert User + OauthToken in DB,
// sign session JWT, set httpOnly cookie, redirect → /feed.
export async function GET(_req: NextRequest) {
  return NextResponse.json({ message: "AIESEC OAuth callback — not yet implemented" }, { status: 501 });
}
