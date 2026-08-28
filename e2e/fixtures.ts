import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test as base, type TestInfo } from "@playwright/test";

import { E2E_ADMIN } from "./admin-credentials";
import type { PersonaKey } from "./gis-stub/fixtures";

export type { PersonaKey } from "./gis-stub/fixtures";

/**
 * Signing in drives the real OAuth + GIS path; only the far socket end is a
 * stub (./gis-stub/server.ts). Persona is chosen via a cookie on the stub's
 * own origin — the application never learns personas exist.
 */

const STUB_ORIGIN = `http://127.0.0.1:${process.env.PULSE_GIS_STUB_PORT ?? 3099}`;
const PERSONA_COOKIE = "pulse_e2e_persona";

/**
 * /api/auth/start rate-limits by IP (10/15min); a suite signing in dozens of
 * times from one loopback address would trip 429s unrelated to the code
 * under test. Each test gets its own synthetic x-forwarded-for address
 * instead — counted, not hashed, so worker index + sequence can't collide.
 */
let nthRunInWorker = 0;

function syntheticIp(testInfo: TestInfo): string {
  const n = nthRunInWorker++;
  return `10.${testInfo.workerIndex & 0xff}.${(n >> 8) & 0xff}.${n & 0xff}`;
}

export type SignInAs = (persona: PersonaKey, returnTo?: string, isolate?: string) => Promise<void>;

/** The credential admin. No AIESEC position reaches platform administration. */
export type SignInAsAdmin = (returnTo?: string) => Promise<void>;

/** Starts a sign-in without asserting where it lands — for the refusal cases. */
export type AttemptSignIn = (persona: PersonaKey, isolate?: string) => Promise<void>;

/**
 * Signs an arbitrary page in (not the `signInAs`-bound one). Sessions live
 * in the context's cookie jar, so a second sign-in swaps identity for every
 * page in that context — used by promotion.spec.ts to mix accounts.
 */
export async function signInPage(
  page: Page,
  persona: PersonaKey,
  returnTo = "/feed",
  isolate?: string
): Promise<void> {
  await startSignIn(page, persona, returnTo, isolate);
  await page.waitForURL(`**${returnTo}`);
}

async function startSignIn(
  page: Page,
  persona: PersonaKey,
  returnTo: string,
  isolate?: string
): Promise<void> {
  await page.context().addCookies([
    {
      name: PERSONA_COOKIE,
      value: isolate ? `${persona}:${isolate}` : persona,
      url: STUB_ORIGIN,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`/api/auth/start?returnTo=${encodeURIComponent(returnTo)}`);
}

export const test = base.extend<{
  signInAs: SignInAs;
  signInAsAdmin: SignInAsAdmin;
  attemptSignIn: AttemptSignIn;
}>({
  extraHTTPHeaders: async ({}, use, testInfo) => {
    await use({ "x-forwarded-for": syntheticIp(testInfo) });
  },

  attemptSignIn: async ({ page }, use) => {
    await use((persona, isolate) => startSignIn(page, persona, "/feed", isolate));
  },

  signInAs: async ({ page }, use) => {
    await use((persona, returnTo = "/feed", isolate) =>
      signInPage(page, persona, returnTo, isolate)
    );
  },

  signInAsAdmin: async ({ page }, use) => {
    await use(async (returnTo = "/admin/roles") => {
      await page.goto("/admin/login");
      await page.locator("#admin-email").fill(E2E_ADMIN.email);
      await page.locator("#admin-password").fill(E2E_ADMIN.password);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.waitForURL("**/admin/roles");
      if (returnTo !== "/admin/roles") {
        await page.goto(returnTo);
        await page.waitForURL(`**${returnTo}`);
      }
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
