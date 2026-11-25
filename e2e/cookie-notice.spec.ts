import { expect, expectNoA11yViolations, test } from "./fixtures";

test.use({ cookieNoticeAcknowledged: false });

test.describe("cookie banner", () => {
  test("shows on a first visit with equal choices and passes axe", async ({ page }) => {
    await page.goto("/login");
    const banner = page.getByRole("region", { name: "Cookie consent" });
    await expect(banner).toBeVisible();
    for (const name of ["Allow all", "Reject all", "Learn more / choose preferences"]) {
      await expect(banner.getByRole("button", { name })).toBeVisible();
    }
    await expectNoA11yViolations(page, "/login with cookie banner");
  });

  test("links to the cookie policy", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("region", { name: "Cookie consent" })
      .getByRole("link", { name: "Cookie policy" })
      .click();
    await page.waitForURL("**/legal/cookies");
    await expect(page.getByRole("heading", { level: 1, name: "Cookie policy" })).toBeVisible();
  });

  test("stays away after a choice, which is stored as ail_cookie_consent", async ({ page }) => {
    await page.goto("/login");
    const banner = page.getByRole("region", { name: "Cookie consent" });
    await banner.getByRole("button", { name: "Reject all" }).click();
    await expect(banner).toBeHidden();

    const consent = (await page.context().cookies()).find((c) => c.name === "ail_cookie_consent");
    expect(consent).toBeDefined();
    expect(JSON.parse(decodeURIComponent(consent!.value))).toMatchObject({
      necessary: true,
      performance: false,
      marketing: false,
    });

    await page.reload();
    await expect(page.getByRole("region", { name: "Cookie consent" })).toHaveCount(0);
  });

  test("opens the preferences panel and lists the unused categories", async ({ page }) => {
    await page.goto("/legal/privacy");
    await page
      .getByRole("region", { name: "Cookie consent" })
      .getByRole("button", { name: "Learn more / choose preferences" })
      .click();
    const panel = page.getByRole("region", { name: "Cookie preferences" });
    await expect(panel.getByRole("rowheader", { name: "Strictly necessary" })).toBeVisible();
    await expect(panel.getByText("Not used on Pulse")).toHaveCount(2);
    await expectNoA11yViolations(page, "cookie preferences panel");

    await panel.getByRole("button", { name: "Allow all" }).click();
    await expect(panel).toBeHidden();

    // The footer button reopens it at any time.
    await page.getByRole("contentinfo").getByRole("button", { name: "Cookies" }).click();
    await expect(page.getByRole("region", { name: "Cookie preferences" })).toBeVisible();
  });
});
