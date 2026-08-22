import type { Page } from "@playwright/test";

import { FEED_MODE_COOKIE } from "@/lib/feed-mode";

import { alertText, expect, isolationId, type SignInAs, test } from "./fixtures";

// Every publishing spec signs in as its own publisher: quota is per author per
// period, so a shared account would make the suite order-dependent.
//
// The org tree these personas sit in is defined by the GIS fixtures
// (e2e/gis-stub/fixtures.ts): one region over two MCs — "AIESEC in Testonia"
// with the LCs Testville and Otherton beneath it, and "AIESEC in Farland" with
// Fartown. `lc_vp` and `member` share Testville, so a member can see what a
// publisher publishes; `lc_president` holds Otherton, which post level now
// makes visible to them as a sibling LC. "Outside the viewer's scope" means the
// other MC, which is what the search spec below asserts against.

const uniqueTitle = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const BODY = "A test update from the end-to-end suite, long enough to satisfy the minimum length.";

// The negative lookahead matters: /posts/new and /posts/queued both satisfy a
// bare slug pattern, so waitForURL would resolve on the composer.
const POST_SLUG_URL = /\/posts\/(?!new$|queued$)[a-z0-9-]+$/;

// Located by id: the labels carry a required-marker span, which makes a text
// match brittle.
//
// #content is TipTap's contenteditable root, not a <textarea> — .fill() only
// sets textContent and doesn't reliably reach ProseMirror's own model, so
// this drives it with real keystrokes the way an author actually would.
async function publish(page: Page, title: string, body = BODY) {
  await page.goto("/posts/new");
  await page.locator("#title").fill(title);
  await page.locator("#content").pressSequentially(body);
  await page.getByRole("button", { name: /^publish$/i }).click();
}

// Feature flags belong to the credential admin, not to any AIESEC position —
// this drives the real console rather than writing to the database directly.
async function ensureFlagEnabled(page: Page, key: string) {
  await page.goto("/admin/flags");
  const button = page.getByRole("listitem").filter({ hasText: key }).getByRole("button");
  if ((await button.getAttribute("aria-pressed")) === "false") {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
}

/**
 * "For you" is the default feed mode, and it ranks on engagement as well as
 * recency (lib/feed.ts) — so a brand-new post with no reactions legitimately
 * loses its place among the seven cards the page renders to an older one that
 * has some. That is the ranking working, not the publish failing.
 *
 * Latest is the unranked escape hatch, and it is the only surface on which
 * "the post I just published is there" is a guarantee. Asserting the heading
 * afterwards keeps the tab-absent case honest: if the toggle never switched,
 * the h1 still reads "For you" and the test says so.
 */
async function openLatestFeed(page: Page) {
  // The mode is a cookie (lib/feed-mode.ts). Setting it is the same state a
  // reader who has already chosen Latest arrives with, and it keeps these two
  // tests — which are about publishing and following — off the toggle widget's
  // own timing: FeedModeToggle disables its tablist for the whole of the RSC
  // re-render the switch triggers, which against the remote database is
  // routinely longer than an assertion budget.
  await page
    .context()
    .addCookies([{ name: FEED_MODE_COOKIE, value: "latest", url: new URL(page.url()).origin }]);
  await page.goto("/feed");
  await expect(page.getByRole("heading", { level: 1, name: /^latest$/i })).toBeVisible();
}

// GIS carries no timezone, so every account reconciled from it takes the
// schema's default (UTC). Formatting in UTC is therefore exactly what the
// composer's zone-aware conversion should turn back into this same instant.
function toWallTimeUtc(date: Date): string {
  return date.toISOString().slice(0, 16);
}

test.describe("publishing", () => {
  test("a publisher can publish and the post appears on the feed", async ({
    page,
    signInAs,
  }, testInfo) => {
    const title = uniqueTitle("E2E published update");
    await signInAs("lc_vp", "/feed", isolationId(testInfo));
    await publish(page, title);

    // The same 15s the rest of this file already gives a publish round trip.
    // This case was the one left on the 10s default, on the slowest operation
    // in the suite, which is why it was the one that kept failing.
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    await openLatestFeed(page);
    await expect(page.getByRole("link", { name: new RegExp(title, "i") }).first()).toBeVisible();
  });

  test("a post carries reading time", async ({ page, signInAs }, testInfo) => {
    const title = uniqueTitle("E2E metadata");
    await signInAs("lc_vp", "/feed", isolationId(testInfo));
    await publish(page, title, Array(400).fill("word").join(" "));

    // 400 real keystrokes into the editor push submission close to the
    // default assertion timeout — wait for the redirect first, same as the
    // "can publish" test above, rather than racing the two. A longer post
    // is also long enough that draft autosave (5s debounce) can fire mid-type,
    // so the eventual publish goes through publishDraft's extra lookup rather
    // than createPost's — a couple of round trips slower, hence the longer
    // explicit wait rather than the implicit default.
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });
    await expect(page.getByText(/\d+ min read/).first()).toBeVisible();
  });

  test("validation errors are announced, not silently swallowed", async ({
    page,
    signInAs,
  }, testInfo) => {
    await signInAs("lc_vp", "/feed", isolationId(testInfo));
    await page.goto("/posts/new");
    await page.locator("#title").fill("ab"); // below the 3-character minimum
    await page.locator("#content").pressSequentially("short");
    await page.getByRole("button", { name: /^publish$/i }).click();

    await expect(alertText(page).first()).toBeVisible();
    await expect(page).toHaveURL(/\/posts\/new/);
  });

  test("the third post in a week goes to the queue rather than the feed", async ({
    page,
    signInAs,
  }, testInfo) => {
    // Three full publish cycles against a real database leaves little margin
    // under the 30s default once autosave adds its own background traffic.
    test.setTimeout(60_000);
    // Going over quota routes to review rather than blocking the author.
    await signInAs("lc_vp", "/feed", isolationId(testInfo));

    for (let i = 0; i < 2; i++) {
      await publish(page, uniqueTitle(`E2E quota ${i}`));
      await page.waitForURL(POST_SLUG_URL);
    }

    await publish(page, uniqueTitle("E2E over quota"));
    await expect(page).toHaveURL(/\/posts\/queued/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /in review/i })).toBeVisible();
  });
});

