import "server-only";

import { decryptFromBytes, encryptToBytes } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// Never leave the server. Token material is redacted by field name in the logger.

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string | null;
};

const REFRESH_SKEW_MS = 5 * 60 * 1000;

export async function storeTokens(userId: string, tokens: TokenSet): Promise<void> {
  const data = {
    accessTokenEnc: new Uint8Array(encryptToBytes(tokens.accessToken)),
    refreshTokenEnc: new Uint8Array(encryptToBytes(tokens.refreshToken)),
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
  };
  await db.oauthToken.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

export async function deleteTokens(userId: string): Promise<void> {
  await db.oauthToken.deleteMany({ where: { userId } });
}

// An undecryptable row means the key changed without a rotation. Treated as
// "no token" so the user re-authenticates cleanly instead of hitting a 500.
async function readTokens(userId: string): Promise<TokenSet | null> {
  const row = await db.oauthToken.findUnique({ where: { userId } });
  if (!row) return null;

  try {
    return {
      accessToken: decryptFromBytes(row.accessTokenEnc),
      refreshToken: decryptFromBytes(row.refreshTokenEnc),
      expiresAt: row.expiresAt,
      scope: row.scope,
    };
  } catch (error) {
    logger.error("Stored OAuth token could not be decrypted", {
      userId,
      remedy: "TOKEN_ENCRYPTION_KEY changed without a rotation; re-authentication is required",
      error,
    });
    return null;
  }
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
  scope?: string;
};

function toTokenSet(payload: TokenResponse): TokenSet {
  // Fall back to our clock only if `created_at` is missing.
  const createdAtMs = payload.created_at ? payload.created_at * 1000 : Date.now();
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(createdAtMs + payload.expires_in * 1000),
    scope: payload.scope ?? null,
  };
}

const TOKEN_TIMEOUT_MS = 10_000;

async function postToken(body: Record<string, string>): Promise<TokenSet> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.AIESEC_OAUTH_AUTH_URL.replace(/\/$/, "")}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      // The body can echo the submitted code; never include it in the error.
      throw new Error(`Token endpoint responded ${response.status}`);
    }
    return toTokenSet((await response.json()) as TokenResponse);
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeCode(code: string, codeVerifier?: string): Promise<TokenSet> {
  return postToken({
    grant_type: "authorization_code",
    client_id: env.AIESEC_OAUTH_CLIENT_ID,
    client_secret: env.AIESEC_OAUTH_CLIENT_SECRET,
    redirect_uri: env.AIESEC_OAUTH_REDIRECT_URI,
    code,
    ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
  });
}

async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return postToken({
    grant_type: "refresh_token",
    client_id: env.AIESEC_OAUTH_CLIENT_ID,
    client_secret: env.AIESEC_OAUTH_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
}

export async function getUsableAccessToken(userId: string): Promise<string | null> {
  const tokens = await readTokens(userId);
  if (!tokens) return null;

  if (tokens.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
    return tokens.accessToken;
  }

  try {
    const refreshed = await refreshTokens(tokens.refreshToken);
    await storeTokens(userId, refreshed);
    return refreshed.accessToken;
  } catch (error) {
    logger.warn("OAuth token refresh failed", { userId, error });
    // Spent or revoked upstream; drop it so the next sign-in starts clean.
    await deleteTokens(userId);
    return null;
  }
}
