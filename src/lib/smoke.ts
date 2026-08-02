/**
 * Health-check helper for the smoke test tier.
 *
 * Render backends can be billing-suspended (returning 503) or entirely
 * unreachable independent of this frontend's own correctness, so the
 * decision of "did the deployed backend respond healthy" is isolated here
 * and unit-tested with a mocked `fetch`, while the actual smoke test
 * (`tests/smoke.test.ts`) only fetches for real when explicitly opted in
 * via the `SMOKE_BASE_URL` env var (a bare origin, e.g.
 * `https://inkprint-backend.onrender.com`, with no trailing slash or path —
 * the test appends `/health` itself before calling `checkHealth`).
 */

export type SmokeResult =
  | { kind: "skipped"; reason: string }
  | { kind: "ok"; status: number }
  | { kind: "unhealthy"; status: number }
  | { kind: "unreachable"; error: string };

/**
 * Fetches `url` and classifies the outcome. Returns `{ kind: "skipped" }`
 * without calling `fetchImpl` when `url` is undefined — callers gate the
 * real network hit on an env var being set, so CI can skip cleanly while a
 * deployed backend is down or the var is simply not configured.
 */
export async function checkHealth(
  url: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<SmokeResult> {
  if (!url) {
    return { kind: "skipped", reason: "health check URL env var is unset" };
  }

  try {
    const res = await fetchImpl(url);
    return res.ok ? { kind: "ok", status: res.status } : { kind: "unhealthy", status: res.status };
  } catch (err) {
    return { kind: "unreachable", error: err instanceof Error ? err.message : String(err) };
  }
}