test.describe("approval queue", () => {
  test("an MC vice president approves an LC post and it reaches that LC's members", async ({
    page,
    signInAs,
  }, testInfo) => {
    // Three publish cycles plus three further sign-ins, each a full OAuth round
    // trip — well past the 30s default before the assertions even start.
    test.setTimeout(120_000);
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E queued for approval");

    await signInAs("lc_vp", "/feed", isolate);
    for (let i = 0; i < 2; i++) {
      await publish(page, uniqueTitle(`E2E filler ${i}`));
      await page.waitForURL(POST_SLUG_URL);
    }
    await publish(page, title);
    await page.waitForURL(/\/posts\/queued/);

    // The approver sits a level up: `post.approve` is granted at the MC, and a
    // scoped grant covers the whole subtree beneath it, so an MCVP can act on a
    // post published in either of its LCs.
    await signInAs("mc_vp", "/admin/queue", isolate);

    const card = page.locator("article", { hasText: title });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /approve/i }).click();

    await expect(page.locator("article", { hasText: title })).toHaveCount(0);

    // The author's own profile, not a feed: it lists their posts unranked, so
    // this says "approval published it" without depending on the post winning a
    // place in the seven cards the feed renders — a race every other worker
    // publishing at the same moment takes part in.
    await signInAs("lc_vp", "/profile", isolate);
    const row = page.locator("li", { hasText: title });
    await expect(row.getByText(/^published$/i)).toBeVisible();
    const postPath = new URL(
      (await row.getByRole("link").first().getAttribute("href"))!,
      "http://localhost"
    ).pathname;

    // Then from inside the audience. Post detail applies the same audience
    // filter the feed does and 404s when it does not match, so opening it as a
    // member of the publisher's LC is the visibility assertion — and, unlike a
    // feed check, it cannot be pushed out of view by unrelated traffic.
    await signInAs("member", postPath, isolate);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });
});

