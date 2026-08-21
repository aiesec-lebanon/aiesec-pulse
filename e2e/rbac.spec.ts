import { expect, isolationId, test } from "./fixtures";

test.describe("a member", () => {
  test("cannot reach the composer", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.goto("/posts/new");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("cannot reach the approval queue", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.goto("/admin/queue");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("cannot reach the permission matrix", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("cannot reach the data request queue", async ({ page, signInAs }) => {
    // `admin.privacy_execute` is the only path in the product that destroys
    // personal data, so it is deliberately unreachable from every other role.
    await signInAs("member");
    await page.goto("/admin/privacy");
    await expect(page).toHaveURL(/\/unauthorized/);
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
    // composer's own draft-autosave indicator) — both individually correct
    // per the design system's §8.3 live-region rule, so the locator narrows
    // by content instead of assuming a single match.
    await expect(page.getByRole("status").filter({ hasText: /posts this week/i })).toContainText(
      /posts this week: \d+ of 2/i
    );
  });

  test("cannot approve their own entity's queue", async ({ page, signInAs }) => {
    // Publishing and approving are separate permissions precisely so a publisher
    // cannot wave their own over-quota post through.
    await signInAs("lc_vp");
    await page.goto("/admin/queue");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});

test.describe("an MC vice president", () => {
  test("reaches the approval queue", async ({ page, signInAs }) => {
    await signInAs("mc_vp");
    await page.goto("/admin/queue");
    await expect(page.getByRole("heading", { name: /approval queue/i })).toBeVisible();
  });

  test("cannot reach the permission matrix or execute data requests", async ({
    page,
    signInAs,
  }) => {
    await signInAs("mc_vp");
    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/unauthorized/);
    await page.goto("/admin/privacy");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});

test.describe("the PAI", () => {
  test("edits what a class may do, and cannot edit who holds one", async ({ page, signInAs }) => {
    await signInAs("pai");
    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { name: /^permissions$/i })).toBeVisible();

    // Authority is whatever GIS says it is, so there is deliberately nothing
    // here that confers a position - not for an admin either.
    await expect(page.locator("#grant-role")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^grant$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^revoke$/i })).toHaveCount(0);

    // The matrix itself is editable, except for the two locked classes.
    await expect(
      page.getByRole("checkbox", { name: /publish within quota for MCVP/i })
    ).toBeEnabled();
    await expect(
      page.getByRole("checkbox", { name: /publish within quota for PAI/i })
    ).toBeDisabled();
  });

  test("reaches the data request queue", async ({ page, signInAs }) => {
    await signInAs("pai");
    await page.goto("/admin/privacy");
    await expect(page.getByRole("heading", { name: /data subject requests/i })).toBeVisible();
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
