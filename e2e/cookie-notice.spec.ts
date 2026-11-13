import { expect, expectNoA11yViolations, test } from "./fixtures";

test.use({ cookieNoticeAcknowledged: false });

test.describe("cookie notice", () => {
  test("shows on a first visit and passes axe", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("region", { name: "Cookie notice" })).toBeVisible();
    await expectNoA11yViolations(page, "/login with cookie notice");
  });

  test("links to the cookie policy", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("region", { name: "Cookie notice" })
      .getByRole("link", { name: "Cookie policy" })
      .click();
    await page.waitForURL("**/legal/cookies");
    await expect(page.getByRole("heading", { level: 1, name: "Cookie policy" })).toBeVisible();
  });

  test("stays dismissed after Got it", async ({ page }) => {
    await page.goto("/login");
    const notice = page.getByRole("region", { name: "Cookie notice" });
    await notice.getByRole("button", { name: "Got it" }).click();
    await expect(notice).toBeHidden();

    await page.reload();
    await expect(page.getByRole("region", { name: "Cookie notice" })).toHaveCount(0);
  });
});
