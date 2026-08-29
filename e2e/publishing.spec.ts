import type { Page } from "@playwright/test";

import { FEED_MODE_COOKIE } from "@/lib/feed-mode";

import { alertText, expect, isolationId, type SignInAs, test } from "./fixtures";

// Every spec signs in as its own publisher — quota is per author per period,
// so a shared account would make tests order-dependent.
//
// Org tree (e2e/gis-stub/fixtures.ts): Testonia (LCs Testville, Otherton) and
// Farland (Fartown) under one region. lc_vp/member share Testville;
// lc_president sits in sibling LC Otherton, visible via post level.
// "Outside scope" means Farland, asserted by the search spec below.

const uniqueTitle = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const BODY = "A test update from the end-to-end suite, long enough to satisfy the minimum length.";

// The negative lookahead matters: /posts/new and /posts/queued both satisfy a
// bare slug pattern, so waitForURL would resolve on the composer.
const POST_SLUG_URL = /\/posts\/(?!new$|queued$)[a-z0-9-]+$/;

// Located by id (label text carries a required-marker span, brittle to match).
// #content is TipTap's contenteditable root, not a textarea — .fill() doesn't
// reliably reach ProseMirror's model, so real keystrokes drive it instead.
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
 * "For you" ranks by engagement too, so a fresh post can lose its spot among
 * the seven cards to an older one with reactions — that's ranking, not a
 * publish failure. Latest is unranked and guarantees the post appears;
 * asserting the heading after catches a toggle that silently didn't switch.
 */
async function openLatestFeed(page: Page) {
  // Feed mode is a cookie (lib/feed-mode.ts); setting it directly avoids
  // FeedModeToggle's own timing (it disables the tablist for the whole RSC
  // re-render, often longer than an assertion budget).
  await page
    .context()
    .addCookies([{ name: FEED_MODE_COOKIE, value: "latest", url: new URL(page.url()).origin }]);
  await page.goto("/feed");
  await expect(page.getByRole("heading", { level: 1, name: /^latest$/i })).toBeVisible();
}

// GIS carries no timezone, so accounts default to UTC — formatting in UTC
// is what the composer's zone-aware conversion should round-trip back to.
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

    // Same 15s the rest of the file gives a publish round trip — this was
    // the one left on the 10s default and kept failing.
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    await openLatestFeed(page);
    await expect(page.getByRole("link", { name: new RegExp(title, "i") }).first()).toBeVisible();
  });

  test("a post carries reading time", async ({ page, signInAs }, testInfo) => {
    const title = uniqueTitle("E2E metadata");
    await signInAs("lc_vp", "/feed", isolationId(testInfo));
    await publish(page, title, Array(400).fill("word").join(" "));

    // 400 keystrokes push close to the default timeout, and can trigger
    // draft autosave (5s debounce) mid-type — publish then goes through
    // publishDraft's extra lookup, a bit slower, hence the longer explicit wait.
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

    // post.approve is granted at the MC; a scoped grant covers the whole
    // subtree, so an MCVP can act on posts from either of its LCs.
    await signInAs("mc_vp", "/review", isolate);

    const card = page.locator("article", { hasText: title });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /approve/i }).click();

    await expect(page.locator("article", { hasText: title })).toHaveCount(0);

    // Author's own profile (unranked), not the feed — avoids the race of
    // winning one of the feed's seven ranked slots against other workers.
    // Only a published post's row is a link at all (PendingRow renders
    // plain text) — that alone is the status signal now, not a label.
    await signInAs("lc_vp", "/profile", isolate);
    const row = page.getByRole("link", { name: title });
    await expect(row).toBeVisible();
    const postPath = new URL((await row.getAttribute("href"))!, "http://localhost").pathname;

    // Post detail applies the same audience filter as the feed (404 on
    // mismatch) — a visibility check immune to the feed's ranking noise.
    await signInAs("member", postPath, isolate);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });
});

