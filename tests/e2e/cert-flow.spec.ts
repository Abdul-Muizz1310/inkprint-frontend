import { expect, test } from "@playwright/test";

// Deterministic fixture — a plausible short paragraph that is unique enough
// to not collide with real content but long enough to look like a real body.
const FIXTURE_TEXT =
  "The inkprint end-to-end test creates a certificate from a known string " +
  "so the backend's response shape and CORS contract stay pinned. " +
  "Run id: e2e-cert-flow.";
const FIXTURE_AUTHOR = "e2e@inkprint.local";

test.describe("fingerprint happy path", () => {
  test("paste text → issue cert → see styled card", async ({ page }) => {
    // Step 1 — landing page renders editor + author + disclaimer.
    await page.goto("/");
    await expect(page.getByTestId("editor-root")).toBeVisible();
    await expect(page.getByTestId("editor-author-input")).toBeVisible();
    await expect(page.getByTestId("editor-fingerprint-button")).toBeVisible();
    await expect(page.getByTestId("legal-disclaimer")).toBeVisible();

    // Step 2 — fill editor + author, submit.
    await page.getByTestId("editor-root").click();
    await page.keyboard.type(FIXTURE_TEXT);
    await page.getByTestId("editor-author-input").fill(FIXTURE_AUTHOR);
    await page.getByTestId("editor-fingerprint-button").click();

    // Step 3 — wait for navigation to /certificates/<uuid>.
    // Backend cold-start on Render free can push the POST past 20s; give it
    // room plus the RSC page load for the certificate page.
    await page.waitForURL(/\/certificates\/[0-9a-f-]{36}$/, { timeout: 90_000 });

    // Step 4 — certificate page renders every payoff element.
    await expect(page.getByTestId("cert-headline")).toBeVisible();
    await expect(page.getByTestId("cert-headline")).toContainText(/certificate of authorship/i);
    await expect(page.getByTestId("cert-author")).toContainText(FIXTURE_AUTHOR);
    await expect(page.getByTestId("cert-hash")).toContainText("…");
    await expect(page.getByTestId("cert-issued-at")).toContainText("UTC");
    await expect(page.getByTestId("cert-key-id")).toBeVisible();
    await expect(page.getByTestId("cert-qr")).toBeVisible();
    await expect(page.getByTestId("cert-verify-footer")).toBeVisible();
    await expect(page.getByTestId("cert-download-manifest")).toBeVisible();
    await expect(page.getByTestId("cert-share")).toBeVisible();
  });
});
