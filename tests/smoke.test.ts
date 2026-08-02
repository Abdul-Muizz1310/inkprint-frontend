import { describe, expect, it } from "vitest";
import { checkHealth } from "@/lib/smoke";

// Render backends are billing-suspended (return 503) as of this writing, so
// this tier must never hit the network unconditionally — it would fail CI
// every run. Set SMOKE_BASE_URL to a live deployed origin (e.g.
// https://inkprint-backend.onrender.com — a bare origin, no trailing slash
// or path; this test joins on /health itself) to opt in locally or once
// billing is restored; unset (the CI default outside the dedicated
// push-gated smoke job), it skips and makes zero HTTP requests.
const BASE_URL = process.env.SMOKE_BASE_URL;

/** Joins `baseUrl` with `/health` using exactly one separator. */
function healthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/health`;
}

describe("smoke: deployed backend /health", () => {
  it.skipIf(!BASE_URL)(
    "GET SMOKE_BASE_URL + /health returns a healthy (2xx) response",
    async () => {
      const result = await checkHealth(BASE_URL && healthUrl(BASE_URL));
      expect(result.kind).toBe("ok");
    },
    15_000,
  );
});