test.describe("engagement", () => {
  // Signing in again on the same page is simpler than a second context: the
  // callback replaces the session cookie, and browser.newContext() inherits
  // neither baseURL nor the per-test client IP the sign-in throttle keys on.
  async function publishThenViewAsMember(
    page: Page,
    signInAs: SignInAs,
    isolate: string,
    title: string
  ): Promise<void> {
    await signInAs("lc_vp", "/feed", isolate);
    await publish(page, title);
    await page.waitForURL(POST_SLUG_URL);
    const postPath = new URL(page.url()).pathname;

    await signInAs("member", postPath, isolate);
  }

  test("a member can react, and the control reflects it", async ({ page, signInAs }, testInfo) => {
    await publishThenViewAsMember(
      page,
      signInAs,
      isolationId(testInfo),
      uniqueTitle("E2E reactions")
    );

    await page.getByRole("button", { name: /react to this post/i }).click();
    await expect(page.getByRole("button", { name: /remove your reaction/i })).toBeVisible();
  });

  test("a member can comment and sees it immediately", async ({ page, signInAs }, testInfo) => {
    await publishThenViewAsMember(
      page,
      signInAs,
      isolationId(testInfo),
      uniqueTitle("E2E comments")
    );

    const body = `A comment from the suite ${Date.now()}`;
    await page.getByLabel(/comment text/i).fill(body);
    await page.getByRole("button", { name: /^post comment$/i }).click();

    await expect(page.getByText(body)).toBeVisible();
  });
});

test.describe("scheduling", () => {
  test("a scheduled post publishes once its time is due", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    test.setTimeout(45_000);
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E scheduled");

    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "posts.scheduling");

    await signInAs("lc_vp", "/feed", isolate);
    const scheduledFor = new Date(Date.now() + 2 * 60_000);

    await page.goto("/posts/new");
    await page.locator("#title").fill(title);
    await page.locator("#content").pressSequentially(BODY);
    await page.locator("#scheduledAt").fill(toWallTimeUtc(scheduledFor));
    await page.getByRole("button", { name: /^schedule$/i }).click();

    await expect(page).toHaveURL(/\/posts\/scheduled/, { timeout: 15_000 });

    // No Inngest dev server runs in this test environment (playwright.config.ts
    // has no such webServer) — this fast-forwards past the scheduled instant
    // through the same due-post logic the real cron invokes, rather than
    // waiting out two real minutes.
    const response = await page.request.post("/api/test/publish-scheduled", {
      data: { asOf: new Date(scheduledFor.getTime() + 60_000).toISOString() },
    });
    expect(response.ok()).toBe(true);
    expect((await response.json()).published).toBeGreaterThanOrEqual(1);

    await page.goto("/profile");
    const row = page.locator("li", { hasText: title });
    await expect(row.getByText(/^published$/i)).toBeVisible();
  });

  test("scheduling for a past time is rejected", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "posts.scheduling");

    await signInAs("lc_vp", "/feed", isolate);
    await page.goto("/posts/new");
    await page.locator("#title").fill(uniqueTitle("E2E past schedule"));
    await page.locator("#content").pressSequentially(BODY);

    // .fill() sets the value directly rather than driving the native picker
    // UI, so it isn't stopped by the input's `min` attribute — exercising
    // the same client-side "must be in the future" refine a manually-typed
    // past value would hit, belt-and-suspenders with the server-side check.
    await page.locator("#scheduledAt").fill("2020-01-01T00:00");
    await page.getByRole("button", { name: /^schedule$/i }).click();

    await expect(alertText(page).first()).toBeVisible();
    await expect(page).toHaveURL(/\/posts\/new/);
  });
});

