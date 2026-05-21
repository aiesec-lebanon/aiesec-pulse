import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/auth/me
 *
 * Expected behavior:
 * - If a valid "user" cookie exists → return user information
 * - If no user cookie exists → return 401 (not authenticated)
 *
 * The "user" cookie is created during the OAuth callback
 * (/api/auth/callback) after successful authentication.
 */

export async function GET() {
  const cookieStore = await cookies();

  const user = cookieStore.get("user")?.value;

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  return NextResponse.json(JSON.parse(user));
}
