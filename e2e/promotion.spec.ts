import type { Page } from "@playwright/test";

import { expect, isolationId, signInPage, test } from "./fixtures";

/**
 * Post level, end to end.
 *
 * The org tree comes from the GIS fixtures: one region holding two MCs —
 * Testonia, with the LCs Testville and Otherton beneath it, and Farland with
 * Fartown. A Testonia post reaching a Fartown member is the only thing that can
 * distinguish a promotion from no promotion, which is why the suite needs two
 * MCs at all.
 *
 * **Serial by necessity, not by preference.** The promotion budget is one per MC
 * per ISO week (the seeded default), it is counted per MC rather than per
 * account, and demotion does not refund it — so these tests deliberately spend a
 * shared, non-renewable resource and cannot be parallelised the way the rest of
 * the suite is. They are ordered so each starts with the budget it needs:
 * the refusal below spends nothing, then Testonia's promotion is spent, then
 * Farland's.
 */
test.describe.configure({ mode: "serial" });

const BODY = "A promotion test from the end-to-end suite, long enough to satisfy the minimum.";

const uniqueTitle = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const POST_SLUG_URL = /\/posts\/(?!new$|queued$)[a-z0-9-]+$/;

/**
 * Publishes as whoever is signed in, and returns the post's URL path. Passing a
 * note takes the composer's own reach control — the second route to a promotion
 * spending the same budget as the panel on post detail.
 */
async function publish(page: Page, title: string, networkNote?: string): Promise<string> {
  await page.goto("/posts/new");
  await page.locator("#title").fill(title);
  await page.locator("#content").pressSequentially(BODY);
  if (networkNote) {
    await page.getByRole("button", { name: /^the whole network$/i }).click();
    await page.locator("#promotion-note").fill(networkNote);
  }
  await page.getByRole("button", { name: /^publish$/i }).click();
  await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 20_000 });
  return new URL(page.url()).pathname;
}

/**
 * Whether the signed-in viewer can see a post, asked of the post's own page
 * rather than of the feed.
 *
 * The feed renders seven cards chosen by ranking, so "not on the feed" and "not
 * visible" are different statements and only one of them is the rule under test.
 * Post detail applies exactly the same `visibilityFilter` and answers with a
 * 404, so this is the precise question with none of the ranking noise.
 */
async function canSee(page: Page, path: string, title: string): Promise<boolean> {
  await page.goto(path);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  return (await heading.textContent())?.includes(title) ?? false;
}

async function promote(page: Page, note: string) {
  await page.getByRole("button", { name: /^promote to the network$/i }).click();
  await page.getByLabel(/why the network should see this/i).fill(note);
  await page.getByRole("button", { name: /^promote$/i }).click();
}

const promotionPanel = (page: Page) => page.getByRole("region", { name: /^network reach$/i });

