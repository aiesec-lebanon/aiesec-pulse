import type { Page } from "@playwright/test";

import { expect, isolationId, signInPage, test } from "./fixtures";

/**
 * Post level, end to end. The GIS org tree gives two MCs (Testonia, Farland)
 * so a promoted post reaching a Fartown member is distinguishable from no
 * promotion at all.
 *
 * Serial, not parallel: the promotion budget is one per MC per week, counted
 * per MC (not per account), and demotion doesn't refund it — tests spend a
 * shared non-renewable resource and are ordered to match the budget each needs.
 */
test.describe.configure({ mode: "serial" });

const BODY = "A promotion test from the end-to-end suite, long enough to satisfy the minimum.";

const uniqueTitle = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const POST_SLUG_URL = /\/posts\/(?!new$|queued$)[a-z0-9-]+$/;

/**
 * Publishes as whoever is signed in, returns the post's URL path. A note
 * routes through the composer's own reach control (same budget as the panel).
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
 * Whether the viewer can see a post, asked of the post page (not the feed —
 * "not on the feed" and "not visible" differ, and only the latter is under
 * test). Post detail applies the same visibilityFilter and 404s cleanly.
 */
async function canSee(page: Page, path: string, title: string): Promise<boolean> {
  await page.goto(path);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  return (await heading.textContent())?.includes(title) ?? false;
}

async function promote(page: Page, note: string) {
  // force: true — the only client-side gate on this button is budget
  // availability, never permission (the bypass test above relies on
  // exactly that). A plain click() waits for Playwright's "enabled"
  // actionability check, which can never resolve if a swapped-identity
  // race leaves it looking disabled, turning a fast pass/fail into a
  // 120s hang. Forcing dispatches the click regardless, so the assertion
  // that follows is what actually verifies the outcome.
  await page.getByRole("button", { name: /^promote to the network$/i }).click({ force: true });
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

    // AI sits above the MC tier, so LOCAL has no meaning and there's nothing
    // to choose — the composer states this rather than offering a control.
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

    await signInAs("mc_president", "/feed", isolate);
    await page.goto(path);
    await expect(promotionPanel(page)).toBeVisible();

    // Swaps identity underneath the rendered page: sessions live in the
    // context's cookie jar, so a second sign-in re-points requests while the
    // DOM still shows the control — mc_vp holds no post.promote, so only
    // the server can refuse the write.
    const second = await context.newPage();
    await signInPage(second, "mc_vp", "/feed", isolate);
    await second.close();

    await promote(page, "Bypassing the control to check the server refuses it.");
    // Refusal surfaces in the dialog that submitted it (asked here), not the
    // panel behind it, which has its own live region.
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

    await signInAs("lc_vp", "/feed", isolate);
    const path = await publish(page, title);

    // A sibling LC (Otherton) sees it already — the sharing post level exists
    // for; the old ancestors-only scope set could not do this.
    await signInAs("lc_president", "/feed", isolate);
    expect(await canSee(page, path, title)).toBe(true);

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

    // Demote: post goes back to local, but the window's promotion is not
    // refunded — otherwise promote/demote cycling would be unbounded reach.
    await page.getByRole("button", { name: /^return to local$/i }).click();
    // Matches only the panel's persistent description, not its aria-live
    // announcement ("Returned to local. Only your MC and its LCs can see
    // this post.") — both contain "only your MC", which was a strict-mode
    // violation (2 matches) until this was narrowed to the description's
    // own wording.
    await expect(
      promotionPanel(page).getByText(/only your mc and the lcs beneath it/i)
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(promotionPanel(page)).toContainText(/0 of 1 promotion left/i);

    // A hard stop, not a queue: the second post cannot take the refunded slot,
    // because there is no refunded slot.
    await page.goto(secondPath);
    await expect(promotionPanel(page)).toContainText(/0 of 1 promotion left/i);
    await expect(page.getByRole("button", { name: /^promote to the network$/i })).toBeDisabled();

    // The first post may be promoted again — this window already paid for
    // its reach; charging twice would make demotion a trap, not a reversal.
    await page.goto(firstPath);
    await promote(page, "Restoring the reach this window already paid for.");
    await expect(promotionPanel(page).getByText(/every MC sees this post/i)).toBeVisible({
      timeout: 15_000,
    });

    await signInAs("member", "/feed", isolate);
    expect(await canSee(page, secondPath, secondTitle)).toBe(false);
    expect(await canSee(page, firstPath, firstTitle)).toBe(true);
  });
});
