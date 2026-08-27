import { alertText, expect, isolationId, test } from "./fixtures";

test.describe("a member", () => {
  test("cannot reach the composer", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.goto("/posts/new");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("cannot reach the approval queue", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.goto("/review");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  // `/admin/*` now asks for the platform credential and nothing else, so an
  // AIESEC session — any AIESEC session, from a plain member to the PAI — is
  // sent to the credential login rather than to `/unauthorized`. The old
  // split (member → /unauthorized, PAI → /admin/login) was an accident of the
  // layout's per-section gate, which is gone now that the position-held
  // surfaces live outside /admin.
  test("cannot reach the permission matrix", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("cannot reach the data request queue", async ({ page, signInAs }) => {
    // Erasure is the only path in the product that destroys personal data, so
    // it is deliberately unreachable from any AIESEC position at all.
    await signInAs("member");
    await page.goto("/admin/privacy");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("sees no publishing or moderation entries in their account menu", async ({
    page,
    signInAs,
  }) => {
    await signInAs("member");
    await page.getByRole("button", { name: /account menu/i }).click();
    await expect(page.getByRole("menuitem", { name: /new post/i })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /moderation queue/i })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /privacy/i })).toBeVisible();
  });

  test("is told what to do when refused, rather than sent back to sign in", async ({
    page,
    signInAs,
  }) => {
    await signInAs("member");
    await page.goto("/posts/new");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/don't have access/i);
    await expect(page.getByText(/current positions in EXPA/i)).toBeVisible();
  });
});

test.describe("an LC vice president", () => {
  test("reaches the composer and sees the quota from policy", async ({
    page,
    signInAs,
  }, testInfo) => {
    // Its own account: quota is per author, so a shared one would make this
    // assertion depend on execution order.
    await signInAs("lc_vp", "/feed", isolationId(testInfo));
    await page.goto("/posts/new");
    await expect(page.getByRole("heading", { name: /share an update/i })).toBeVisible();
    // Two `role="status"` regions render on this page (the quota pill and the
    // composer's own draft-autosave indicator) — both individually correct,
    // so the locator narrows by content instead of assuming a single match.
    await expect(page.getByRole("status").filter({ hasText: /posts this week/i })).toContainText(
      /posts this week: \d+ of 2/i
    );
  });

  test("cannot approve their own entity's queue", async ({ page, signInAs }) => {
    // Publishing and approving are separate permissions precisely so a publisher
    // cannot wave their own over-quota post through.
    await signInAs("lc_vp");
    await page.goto("/review");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});

test.describe("an MC vice president", () => {
  test("reaches the approval queue", async ({ page, signInAs }) => {
    await signInAs("mc_vp");
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: /approval queue/i })).toBeVisible();
  });

  test("cannot reach the permission matrix or execute data requests", async ({
    page,
    signInAs,
  }) => {
    await signInAs("mc_vp");
    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin/privacy");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("the PAI", () => {
  test("holds the widest position in AIESEC and still cannot administer Pulse", async ({
    page,
    signInAs,
  }) => {
    await signInAs("pai");

    for (const route of [
      "/admin/roles",
      "/admin/flags",
      "/admin/quotas",
      "/admin/system",
      "/admin/privacy",
      "/admin/audit",
    ]) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/admin\/login/);
    }
  });

  test("still moderates, which is what the position is for", async ({ page, signInAs }) => {
    await signInAs("pai");
    await page.goto("/moderation/posts");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("the platform administrator", () => {
  test("signs in with a credential, not with AIESEC", async ({ page, signInAsAdmin }) => {
    await signInAsAdmin();
    await expect(page.getByRole("heading", { name: /^permissions$/i })).toBeVisible();
  });

  test("refuses a wrong password without saying which half was wrong", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill("e2e-admin@example.invalid");
    await page.locator("#admin-password").fill("not-the-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(alertText(page)).toContainText(/not accepted/i);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("reaches every administrative surface", async ({ page, signInAsAdmin }) => {
    await signInAsAdmin();
    for (const [route, heading] of [
      ["/admin/flags", /feature flags/i],
      ["/admin/quotas", /publishing quotas/i],
      ["/admin/system", /three faces/i],
      ["/admin/privacy", /data subject requests/i],
      ["/admin/audit", /audit log/i],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading }), route).toBeVisible();
    }
  });

  test("is not a member, so the feed is not theirs to read", async ({ page, signInAsAdmin }) => {
    await signInAsAdmin();
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login/);
  });

  test("edits the matrix, including the rows that used to be locked", async ({
    page,
    signInAsAdmin,
  }) => {
    await signInAsAdmin();
    for (const role of ["PAI", "AIVP", "MCVP"]) {
      await expect(
        page.getByRole("checkbox", { name: new RegExp(`publish within quota for ${role}`, "i") }),
        role
      ).toBeEnabled();
    }
  });

  // Farland is deliberate: no fixture holds an MC vice presidency there, so the
  // override this writes changes nobody's budget while it exists.
  test("gives one MC its own budget and takes it away again", async ({ page, signInAsAdmin }) => {
    await signInAsAdmin();
    await page.goto("/admin/quotas");

    const mcField = page.getByLabel("Member Committee");
    await mcField.fill("Farland");
    await page.getByRole("button", { name: /AIESEC in Farland/i }).click();

    await page.getByLabel("Budget", { exact: true }).selectOption("LOCAL");
    await page.getByLabel("Position class").selectOption("mc_vp");
    await page.getByLabel("Posts allowed").fill("7");
    await page.getByRole("button", { name: /set the override/i }).click();

    // Scoped to the overrides section: the defaults table above carries an MCVP
    // budget of its own, which is the point of an override.
    const overrides = page.getByRole("region", { name: /per-MC overrides/i });
    await expect(overrides.getByRole("heading", { name: /AIESEC in Farland/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(overrides.getByRole("spinbutton", { name: /budget for MCVP/i })).toHaveValue("7");

    // The default is what an MC returns to, so removing the override has to be
    // as reachable as setting it.
    await overrides.getByRole("button", { name: /remove the MCVP override/i }).click();
    await expect(overrides.getByText(/no MC has a bespoke allowance/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("signs out, and the console closes behind them", async ({ page, signInAsAdmin }) => {
    await signInAsAdmin();
    await page.getByRole("button", { name: /^sign out$/i }).click();
    await page.waitForURL("**/admin/login");

    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("every member", () => {
  test("can export their own data and raise a request", async ({ page, signInAs }) => {
    await signInAs("member", "/settings/privacy");
    await expect(page.getByRole("heading", { name: /privacy & your data/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /download my data/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /send request/i })).toBeVisible();
  });
});
