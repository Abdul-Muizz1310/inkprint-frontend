import { describe, expect, it } from "vitest";
import { checkHealth } from "@/lib/smoke";

// Render backends are billing-suspended (return 503) as of this writing, so
// this tier must never hit the network unconditionally — it would fail CI
// every run. Set SMOKE_HEALTH_URL to a live health endpoint to opt in
// locally or once billing is restored; unset (the CI default), it skips.
const HEALTH_URL = process.env.SMOKE_HEALTH_URL;

describe("smoke: deployed backend /health", () => {
  it.skipIf(!HEALTH_URL)(
    "GET SMOKE_HEALTH_URL returns a healthy (2xx) response",
    async () => {
      const result = await checkHealth(HEALTH_URL);
      expect(result.kind).toBe("ok");
    },
    15_000,
  );
});
