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

  test("cannot reach role management", async ({ page, signInAs }) => {
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

test.describe("a publisher", () => {
  test("reaches the composer and sees the quota from policy", async ({
    page,
    signInAs,
  }, testInfo) => {
    // Its own account: quota is per author, so a shared one would make this
    // assertion depend on execution order.
    await signInAs("publisher", "/feed", isolationId(testInfo));
    await page.goto("/posts/new");
    await expect(page.getByRole("heading", { name: /share an update/i })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/posts this week: \d+ of 2/i);
  });

  test("cannot approve their own entity's queue", async ({ page, signInAs }) => {
    // Publishing and approving are separate permissions precisely so a publisher
    // cannot wave their own over-quota post through.
    await signInAs("publisher");
    await page.goto("/admin/queue");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});

test.describe("an editor", () => {
  test("reaches the approval queue", async ({ page, signInAs }) => {
    await signInAs("editor");
    await page.goto("/admin/queue");
    await expect(page.getByRole("heading", { name: /approval queue/i })).toBeVisible();
  });

  test("cannot grant roles or execute data requests", async ({ page, signInAs }) => {
    await signInAs("editor");
    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/unauthorized/);
    await page.goto("/admin/privacy");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});

test.describe("a platform admin", () => {
  test("reaches role management and sees only manually grantable roles", async ({
    page,
    signInAs,
  }) => {
    await signInAs("admin");
    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { name: /roles & grants/i })).toBeVisible();

    // By id, not by label: the surrounding "Grant a role" section is also
    // labelled, and `getByLabel("Role")` matches both under strict mode.
    const roleSelect = page.locator("#grant-role");
    await expect(roleSelect).toContainText("Entity editor");
    await expect(roleSelect).toContainText("Entity moderator");
    await expect(roleSelect).not.toContainText("Entity publisher");
    await expect(roleSelect).not.toContainText("Global publisher");
  });

  test("reaches the data request queue", async ({ page, signInAs }) => {
    await signInAs("admin");
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