test.describe("post level", () => {
  test("an AI-level office publishes at network reach without spending anything", async ({
    page,
    signInAs,
  }, testInfo) => {
    test.setTimeout(120_000);
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E AI announcement");

    // No reach control to operate: an AI office sits above the MC tier, so
    // there is no MC for LOCAL to mean anything relative to and nothing to
    // decide. The composer says so rather than offering a choice.
    await signInAs("pai", "/posts/new", isolate);
    await expect(page.getByText(/your office publishes at network level/i)).toBeVisible();
    const path = await publish(page, title);

    // Born NETWORK, not promoted into it — the panel reports the level, and the
    // budget behind it is untouched because no promotion was spent.
    await expect(promotionPanel(page).getByText(/every MC sees this post/i)).toBeVisible();
    await expect(promotionPanel(page)).toContainText(/100 of 100 promotions left/i);

    await signInAs("far_member", "/feed", isolate);
    expect(await canSee(page, path, title)).toBe(true);
  });

  test("refuses a class without post.promote, even with the control bypassed", async ({
    page,
    context,
    signInAs,
  }, testInfo) => {
    test.setTimeout(120_000);
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E bypassed promote");

    await signInAs("lc_vp", "/feed", isolate);
    const path = await publish(page, title);

    // The MCP's own page, with a working control on it.
    await signInAs("mc_president", "/feed", isolate);
    await page.goto(path);
    await expect(promotionPanel(page)).toBeVisible();

    // Swap the identity underneath it. Sessions live in the context's cookie
    // jar, so signing in on a second page re-points every request this page
    // makes — while the DOM it already rendered still offers the control. That
    // is the client bypassed: an MCVP holds no `post.promote` in the seeded
    // matrix, and the only thing left to refuse the write is the server.
    const second = await context.newPage();
    await signInPage(second, "mc_vp", "/feed", isolate);
    await second.close();

    await promote(page, "Bypassing the control to check the server refuses it.");
    // The refusal comes back through the dialog that submitted it, so this asks
    // the dialog rather than the page — the panel behind it carries a live
    // region of its own.
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(/permission/i, {
      timeout: 15_000,
    });

    // And the post did not move. Asked of a reader in the other MC, because
    // that is what promotion would have changed.
    await signInAs("far_member", "/feed", isolate);
    expect(await canSee(page, path, title)).toBe(false);
  });

  test("an LC post reaches another MC only once it is promoted", async ({
    page,
    signInAs,
  }, testInfo) => {
    test.setTimeout(120_000);
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E promoted story");

    // Published in Testville, an LC of Testonia.
    await signInAs("lc_vp", "/feed", isolate);
    const path = await publish(page, title);

    // A member of Otherton — the *sibling* LC — sees it already. This is the
    // sharing post level exists to provide, and the previous ancestors-only
    // scope set did not: an LC's news now reaches its sister LCs without any
    // editorial act at all.
    await signInAs("lc_president", "/feed", isolate);
    expect(await canSee(page, path, title)).toBe(true);

    // A member of Fartown, in the other MC, does not.
    await signInAs("far_member", "/feed", isolate);
    expect(await canSee(page, path, title)).toBe(false);

    await signInAs("mc_president", "/feed", isolate);
    await page.goto(path);
    await promote(page, "Worth the whole network's attention, for the suite's purposes.");
    await expect(promotionPanel(page).getByText(/every MC sees this post/i)).toBeVisible({
      timeout: 15_000,
    });

    await signInAs("far_member", "/feed", isolate);
    expect(await canSee(page, path, title)).toBe(true);
  });

  test("the promotion budget is spent, not lent", async ({ page, signInAs }, testInfo) => {
    test.setTimeout(150_000);
    const isolate = isolationId(testInfo);
    const firstTitle = uniqueTitle("E2E budget first");
    const secondTitle = uniqueTitle("E2E budget second");

    // Farland's own MCP and Farland's own budget, untouched by the tests above.
    await signInAs("far_mc_president", "/feed", isolate);

    // The first post takes the composer's route: promoted at publication rather
    // than in a second visit. Same permission, same budget, same mandatory note.
    const firstPath = await publish(
      page,
      firstTitle,
      "Spending Farland's only promotion for this window."
    );
    await expect(promotionPanel(page).getByText(/every MC sees this post/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(promotionPanel(page)).toContainText(/0 of 1 promotion left/i);

    const secondPath = await publish(page, secondTitle);

    // Back to the first post — publishing the second navigated away from it.
    await page.goto(firstPath);

    // Demote it. The post goes back to local; the window's promotion does not
    // come back with it, or promote/demote cycling would
    // be an unbounded reach budget — so the budget still reads as spent.
    await page.getByRole("button", { name: /^return to local$/i }).click();
    await expect(promotionPanel(page).getByText(/only your MC/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(promotionPanel(page)).toContainText(/0 of 1 promotion left/i);

    // A hard stop, not a queue: the second post cannot take the refunded slot,
    // because there is no refunded slot.
    await page.goto(secondPath);
    await expect(promotionPanel(page)).toContainText(/0 of 1 promotion left/i);
    await expect(page.getByRole("button", { name: /^promote to the network$/i })).toBeDisabled();

    // But the first post may be promoted again. That window already paid for
    // this post's reach, and charging for it twice would make demotion a trap
    // rather than a reversal.
    await page.goto(firstPath);
    await promote(page, "Restoring the reach this window already paid for.");
    await expect(promotionPanel(page).getByText(/every MC sees this post/i)).toBeVisible({
      timeout: 15_000,
    });

    // The second post never travelled.
    await signInAs("member", "/feed", isolate);
    expect(await canSee(page, secondPath, secondTitle)).toBe(false);
    expect(await canSee(page, firstPath, firstTitle)).toBe(true);
  });
});
