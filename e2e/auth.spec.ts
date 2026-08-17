import { alertText, expect, test } from "./fixtures";

test.describe("unauthenticated access", () => {
  test("the feed redirects to sign-in and remembers where you were going", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("returnTo");
    await expect(
      page
        .getByRole("button", { name: /sign in with aiesec/i })
        .or(page.getByRole("link", { name: /sign in with aiesec/i }))
    ).toBeVisible();
  });

  test("the admin area is not reachable", async ({ page }) => {
    await page.goto("/admin/queue");
    await expect(page).toHaveURL(/\/login/);
  });

  test("legal pages are readable without signing in", async ({ page }) => {
    for (const path of [
      "/legal/privacy",
      "/legal/cookies",
      "/legal/terms",
      "/legal/content-policy",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("the health endpoint answers without a session and is not cached", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");

    const body = await response.json();
    expect(body.status).toBe("ok");
    // Monitoring must assert freshness, not the status code.
    expect(Date.now() - Date.parse(body.generatedAt)).toBeLessThan(60_000);
  });
});

test.describe("OAuth callback", () => {
  test("rejects a callback with no state cookie", async ({ page }) => {
    // Without `state`, the callback would accept any code presented to it —
    // a login-CSRF binding the victim's browser to the attacker's account.
    await page.goto("/api/auth/callback?code=attacker-supplied-code&state=guessed");
    await expect(page).toHaveURL(/\/login\?error=state_mismatch/);
    await expect(alertText(page)).toContainText(/couldn't be verified/i);
  });

  test("rejects a callback with no code at all", async ({ page }) => {
    await page.goto("/api/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=/);
  });
});

test.describe("signed-in session", () => {
  test("a member reaches the feed and sees their account menu", async ({ page, signInAs }) => {
    await signInAs("member");
    await expect(page).toHaveURL(/\/feed/);
    await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  });

  test("no AIESEC credential is left in the browser", async ({ context, signInAs }) => {
    await signInAs("member");
    const cookies = await context.cookies();

    // The browser holds a Pulse session identifier, not a
    // live GIS API credential.
    expect(cookies.map((c) => c.name)).not.toContain("aiesec_token");
    expect(cookies.map((c) => c.name)).not.toContain("refresh_token");

    const session = cookies.find((c) => c.name === "pulse_session");
    expect(session, "pulse_session cookie").toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");

    const [, payload] = session!.value.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(Object.keys(claims).sort()).toEqual(["aud", "exp", "iat", "iss", "jti", "sub"]);
  });

  test("signing out revokes the session, not just the cookie", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("menuitem", { name: /^sign out$/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("security headers", () => {
  test("the feed carries a nonce-based CSP and the rest of the header set", async ({
    page,
    signInAs,
  }) => {
    await signInAs("member");
    const response = await page.goto("/feed");
    const headers = response!.headers();

    const csp = headers["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // style-src-attr is present and deliberate: a nonce cannot apply to a
    // style attribute, and a style attribute cannot execute script.
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/style-src [^;]*'unsafe-inline'/);

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
  });

  test("no CSP violations are reported while rendering the feed", async ({ page, signInAs }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });

    await signInAs("member");
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
});

test.describe("break-glass", () => {
  test("is reachable, warns loudly, and rejects bad credentials uniformly", async ({ page }) => {
    await page.goto("/break-glass");
    await expect(page.getByRole("heading", { name: /emergency access/i })).toBeVisible();
    await expect(page.getByText(/CRITICAL alert/i)).toBeVisible();

    await page.getByLabel("Email").fill("nobody@example.invalid");
    await page.getByLabel("Password").fill("not-the-right-password");
    await page.getByLabel("Authenticator code").fill("000000");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Uniform copy — distinguishing "no such account" from "wrong code" turns
    // this form into an account enumerator.
    await expect(alertText(page)).toContainText("Invalid credentials.");
  });

  test("the console is unreachable without a break-glass session", async ({ page }) => {
    await page.goto("/break-glass/console");
    await expect(page).toHaveURL(/\/break-glass$/);
  });
});