test.describe("audience targeting", () => {
  // `lc_vp` does not hold post.target_beyond, so the composer shows its entity
  // as information rather than a control.
  test("a restricted publisher sees their own entity as a fixed audience, not a picker", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "posts.targeting");

    await signInAs("lc_vp", "/posts/new", isolate);

    await expect(page.getByText(/this post will reach/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Everyone" })).toHaveCount(0);
  });

  // `pai` carries post.target_beyond — the full picker, defaulting to GLOBAL.
  test("the PAI gets the full picker and can publish with it visible", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E audience global");

    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "posts.targeting");
    await signInAs("pai", "/posts/new", isolate);

    await page.locator("#title").fill(title);
    await page.locator("#content").pressSequentially(BODY);
    await page.getByRole("button", { name: "Everyone" }).click();
    await page.getByRole("button", { name: /^publish$/i }).click();

    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });
  });

  test("the entity typeahead searches and reports no matches gracefully", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "posts.targeting");
    await signInAs("pai", "/posts/new", isolate);

    await page.getByRole("button", { name: "A specific entity" }).click();
    await page.getByLabel("Search for an entity").fill("zzz-no-such-entity-zzz");

    await expect(page.getByText(/no matching entity found/i)).toBeVisible();
  });
});

test.describe("topics", () => {
  test("a chosen topic shows on the post, links to its archive, and the archive lists the post", async ({
    page,
    signInAs,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E topic");

    await signInAs("lc_vp", "/posts/new", isolate);
    await page.locator("#title").fill(title);
    await page.locator("#content").pressSequentially(BODY);

    const topicGroup = page.getByRole("group", { name: "Topics" });
    const firstTopic = topicGroup.getByRole("button").first();
    const topicName = (await firstTopic.textContent())?.trim();
    await firstTopic.click();

    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });

    // The chip is its own link, distinct from the card link it sits beside
    // on feed cards (SecondaryPostCard) — verified here via the post detail
    // page, then followed through to the archive. `.first()` disambiguates
    // from any same-named topic chips the related-posts rail may also
    // render further down the page — the post's own chip, right under its
    // heading, is always first in DOM order.
    const chip = page.getByRole("link", { name: topicName, exact: true }).first();
    await expect(chip).toBeVisible();
    await chip.click();

    await expect(page).toHaveURL(/\/topics\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(topicName!);
    // SecondaryPostCard wraps its whole card (title + author + reaction/
    // comment counts) in one link, so the link's own accessible name is a
    // long concatenation of all of it — asserting on the post's own h3
    // heading is the robust way to confirm it's listed here, rather than
    // matching against that full concatenated string.
    await expect(page.getByRole("heading", { level: 3, name: title })).toBeVisible();
  });
});

test.describe("follow and mute", () => {
  test("follows a topic, sees it in the Following settings panel, and can remove it", async ({
    page,
    signInAs,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    await signInAs("member", "/feed", isolate);

    // A fixed, always-seeded topic (prisma/seed.ts) rather than one created
    // by this test — deterministic, unlike which post lands as feed hero.
    await page.goto("/topics/bd");

    // The button updates optimistically the instant it's clicked, before the
    // debounced server write (FollowButton's 300ms, matching ReactionButton's
    // pattern) has necessarily even fired — let alone the Server Action's own
    // round trip (a target-existence check, then a read, then a write,
    // sequential, against a remote database) completing. Waiting for the
    // actual POST response, rather than guessing a fixed delay long enough to
    // cover all of that, is what makes the settings-panel check below a
    // genuine persistence check rather than a race against it.
    const followRequest = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/topics/bd")
    );
    await page.getByRole("button", { name: /^follow business development$/i }).click();
    await expect(
      page.getByRole("button", { name: /^unfollow business development$/i })
    ).toBeVisible();
    await followRequest;

    await page.goto("/settings/following");
    const row = page.getByRole("listitem").filter({ hasText: "Business Development" });
    await expect(row).toBeVisible();
    await expect(row.getByText(/^following$/i)).toBeVisible();

    await row.getByRole("button", { name: /^remove$/i }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Business Development" })
    ).toHaveCount(0);
  });

  test("follows a publisher entity from the feed's hero card", async ({
    page,
    signInAs,
  }, testInfo) => {
    // A publish cycle, a feed-mode switch and a follow round trip, each against
    // the remote database.
    test.setTimeout(60_000);
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E entity follow");

    await signInAs("lc_vp", "/posts/new", isolate);
    await page.locator("#title").fill(title);
    await page.locator("#content").pressSequentially(BODY);
    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });

    // Latest, because the hero is the control this test needs: only
    // HeroRotator carries an entity-follow button (SecondaryPostCard/
    // SidebarPostItem do not), and on Latest the newest post is the
    // rotator's initial active slide by construction. Asserted before the
    // click rather than assumed.
    await openLatestFeed(page);
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();

    const followButton = page.getByRole("button", { name: /^follow /i }).first();
    await followButton.click();
    await expect(page.getByRole("button", { name: /^unfollow /i }).first()).toBeVisible();
  });
});

