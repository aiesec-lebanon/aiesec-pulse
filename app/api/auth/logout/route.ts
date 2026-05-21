import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.delete("aiesec_token");
  response.cookies.delete("refresh_token");
  response.cookies.delete("token_expires_at");
  response.cookies.delete("user");

  return response;
}
