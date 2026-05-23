import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl, { status: 302 });

  response.cookies.delete("aiesec_token");
  response.cookies.delete("refresh_token");
  response.cookies.delete("token_expires_at");
  response.cookies.delete("user");

  return response;
}
