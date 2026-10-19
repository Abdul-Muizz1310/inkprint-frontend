// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P14 / spec 04 §3-§4: the browser-side modules reach the backend only through
 * `/api/backend`. None may name the backend's URL, and none may import the
 * server-only signing code (Next would fail the build; this fails sooner).
 */
const BROWSER_MODULES = [
  "src/lib/api.ts",
  "src/lib/api-client.ts",
  "src/lib/backend-url.ts",
  "src/lib/sse.ts",
  "src/components/backend-status.tsx",
  "src/components/certificate-card.tsx",
  "src/components/editor.tsx",
  "src/components/leak-terminal.tsx",
  "src/app/compare/page.tsx",
  "src/app/verify/page.tsx",
];

describe("browser boundary", () => {
  it("the proxy prefix is /api/backend", async () => {
    const { BACKEND_PROXY_PREFIX, proxyUrl } = await import("@/lib/backend-url");
    expect(BACKEND_PROXY_PREFIX).toBe("/api/backend");
    expect(proxyUrl("/health")).toBe("/api/backend/health");
  });

  it.each(BROWSER_MODULES)("%s never names the backend URL or the signing code", (file) => {
    const source = readFileSync(path.resolve(__dirname, "../..", file), "utf8");
    expect(source).not.toContain("NEXT_PUBLIC_API_URL");
    expect(source).not.toMatch(/@\/lib\/server\//);
    expect(source).not.toContain("SIGNING_KEY_PRIVATE");
  });
});
