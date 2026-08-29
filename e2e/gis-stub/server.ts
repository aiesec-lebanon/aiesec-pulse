import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { isPersona, type PersonaKey, personFor } from "./fixtures";

/**
 * Stands in for auth.aiesec.org and gis-api.aiesec.org during e2e. The app
 * under test is pointed here via AIESEC_OAUTH_AUTH_URL/GIS_GRAPHQL_URL and
 * can't tell the difference — everything except this server (state, code
 * exchange, GIS query, Zod parse, grant reconciliation) runs for real.
 *
 * Lives outside the app on purpose: `page.route` can't intercept the
 * server-to-server token/GIS fetches Next.js makes. Persona selection
 * travels via a cookie on this server's own origin, keeping contexts
 * isolated even though parallel workers share this one process.
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

// The auth code is opaque to the app, so it carries the selection: /token
// turns it into an access token, /graphql reads it back off — no shared state.
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

// `state` is echoed back untouched — verifying it is the app's job; a stub
// that regenerated it would hide a login-CSRF regression.
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
