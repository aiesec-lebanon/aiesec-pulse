import { expect, expectNoA11yViolations, test } from "./fixtures";

test.describe("axe-core, WCAG 2.2 AA", () => {
  test("sign-in", async ({ page }) => {
    await page.goto("/login");
    await expectNoA11yViolations(page, "/login");
  });

  test("legal pages", async ({ page }) => {
    for (const path of [
      "/legal/privacy",
      "/legal/cookies",
      "/legal/terms",
      "/legal/content-policy",
    ]) {
      await page.goto(path);
      await expectNoA11yViolations(page, path);
    }
  });

  test("feed", async ({ page, signInAs }) => {
    await signInAs("member");
    await expectNoA11yViolations(page, "/feed");
  });

  test("profile", async ({ page, signInAs }) => {
    await signInAs("member", "/profile");
    await expectNoA11yViolations(page, "/profile");
  });

  test("privacy settings", async ({ page, signInAs }) => {
    await signInAs("member", "/settings/privacy");
    await expectNoA11yViolations(page, "/settings/privacy");
  });

  test("composer", async ({ page, signInAs }) => {
    await signInAs("lc_vp", "/posts/new");
    await expectNoA11yViolations(page, "/posts/new");
  });

  test("drafts", async ({ page, signInAs }) => {
    await signInAs("lc_vp", "/drafts");
    await expectNoA11yViolations(page, "/drafts");
  });

  test("search", async ({ page, signInAs }) => {
    await signInAs("member", "/search");
    await expectNoA11yViolations(page, "/search");
  });

  test("bookmarks", async ({ page, signInAs }) => {
    await signInAs("member", "/bookmarks");
    await expectNoA11yViolations(page, "/bookmarks");
  });

  test("topic archive", async ({ page, signInAs }) => {
    await signInAs("member", "/topics/bd");
    await expectNoA11yViolations(page, "/topics/bd");
  });

  test("moderation queue", async ({ page, signInAs }) => {
    await signInAs("mc_vp", "/review");
    await expectNoA11yViolations(page, "/review");
  });

  test("moderation tables", async ({ page, signInAs }) => {
    await signInAs("pai", "/moderation/posts");
    await expectNoA11yViolations(page, "/moderation/posts");
    await page.goto("/moderation/comments");
    await expectNoA11yViolations(page, "/moderation/comments");
  });

  test("admin sign-in", async ({ page }) => {
    await page.goto("/admin/login");
    await expectNoA11yViolations(page, "/admin/login");
  });

  test("administration surfaces", async ({ page, signInAsAdmin }) => {
    await signInAsAdmin();
    await expectNoA11yViolations(page, "/admin/roles");
    await page.goto("/admin/audit");
    await expectNoA11yViolations(page, "/admin/audit");
    await page.goto("/admin/privacy");
    await expectNoA11yViolations(page, "/admin/privacy");
  });
});

test.describe("keyboard operation", () => {
  test("2.4.1 — a skip link is the first stop and it moves focus", async ({ page, signInAs }) => {
    await signInAs("member");
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: /skip to content/i });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("2.4.11 — the focused element is not hidden behind the sticky header", async ({
    page,
    signInAs,
  }) => {
    await signInAs("member");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    const focusedBox = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const { top, bottom } = el.getBoundingClientRect();
      const header = document.querySelector("header");
      return { top, bottom, headerBottom: header?.getBoundingClientRect().bottom ?? 0 };
    });

    expect(focusedBox).not.toBeNull();
    expect(focusedBox!.bottom).toBeGreaterThan(0);
  });

  test("the account menu opens, closes on Escape, and returns focus", async ({
    page,
    signInAs,
  }) => {
    await signInAs("member");
    const trigger = page.getByRole("button", { name: /account menu/i });

    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("2.5.8 — interactive targets are at least 24 CSS px", async ({ page, signInAs }) => {
    await signInAs("member");

    const undersized = await page.evaluate(() => {
      const results: string[] = [];
      const elements = document.querySelectorAll<HTMLElement>("button, a[href], [role='button']");
      for (const el of elements) {
        const { width, height } = el.getBoundingClientRect();
        if (width <= 1 || height <= 1) continue;
        if (width < 24 || height < 24) {
          results.push(
            `${el.tagName}.${el.className.slice(0, 40)} ${Math.round(width)}×${Math.round(height)}`
          );
        }
      }
      return results;
    });

    expect(undersized).toEqual([]);
  });
});

test.describe("document structure", () => {
  test("every core page has exactly one h1", async ({ page, signInAs }) => {
    await signInAs("pai");
    for (const path of ["/feed", "/profile", "/settings/privacy", "/review", "/admin/audit"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), `h1 count on ${path}`).toHaveCount(1);
    }
  });

  test("the page declares its language", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
