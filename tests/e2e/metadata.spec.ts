import { expect, type Page, test } from "@playwright/test";
import { SITE } from "../../src/lib/site/config";

const SCAN_ID = "550e8400-e29b-41d4-a716-446655440000";

// The home page pings /health and a leak-scan page opens its SSE stream from the browser.
// Head tags need neither, so every backend request is refused: this spec never reaches it.
async function stubBackend(page: Page) {
  await page.route(/^https:\/\/inkprint-backend\.onrender\.com\//, (route) =>
    route.fulfill({ status: 503, body: "stubbed" }),
  );
}

const content = (page: Page, selector: string) =>
  page.locator(`head ${selector}`).first().getAttribute("content");

/**
 * A production build puts the share image on metadataBase, the production origin. `next dev`
 * (this config's webServer) puts it on its own origin instead, by design, so the image loads
 * locally. No other origin is acceptable; metadataBase itself is pinned by T-FE-03.
 */
function expectShareImage(url: string | null, page: Page): URL {
  const image = new URL(url ?? "");
  expect([SITE.url, new URL(page.url()).origin]).toContain(image.origin);
  expect(image.pathname).toBe("/opengraph-image");
  return image;
}

test("the home page carries the site's head tags (T-FE-10)", async ({ page, request }) => {
  await stubBackend(page);
  await page.goto("/");
  await expect(page).toHaveTitle(SITE.title);
  expect(await content(page, 'meta[name="description"]')).toBe(SITE.description);
  expect(await content(page, 'meta[property="og:title"]')).toBe(SITE.title);
  const ogImage = expectShareImage(await content(page, 'meta[property="og:image"]'), page);
  expect(await content(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
  expect(await content(page, 'meta[name="twitter:image"]')).toBe(ogImage.href);
  const image = await request.get(`${ogImage.pathname}${ogImage.search}`);
  expect(image.headers()["content-type"]).toMatch(/^image\/png/);
  expect(await content(page, 'meta[name="theme-color"]')).toBe("#0a0a0a");
  await expect(page.locator('head link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1);
});

test("an inner page's own title flows into og:title (T-FE-10)", async ({ page }) => {
  await stubBackend(page);
  await page.goto("/verify");
  await expect(page).toHaveTitle("verify a c2pa manifest — inkprint");
  expect(await content(page, 'meta[property="og:title"]')).toBe(
    "verify a c2pa manifest — inkprint",
  );
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
});

test("a leak-scan page has its own title and stays out of search (T-FE-10)", async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/leak/${SCAN_ID}`);
  await expect(page).toHaveTitle("leak scan 550e8400 — inkprint");
  expect(await content(page, 'meta[property="og:title"]')).toBe("leak scan 550e8400 — inkprint");
  expect(await content(page, 'meta[name="robots"]')).toBe("noindex");
});

test("the home page can be indexed (T-FE-10)", async ({ page }) => {
  await stubBackend(page);
  await page.goto("/");
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
});

test("every metadata route answers with its content type (T-FE-10)", async ({ request }) => {
  const routes: [string, RegExp][] = [
    ["/opengraph-image", /^image\/png/],
    ["/icon.svg", /^image\/svg\+xml/],
    ["/apple-icon.png", /^image\/png/],
    ["/favicon.ico", /^image\/(x-icon|vnd\.microsoft\.icon)/],
    ["/icon-512.png", /^image\/png/],
    ["/manifest.webmanifest", /^application\/manifest\+json/],
    ["/robots.txt", /^text\/plain/],
    ["/sitemap.xml", /^application\/xml/],
  ];
  for (const [path, type] of routes) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toMatch(type);
  }
});
