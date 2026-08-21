import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test as base, type TestInfo } from "@playwright/test";

import type { PersonaKey } from "./gis-stub/fixtures";

export type { PersonaKey } from "./gis-stub/fixtures";

/**
 * Signing in drives the whole real path: /api/auth/start mints `state`, the
 * browser is redirected to the authorization server, the code comes back, the
 * callback verifies `state`, exchanges the code, queries GIS, parses the
 * response through the production Zod schema and reconciles grants. Only the far
 * end of the socket is ours — see ./gis-stub/server.ts.
 *
 * The persona is chosen with a cookie on the stub's own origin, set here before
 * navigating. The application never learns that personas exist.
 */

const STUB_ORIGIN = `http://127.0.0.1:${process.env.PULSE_GIS_STUB_PORT ?? 3099}`;
const PERSONA_COOKIE = "pulse_e2e_persona";

/**
 * /api/auth/start throttles per client IP at 10 attempts per 15 minutes, and a
 * suite that signs in dozens of times from one loopback address would spend that
 * budget and start failing on 429s that say nothing about the code under test.
 * Each test presents its own synthetic address instead. `clientIp()` reads
 * `x-forwarded-for` in production too, so this exercises the same code path
 * rather than disabling the limiter.
 *
 * Counted rather than hashed so the addresses cannot collide: workers are
 * separate processes with distinct indices, and tests within a worker run in
 * sequence. A retry is a fresh run and takes the next address.
 */
let nthRunInWorker = 0;

function syntheticIp(testInfo: TestInfo): string {
  const n = nthRunInWorker++;
  return `10.${testInfo.workerIndex & 0xff}.${(n >> 8) & 0xff}.${n & 0xff}`;
}

export type SignInAs = (persona: PersonaKey, returnTo?: string, isolate?: string) => Promise<void>;

/** Starts a sign-in without asserting where it lands — for the refusal cases. */
export type AttemptSignIn = (persona: PersonaKey, isolate?: string) => Promise<void>;

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
  attemptSignIn: AttemptSignIn;
}>({
  extraHTTPHeaders: async ({}, use, testInfo) => {
    await use({ "x-forwarded-for": syntheticIp(testInfo) });
  },

  attemptSignIn: async ({ page }, use) => {
    await use((persona, isolate) => startSignIn(page, persona, "/feed", isolate));
  },

  signInAs: async ({ page }, use) => {
    await use(async (persona, returnTo = "/feed", isolate) => {
      await startSignIn(page, persona, returnTo, isolate);
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
