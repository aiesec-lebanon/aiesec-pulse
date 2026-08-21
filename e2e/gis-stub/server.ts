import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { isPersona, type PersonaKey, personFor } from "./fixtures";

/**
 * Stands in for `auth.aiesec.org` and `gis-api.aiesec.org` while the e2e suite
 * runs. Started by `playwright.config.ts`; the app under test is pointed at it
 * with AIESEC_OAUTH_AUTH_URL and GIS_GRAPHQL_URL and cannot tell the difference.
 *
 * This exists **outside** the application on purpose. The previous suite signed
 * in through a mock provider that lived in `app/`, which meant the sign-in path
 * the tests exercised was not the sign-in path production runs: `state`, the
 * code exchange, the GIS query, the Zod parse and the grant reconciliation were
 * all skipped. Everything above now runs for real; only the far end of the
 * socket is ours.
 *
 * Playwright's own `page.route` cannot do this job. Both the token exchange and
 * the GIS query are server-to-server fetches made by the Next.js process, and
 * browser-level interception never sees them.
 *
 * Which persona a browser context signs in as is carried by a cookie on this
 * server's own origin, set by the test before it navigates. That keeps personas
 * isolated per context — parallel workers share this one process — without the
 * application ever learning that personas exist.
 */

const PORT = Number(process.env.PULSE_GIS_STUB_PORT ?? 3099);

/** Set by the e2e fixture on this server's origin, as `persona` or `persona:isolate`. */
const PERSONA_COOKIE = "pulse_e2e_persona";

type Selection = { persona: PersonaKey; isolate?: string };

function parseSelection(raw: string | undefined): Selection | null {
  if (!raw) return null;
  const [persona, isolate] = raw.split(":");
  if (!persona || !isPersona(persona)) return null;
  return isolate ? { persona, isolate } : { persona };
}

function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

// The authorization code is opaque to the app, so it is the natural carrier for
// the selection: /token turns it into an access token and /graphql reads it back
// off that token. No shared mutable state, so parallel workers cannot collide.
function encodeSelection(selection: Selection): string {
  return Buffer.from(JSON.stringify(selection)).toString("base64url");
}

function decodeSelection(encoded: string): Selection | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString()) as Selection;
    return isPersona(parsed.persona) ? parsed : null;
  } catch {
    return null;
  }
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  contentType = "application/json"
) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

// ── /authorize ───────────────────────────────────────────────────────────────
// The browser lands here after /api/auth/start redirects it. `state` is echoed
// back untouched: verifying it is the application's job, and a stub that
// "helpfully" regenerated it would hide a login-CSRF regression.
function authorize(req: IncomingMessage, res: ServerResponse, url: URL) {
  const selection = parseSelection(readCookie(req, PERSONA_COOKIE));
  if (!selection) {
    return send(
      res,
      400,
      `No ${PERSONA_COOKIE} cookie on this origin. The e2e fixture sets it before navigating; ` +
        `a test that reaches this page has signed in without going through signInAs.`,
      "text/plain"
    );
  }

  const redirectUri = url.searchParams.get("redirect_uri");
  if (!redirectUri) {
    return send(res, 400, "No redirect_uri in the authorization request.", "text/plain");
  }

  const target = new URL(redirectUri);
  target.searchParams.set("code", encodeSelection(selection));
  const state = url.searchParams.get("state");
  if (state) target.searchParams.set("state", state);

  res.writeHead(302, { Location: target.toString(), "Cache-Control": "no-store" });
  res.end();
}

// ── /token ───────────────────────────────────────────────────────────────────
async function token(req: IncomingMessage, res: ServerResponse) {
  const form = new URLSearchParams(await readBody(req));
  const grant = form.get("grant_type");

  // A refresh carries the selection in the refresh token instead of the code,
  // so `getUsableAccessToken` keeps working across an expiry.
  const carrier = grant === "refresh_token" ? form.get("refresh_token") : form.get("code");
  const selection = carrier ? decodeSelection(carrier.replace(/^refresh-/, "")) : null;

  if (!selection) {
    return send(res, 400, { error: "invalid_grant" });
  }

  const encoded = encodeSelection(selection);
  send(res, 200, {
    access_token: encoded,
    refresh_token: `refresh-${encoded}`,
    token_type: "Bearer",
    expires_in: 7200,
    created_at: Math.floor(Date.now() / 1000),
    scope: "read",
  });
}

// ── /graphql ─────────────────────────────────────────────────────────────────
async function graphql(req: IncomingMessage, res: ServerResponse) {
  const selection = decodeSelection((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
  if (!selection) {
    return send(res, 401, { errors: [{ message: "Unauthorized" }] });
  }

  // The one persona that is not a person: it makes this directory unreachable,
  // which is how the callback's fail-closed branch gets exercised for real.
  if (selection.persona === "gis_down") {
    return send(res, 503, { errors: [{ message: "Service unavailable" }] });
  }

  const body = (await readBody(req)) || "{}";
  const query = (JSON.parse(body) as { query?: string }).query ?? "";

  if (!query.includes("currentPerson")) {
    return send(res, 200, {
      errors: [{ message: `The GIS stub only implements currentPerson. Received: ${query}` }],
    });
  }

  send(res, 200, { data: { currentPerson: personFor(selection.persona, selection.isolate) } });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  void (async () => {
    try {
      if (url.pathname === "/__health") return send(res, 200, { status: "ok" });
      if (url.pathname === "/authorize" && req.method === "GET") return authorize(req, res, url);
      if (url.pathname === "/token" && req.method === "POST") return await token(req, res);
      if (url.pathname === "/graphql" && req.method === "POST") return await graphql(req, res);
      send(res, 404, { error: `No stub route for ${req.method} ${url.pathname}` });
    } catch (error) {
      send(res, 500, { error: String(error) });
    }
  })();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`GIS stub listening on http://127.0.0.1:${PORT}`);
});
