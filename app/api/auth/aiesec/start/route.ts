import { NextResponse } from "next/server";

// TODO: generate random state param, store in short-lived cookie, redirect to
// auth.aiesec.org/oauth/authorize with client_id, redirect_uri, state, response_type=code.
export async function GET() {
  return NextResponse.json({ message: "AIESEC OAuth start — not yet implemented" }, { status: 501 });
}
