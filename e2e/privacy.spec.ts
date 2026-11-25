import { E2E_ADMIN } from "./admin-credentials";
import { alertText, expect, isolationId, test } from "./fixtures";
import { personIdFor } from "./gis-stub/fixtures";

test.describe("admin console hardening", () => {
  test("locks sign-in after five refused attempts from one address", async ({ page }) => {
    // Waits for each server round trip: the first error stays on screen, and
    // the button ignores clicks while a submission is pending.
    async function attempt(password: string) {
      await page.locator("#admin-email").fill(E2E_ADMIN.email);
      await page.locator("#admin-password").fill(password);
      await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === "POST" && r.url().includes("/admin/login")
        ),
        page.getByRole("button", { name: /^sign in$/i }).click(),
      ]);
    }

    // An address of its own, so neither limiter carries over from other tests.
    const octet = () => Math.floor(Math.random() * 250) + 1;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.251.${octet()}.${octet()}` });

    await page.goto("/admin/login");
    for (let n = 0; n < 5; n++) {
      await attempt(`wrong-password-${n}`);
      await expect(alertText(page)).toContainText(/not accepted/i);
    }

    // The right password is refused too while the lockout lasts.
    await attempt(E2E_ADMIN.password);
    await expect(alertText(page)).toContainText(/too many failed sign-in attempts/i);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("signing out revokes the session, even for a copied cookie", async ({
    page,
    signInAsAdmin,
    browser,
    baseURL,
  }) => {
    await signInAsAdmin();
    const copied = (await page.context().cookies()).find((c) => c.name === "pulse_admin_session");
    expect(copied).toBeDefined();

    await page
      .getByRole("banner")
      .getByRole("button", { name: /^sign out$/i })
      .click();
    await page.waitForURL("**/admin/login");

    const other = await browser.newContext({ baseURL });
    await other.addCookies([{ ...copied!, sameSite: "Strict" }]);
    const replay = await other.newPage();
    await replay.goto("/admin/roles");
    await expect(replay).toHaveURL(/\/admin\/login/);
    await other.close();
  });
});

test.describe("members-only media", () => {
  test("refuses an image request without a member session", async ({ request }) => {
    const response = await request.get(
      "/api/media/post-media/0f8c3d2e-1111-4222-8333-944455556666.jpg",
      {
        maxRedirects: 0,
      }
    );
    expect(response.status()).toBe(401);
  });

  test("never serves an unfinished upload or a path outside the bucket", async ({
    page,
    signInAs,
  }) => {
    await signInAs("member");
    for (const path of ["/api/media/post-media/incoming/abc", "/api/media/other-bucket/x.jpg"]) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }
  });
});

test.describe("privacy notice and requests", () => {
  test("names AIESEC in Lebanon as controller and gives the real hosting location", async ({
    page,
  }) => {
    // Every AIESEC in Lebanon platform publishes its notice at /privacy.
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/legal\/privacy$/);
    const notice = page.getByRole("main");
    await expect(notice).toContainText("AIESEC in Lebanon builds, hosts and runs AIESEC Pulse");
    await expect(notice).toContainText("Seoul, South Korea");
    await expect(notice).not.toContainText("European Union");
    await expect(notice).not.toContainText("7 years");
    // Reached through Pulse itself: no address is published.
    await expect(notice).not.toContainText("@");
    await expect(notice.getByRole("form", { name: /contact the privacy team/i })).toBeVisible();
  });

  test("anyone can write to the privacy team, and the admin replies and links the account", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    // An address of its own: the form's limit counts per address, across runs.
    const octet = () => Math.floor(Math.random() * 250) + 1;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.252.${octet()}.${octet()}` });

    const isolate = isolationId(testInfo);
    // Neither tag contains the other, so each row filter matches one row.
    const stamp = Date.now().toString(36);
    const visitor = `visitor-${stamp}`;
    const member = `member-${stamp}`;

    async function send(tag: string, kind: string) {
      const form = page.getByRole("form", { name: /contact the privacy team/i });
      await form.getByLabel("Your name").fill(`Sender ${tag}`);
      await form.getByLabel("Email for our reply").fill(`${tag}@e2e.invalid`);
      await form.getByLabel("What is it about?").selectOption(kind);
      await form.getByLabel("Your message").fill(`Message ${tag}\nSecond line.`);
      await form.getByRole("button", { name: /send to the privacy team/i }).click();
      await expect(page.getByRole("status").filter({ hasText: "Message sent" })).toContainText(
        `${tag}@e2e.invalid`
      );
    }

    // Signed out, as a former member would be.
    await page.goto("/legal/privacy#contact");
    await send(visitor, "ERASURE");

    // Signed in, the message arrives already linked to the account.
    await signInAs("member", "/legal/privacy", isolate);
    await send(member, "QUESTION");

    await signInAsAdmin("/admin/privacy");

    const fromMember = page.getByRole("listitem").filter({ hasText: `Message ${member}` });
    await expect(fromMember).toContainText("Test Member");
    await expect(fromMember).not.toContainText("Not linked to an account");

    const fromVisitor = page.getByRole("listitem").filter({ hasText: `Message ${visitor}` });
    await expect(fromVisitor).toContainText(`Sender ${visitor}`);
    await expect(fromVisitor).toContainText("Not linked to an account");
    await expect(fromVisitor.getByRole("link", { name: /reply by email/i })).toHaveAttribute(
      "href",
      new RegExp(`^mailto:${visitor}@e2e\\.invalid\\?subject=`)
    );

    await fromVisitor.getByLabel(/link it to their account/i).fill(personIdFor("member", isolate));
    await fromVisitor.getByRole("button", { name: /link account/i }).click();
    await expect(fromVisitor).toContainText("Test Member");
    await expect(fromVisitor).not.toContainText("Not linked to an account");
  });

  test("offers restriction as a request type", async ({ page, signInAs }) => {
    await signInAs("member", "/settings/privacy");
    await expect(page.getByRole("option", { name: /pause the use of my data/i })).toBeAttached();
  });

  test("the health check does not leak database errors", async ({ request }) => {
    const body = (await (await request.get("/api/health")).json()) as {
      checks: { database: { ok: boolean; detail?: string } };
    };
    if (!body.checks.database.ok) expect(body.checks.database.detail).toBe("unavailable");
    expect(body.checks.database.ok).toBe(true);
  });
});
