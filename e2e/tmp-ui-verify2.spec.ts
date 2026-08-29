import type { Page } from "@playwright/test";

import { expect, isolationId, test } from "./fixtures";

const uniqueTitle = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const BODY = "A test update from the end-to-end suite, long enough to satisfy the minimum length.";

const POST_SLUG_URL = /\/posts\/(?!new$|queued$)[a-z0-9-]+$/;

async function publish(page: Page, title: string, body = BODY) {
  await page.goto("/posts/new");
  await page.locator("#title").fill(title);
  await page.locator("#content").pressSequentially(body);
  await page.getByRole("button", { name: /^publish$/i }).click();
}

test("author page links to entity, entity page shows top authors", async ({
  page,
  signInAs,
}, testInfo) => {
  test.setTimeout(90_000);
  const title = uniqueTitle("E2E ui verify entity");
  await signInAs("lc_vp", "/feed", isolationId(testInfo));
  await publish(page, title);
  await expect(page).toHaveURL(POST_SLUG_URL, { timeout: 15_000 });

  // Reach the author's own profile via the trending-authors rail on /feed.
  await page.goto("/feed");
  const trendingGroup = page.getByRole("group", {
    name: "Authors publishing most this month, scrollable",
  });
  const authorLink = trendingGroup.getByRole("link", { name: /Test LCVP/i }).first();
  await expect(authorLink).toBeVisible();
  await authorLink.click();
  await expect(page).toHaveURL(/\/authors\//);

  // The entity name in the author page's eyebrow is now a real link.
  const entityLink = page.getByRole("link", { name: /Testville/i }).first();
  await expect(entityLink).toBeVisible();
  await entityLink.click();
  await expect(page).toHaveURL(/\/entities\//);

  // The entity page shows a "Top authors" section including this author.
  await expect(page.getByRole("heading", { name: /^top authors$/i })).toBeVisible();
  const topAuthorsGroup = page.getByRole("group", { name: /top authors at .*, scrollable/i });
  await expect(topAuthorsGroup.getByRole("link", { name: /Test LCVP/i })).toBeVisible();
});
