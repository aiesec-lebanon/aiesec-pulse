"use server";

import TokenResponse from "@/types/auth-types";
import axios from "axios";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/refresh
 *
 * This endpoint refreshes the OAuth access token when it has
 * expired. It is typically triggered by the authentication
 * middleware when the access token expiry time has passed.
 *
 * Flow:
 *
 * 1. Middleware detects expired access token
 * 2. Middleware redirects request to /api/auth/refresh
 * 3. This endpoint uses the refresh token to request a new
 *    access token from the OAuth provider
 * 4. New tokens are stored in cookies
 * 5. User is redirected back to the originally requested page
 */

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const cookieStore = await cookies();

  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_REDIRECT_SERVICE_URL}/token`,
      {
        grant_type: "refresh_token",
        client_id: process.env.NEXT_PUBLIC_CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        refresh_token: refreshToken,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const tokenData: TokenResponse = response.data;

    const expiresAt = tokenData.created_at + tokenData.expires_in;

    const redirectPath = req.nextUrl.searchParams.get("redirect") || "/";

    const res = NextResponse.redirect(new URL(redirectPath, baseUrl));
    res.cookies.set("aiesec_token", tokenData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: new Date(expiresAt * 1000),
    });

    res.cookies.set("refresh_token", tokenData.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    res.cookies.set("token_expires_at", expiresAt.toString(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    return res;
  } catch (error) {
    /**
     * If token refresh fails (invalid refresh token,
     * revoked session, network error, etc.), the user
     * must log in again.
     */
    return NextResponse.redirect(new URL("/login", baseUrl));
  }
}