/**
 * Publishes as the PAI, aimed at one named entity. Only an AI-level class holds
 * `post.target_beyond`, so this is the only persona that can aim a post
 * anywhere but its own entity.
 */
async function publishTargetedAt(
  page: Page,
  signInAs: SignInAs,
  isolate: string,
  title: string,
  entityName: string
) {
  await signInAs("pai", "/posts/new", isolate);
  await page.getByRole("button", { name: "A specific entity" }).click();
  await page.getByLabel("Search for an entity").fill(entityName);
  await page.getByRole("button", { name: new RegExp(entityName) }).click();
  await page.locator("#title").fill(title);
  await page.locator("#content").pressSequentially(BODY);
  await page.getByRole("button", { name: /^publish$/i }).click();
  await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });
}

test.describe("search", () => {
  test("finds a post by keyword, across the viewer's MC and no further", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    // Three full publish flows (each a real, char-by-char TipTap type) plus a
    // flag flip and two entity-typeahead picks is far more sequential browser
    // work than the default 30s budget — every other test here does at most one
    // publish.
    test.setTimeout(120_000);

    const isolate = isolationId(testInfo);
    // Distinctive and unique per run: both posts carry it, so a scope-filter
    // regression that let the second post through would still be caught,
    // rather than the two titles merely not matching the same query.
    const keyword = `kangaroo${Date.now()}`;

    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "search.enabled");
    await ensureFlagEnabled(page, "posts.targeting");

    // Signing in is what materialises an LC as an entity: leaf offices enter the
    // tree when someone holding a position there authenticates, so both targets
    // below have to exist before the typeahead can find them.
    await signInAs("lc_president", "/feed", isolate);
    await signInAs("far_member", "/feed", isolate);

    const visibleTitle = uniqueTitle(`E2E ${keyword} in scope`);
    await signInAs("lc_vp", "/posts/new", isolate);
    await page.locator("#title").fill(visibleTitle);
    await page.locator("#content").pressSequentially(BODY);
    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });

    // Scoped to the *sibling* LC under the same MC. The member sits in the other
    // one, and the local scope set is the MC subtree — so this reaches them,
    // which is the sharing post level exists to provide. Under the previous
    // ancestors-only rule it did not.
    const siblingTitle = uniqueTitle(`E2E ${keyword} sibling LC`);
    await publishTargetedAt(page, signInAs, isolate, siblingTitle, "Otherton");

    // Scoped into the other MC. Nothing but a promotion can carry a post across
    // that boundary, and nobody has promoted this one.
    const farTitle = uniqueTitle(`E2E ${keyword} other MC`);
    await publishTargetedAt(page, signInAs, isolate, farTitle, "Fartown");

    await signInAs("member", "/search", isolate);
    await page.getByRole("searchbox", { name: /^search posts$/i }).fill(keyword);
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByRole("link", { name: visibleTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: siblingTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: farTitle })).toHaveCount(0);
  });

  test("a type filter narrows results to the matching post kind", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    const keyword = `narwhal${Date.now()}`;
    const title = uniqueTitle(`E2E ${keyword} announcement`);

    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "search.enabled");

    await signInAs("lc_vp", "/posts/new", isolate);
    await page.locator("#title").fill(title);
    await page.locator("#content").pressSequentially(BODY);
    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });

    await page.goto("/search");
    await page.getByRole("searchbox", { name: /^search posts$/i }).fill(keyword);
    // Every post from the composer publishes as a STORY (no kind picker
    // exists in it yet) — filtering to a different kind must exclude it,
    // proving the filter is actually applied rather than ignored.
    await page.getByRole("combobox", { name: /^filter by post type$/i }).selectOption("EVENT");
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByRole("link", { name: title })).toHaveCount(0);

    await page.getByRole("combobox", { name: /^filter by post type$/i }).selectOption("STORY");
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });
});
