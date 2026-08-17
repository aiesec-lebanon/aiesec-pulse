import "dotenv/config";

import { createHash, randomBytes } from "node:crypto";

// A script rather than runtime detection: authorization codes are single-use,
// so a speculatively sent challenge that gets rejected breaks every login.
// The probe is partial — a server that ignores an unknown parameter looks the
// same as one that honours it.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Set it in .env before probing.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const authUrl = requireEnv("AIESEC_OAUTH_AUTH_URL").replace(/\/$/, "");
  const clientId = requireEnv("AIESEC_OAUTH_CLIENT_ID");
  const redirectUri = requireEnv("AIESEC_OAUTH_REDIRECT_URI");

  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const withPkce = new URL(`${authUrl}/authorize`);
  withPkce.searchParams.set("response_type", "code");
  withPkce.searchParams.set("client_id", clientId);
  withPkce.searchParams.set("redirect_uri", redirectUri);
  withPkce.searchParams.set("state", "probe");
  withPkce.searchParams.set("code_challenge", challenge);
  withPkce.searchParams.set("code_challenge_method", "S256");

  const baseline = new URL(withPkce);
  baseline.searchParams.delete("code_challenge");
  baseline.searchParams.delete("code_challenge_method");

  console.log("Probing", authUrl);
  console.log();

  const [withResponse, withoutResponse] = await Promise.all([
    fetch(withPkce, { redirect: "manual" }),
    fetch(baseline, { redirect: "manual" }),
  ]);

  const summarise = (label: string, response: Response) => {
    const location = response.headers.get("location");
    console.log(`${label}:`);
    console.log(`  status   ${response.status}`);
    if (location) console.log(`  location ${location.split("?")[0]}`);
    const error = location ? new URL(location, authUrl).searchParams.get("error") : null;
    if (error) console.log(`  error    ${error}`);
    return { status: response.status, error };
  };

  const withResult = summarise("with code_challenge_method=S256", withResponse);
  console.log();
  const withoutResult = summarise("without PKCE (baseline)", withoutResponse);
  console.log();

  const sameShape =
    withResult.status === withoutResult.status && withResult.error === withoutResult.error;

  if (withResult.error && !withoutResult.error) {
    console.log("RESULT: S256 appears to be REJECTED.");
    console.log("  Leave AIESEC_OAUTH_PKCE_S256 unset. Pulse is a confidential client,");
    console.log("  so `state` alone is sufficient.");
    process.exit(0);
  }

  if (sameShape) {
    console.log("RESULT: INCONCLUSIVE — the server responded identically either way.");
    console.log("  It may be honouring the challenge, or ignoring an unknown parameter.");
    console.log("  The only way to tell them apart is a real sign-in with");
    console.log("  AIESEC_OAUTH_PKCE_S256=true in a non-production environment: if the token");
    console.log("  exchange succeeds with the verifier and fails without it, S256 is enforced.");
    console.log("  Do not enable it in production on this result alone.");
    process.exit(0);
  }

  console.log("RESULT: the challenge changed the response. Follow up manually and record the");
  console.log("  outcome before enabling AIESEC_OAUTH_PKCE_S256.");
}

main().catch((error) => {
  console.error("Probe failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