test.describe("engagement", () => {
  // Re-signing in on the same page beats a second context: newContext()
  // inherits neither baseURL nor the per-test IP the sign-in throttle keys on.
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

    // No Inngest dev server runs here — this fast-forwards through the same
    // due-post logic the real cron invokes, instead of waiting two minutes.
    const response = await page.request.post("/api/test/publish-scheduled", {
      data: { asOf: new Date(scheduledFor.getTime() + 60_000).toISOString() },
    });
    expect(response.ok()).toBe(true);
    expect((await response.json()).published).toBeGreaterThanOrEqual(1);

    await page.goto("/profile");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
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
    await page.locator("#title").fill(uniqueTitle("E2E past-due post"));
    await page.locator("#content").pressSequentially(BODY);

    // .fill() bypasses the native picker's `min` attribute, so this exercises
    // the client-side "must be in the future" check, plus the server-side one.
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

    // The topic chip is its own link (distinct from the card link on
    // SecondaryPostCard). `.first()` disambiguates from any same-named chips
    // the related-posts rail renders further down — this post's chip is first.
    const chip = page.getByRole("link", { name: topicName, exact: true }).first();
    await expect(chip).toBeVisible();
    await chip.click();

    await expect(page).toHaveURL(/\/topics\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(topicName!);
    // SecondaryPostCard's whole card is one link with a long concatenated
    // accessible name — assert on the h3 heading instead of that string.
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

    // FollowButton updates optimistically before its 300ms-debounced write
    // fires; waiting for the actual POST response (not a guessed delay) is
    // what makes the settings-panel check below a real persistence check.
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

    // Latest, because only HeroRotator has an entity-follow button, and on
    // Latest the newest post is its initial slide by construction — asserted
    // before the click, not assumed.
    await openLatestFeed(page);
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();

    const followButton = page.getByRole("button", { name: /^follow /i }).first();
    await followButton.click();
    await expect(page.getByRole("button", { name: /^unfollow /i }).first()).toBeVisible();
  });
});

/**
 * Publishes as the PAI, aimed at one named entity — only AI-level classes
 * hold post.target_beyond, so only this persona can target elsewhere.
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
    // Three real publish flows plus a flag flip and two typeahead picks is
    // far more sequential work than the default 30s budget covers.
    test.setTimeout(120_000);

    const isolate = isolationId(testInfo);
    // Unique per run and shared by both posts, so a scope-filter regression
    // would still be caught by the query, not just by mismatched titles.
    const keyword = `kangaroo${Date.now()}`;

    await signInAsAdmin("/admin/flags");
    await ensureFlagEnabled(page, "search.enabled");
    await ensureFlagEnabled(page, "posts.targeting");

    // Signing in materialises an LC as an entity — both targets below must
    // sign in first, or the typeahead can't find them.
    await signInAs("lc_president", "/feed", isolate);
    await signInAs("far_member", "/feed", isolate);

    const visibleTitle = uniqueTitle(`E2E ${keyword} in scope`);
    await signInAs("lc_vp", "/posts/new", isolate);
    await page.locator("#title").fill(visibleTitle);
    await page.locator("#content").pressSequentially(BODY);
    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });

    // Scoped to the sibling LC under the same MC — reaches the member via
    // the MC-subtree local scope, which the old ancestors-only rule didn't allow.
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
    // The composer always publishes STORY (no kind picker yet) — filtering to
    // a different kind must exclude it, proving the filter actually applies.
    await page.getByRole("combobox", { name: /^filter by post type$/i }).selectOption("EVENT");
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByRole("link", { name: title })).toHaveCount(0);

    await page.getByRole("combobox", { name: /^filter by post type$/i }).selectOption("STORY");
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  // A freshly admin-created topic, not a seeded one — under fullyParallel,
  // a shared seeded topic could pick up another worker's post mid-run and
  // break the "exactly one" assertion this test exists to make.
  test("a topic filter alone, with no keyword, returns that topic's one post", async ({
    page,
    signInAs,
    signInAsAdmin,
  }, testInfo) => {
    test.setTimeout(60_000);
    const isolate = isolationId(testInfo);
    const topicName = `E2E Solo Topic ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = uniqueTitle("E2E topic-only search");

    await signInAsAdmin("/admin/topics");
    await page.getByLabel("Name").fill(topicName);
    await page.getByRole("button", { name: /^add topic$/i }).click();
    await expect(page.getByRole("listitem").filter({ hasText: topicName })).toBeVisible({
      timeout: 15_000,
    });
    await ensureFlagEnabled(page, "search.enabled");

    await signInAs("lc_vp", "/posts/new", isolate);
    await page.locator("#title").fill(title);
    await page.locator("#content").pressSequentially(BODY);
    await page
      .getByRole("group", { name: "Topics" })
      .getByRole("button", { name: topicName })
      .click();
    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });

    await signInAs("member", "/search", isolate);
    await page
      .getByRole("group", { name: "Topics" })
      .getByRole("button", { name: topicName })
      .click();
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByText("1 result on this page")).toBeVisible();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });
});
