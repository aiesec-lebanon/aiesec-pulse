import type { Page } from "@playwright/test";

import { alertText, expect, isolationId, test } from "./fixtures";

// Every publishing spec signs in as its own publisher: quota is per author per
// period, so a shared account would make the suite order-dependent.

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
  await page.getByRole("button", { name: /post update/i }).click();
}

test.describe("publishing", () => {
  test("a publisher can publish and the post appears on the feed", async ({
    page,
    signInAs,
  }, testInfo) => {
    const title = uniqueTitle("E2E published update");
    await signInAs("publisher", "/feed", isolationId(testInfo));
    await publish(page, title);

    await expect(page).toHaveURL(POST_SLUG_URL);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    await page.goto("/feed");
    await expect(page.getByRole("link", { name: new RegExp(title, "i") }).first()).toBeVisible();
  });

  test("a post carries reading time", async ({ page, signInAs }, testInfo) => {
    const title = uniqueTitle("E2E metadata");
    await signInAs("publisher", "/feed", isolationId(testInfo));
    await publish(page, title, Array(400).fill("word").join(" "));

    // 400 real keystrokes into the editor push submission close to the
    // default assertion timeout — wait for the redirect first, same as the
    // "can publish" test above, rather than racing the two.
    await expect(page).toHaveURL(POST_SLUG_URL);
    await expect(page.getByText(/\d+ min read/).first()).toBeVisible();
  });

  test("validation errors are announced, not silently swallowed", async ({
    page,
    signInAs,
  }, testInfo) => {
    await signInAs("publisher", "/feed", isolationId(testInfo));
    await page.goto("/posts/new");
    await page.locator("#title").fill("ab"); // below the 3-character minimum
    await page.locator("#content").pressSequentially("short");
    await page.getByRole("button", { name: /post update/i }).click();

    await expect(alertText(page).first()).toBeVisible();
    await expect(page).toHaveURL(/\/posts\/new/);
  });

  test("the third post in a week goes to the queue rather than the feed", async ({
    page,
    signInAs,
  }, testInfo) => {
    // Going over quota routes to review rather than blocking the author.
    await signInAs("publisher", "/feed", isolationId(testInfo));

    for (let i = 0; i < 2; i++) {
      await publish(page, uniqueTitle(`E2E quota ${i}`));
      await page.waitForURL(POST_SLUG_URL);
    }

    await publish(page, uniqueTitle("E2E over quota"));
    await expect(page).toHaveURL(/\/posts\/queued/);
    await expect(page.getByRole("heading", { name: /in review/i })).toBeVisible();
  });
});

test.describe("approval queue", () => {
  test("an editor sees a queued post and can approve it", async ({
    page,
    browser,
    signInAs,
  }, testInfo) => {
    const isolate = isolationId(testInfo);
    const title = uniqueTitle("E2E queued for approval");

    await signInAs("publisher", "/feed", isolate);
    for (let i = 0; i < 2; i++) {
      await publish(page, uniqueTitle(`E2E filler ${i}`));
      await page.waitForURL(POST_SLUG_URL);
    }
    await publish(page, title);
    await page.waitForURL(/\/posts\/queued/);

    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await editorPage.goto(
      `/api/auth/mock?persona=editor&isolate=${isolate}&returnTo=${encodeURIComponent("/admin/queue")}`
    );
    await editorPage.waitForURL("**/admin/queue");

    const card = editorPage.locator("article", { hasText: title });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /approve/i }).click();

    await expect(editorPage.locator("article", { hasText: title })).toHaveCount(0);

    await editorPage.goto("/feed");
    await expect(editorPage.getByText(title).first()).toBeVisible();

    await editorContext.close();
  });
});

test.describe("engagement", () => {
  // Swapping the session cookie on one page is simpler than a second context:
  // browser.newContext() does not inherit baseURL from the config.
  async function publishThenViewAsMember(
    page: Page,
    signInAs: (p: "member" | "publisher", returnTo?: string, isolate?: string) => Promise<void>,
    isolate: string,
    title: string
  ): Promise<void> {
    await signInAs("publisher", "/feed", isolate);
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
    await page.getByRole("button", { name: /^post$/i }).click();

    await expect(page.getByText(body)).toBeVisible();
  });
});
