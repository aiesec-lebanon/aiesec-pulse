import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test as base } from "@playwright/test";

// signInAs drives the mock provider rather than stubbing cookies, so the tests
// exercise the real session issuance path.

export type Persona = "member" | "publisher" | "editor" | "moderator" | "admin";

export const test = base.extend<{
  signInAs: (persona: Persona, returnTo?: string, isolate?: string) => Promise<void>;
}>({
  signInAs: async ({ page }, use) => {
    await use(async (persona, returnTo = "/feed", isolate) => {
      const params = new URLSearchParams({ persona, returnTo });
      if (isolate) params.set("isolate", isolate);
      await page.goto(`/api/auth/mock?${params.toString()}`);
      await page.waitForURL(`**${returnTo}`);
    });
  },
});

export function isolationId(testInfo: { title: string }): string {
  return `${testInfo.title.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}${Date.now().toString(36)}`;
}

export { expect };

// Excludes __next-route-announcer__, a permanently mounted role="alert" the
// framework uses — without this, every getByRole("alert") fails strict mode.
export function alertText(page: Page) {
  return page.locator('[role="alert"]:not([id="__next-route-announcer__"])');
}

export async function expectNoA11yViolations(page: Page, context?: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 3).map((node) => node.html),
  }));

  expect(summary, `Accessibility violations${context ? ` on ${context}` : ""}`).toEqual([]);
}
