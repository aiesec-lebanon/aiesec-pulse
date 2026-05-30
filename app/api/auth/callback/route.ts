"use server";

import axios from "axios";
import { NextResponse, NextRequest } from "next/server";
import TokenResponse from "@/types/auth-types";
import validateUser from "@/server-utils/user-validation";

/**
 * This route handles the redirect from the OAuth provider after the user
 * successfully authenticates. The provider sends an authorization `code`
 * which must be exchanged for an access token.
 *
 * Flow:
 * 1. Extract the authorization code from the request query.
 * 2. Exchange the code for an access token + refresh token.
 * 3. Validate the user using the received access token.
 * 4. If authorized, store authentication cookies.
 * 5. Redirect the user to the application dashboard.
 */
export async function GET(req: NextRequest) {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

  // Step 1: Extract authorization code returned by the OAuth provider
  const code = req.nextUrl.searchParams.get("code");

  // If the code is missing, redirect user back to login
  if (!code) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  try {
    /**
     * Step 2: Exchange the authorization code for tokens
     *
     * The OAuth provider returns:
     * - access_token (used for authenticated requests)
     * - refresh_token (used to renew the access token)
     * - expires_in (token validity duration)
     * - created_at (token creation timestamp)
     */
    const tokenResponse = await axios.post(
      `${process.env.NEXT_PUBLIC_AUTH_URL}/token`,
      {
        client_id: process.env.NEXT_PUBLIC_CLIENT_ID,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: `${baseUrl}/api/auth/callback`,
        client_secret: process.env.CLIENT_SECRET,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const tokenData: TokenResponse = tokenResponse.data;
    console.log("Received token data:", tokenData);

    /**
     * Step 3: Validate the authenticated user
     *
     * This function verifies the access token and retrieves
     * user information from the authentication provider.
     */
    const { isValid, user } = await validateUser(tokenData.access_token);

    // If the user is not authorized to use this platform
    if (!isValid) {
      return NextResponse.redirect(new URL("/unauthorized", baseUrl));
    }

    /**
     * Step 4: Calculate token expiration timestamp
     */
    const expiresAt = tokenData.created_at + tokenData.expires_in;

    /**
     * Step 5: Create response and redirect to the application home page
     */
    const response = NextResponse.redirect(new URL("/", baseUrl));

    /**
     * Store authentication cookies
     *
     * access_token → used for API requests
     * refresh_token → used to refresh expired access tokens
     * token_expires_at → helps determine when token refresh is needed
     * user → cached user information for UI usage
     */

    response.cookies.set("aiesec_token", tokenData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: new Date(expiresAt * 1000),
    });

    response.cookies.set("refresh_token", tokenData.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    response.cookies.set("token_expires_at", expiresAt.toString(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    response.cookies.set("user", JSON.stringify(user), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: new Date(expiresAt * 1000),
    });

    return response;
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return NextResponse.redirect(new URL("/unauthorized", baseUrl));
  }
}
