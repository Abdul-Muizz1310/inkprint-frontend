// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { decodePart, ed25519Pair, verifiesWith } from "./keys";

/**
 * The server-side client (spec 04 §3): direct to the backend, signed per call,
 * never through the app's own proxy. `next/cache` is stubbed to record how the
 * immutable certificate read is cached.
 */

const BACKEND = "http://backend.test";
const ID = "550e8400-e29b-41d4-a716-446655440000";
const pair = ed25519Pair();

const cert = {
  id: ID,
  author: "a@b.c",
  content_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  simhash: 1,
  content_len: 10,
  language: "en",
  issued_at: "2026-04-10T12:34:56Z",
  signature: "sig",
  manifest: {},
  storage_key: "certs/x",
  text: "the certified words",
};

const unstableCache = vi.fn(
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>, _keys?: string[], _opts?: unknown) => fn,
);
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys?: string[], opts?: unknown) =>
    unstableCache(fn, keys, opts),
}));

let fetchMock: Mock<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>;
let api: typeof import("@/lib/server/backend-api");

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BACKEND);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE", pair.privateB64);
  fetchMock = vi.fn(async () => Response.json(cert));
  vi.stubGlobal("fetch", fetchMock);
  unstableCache.mockClear();
  vi.resetModules();
  api = await import("@/lib/server/backend-api");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function upstream(index = 0) {
  const [input, init] = fetchMock.mock.calls[index];
  return { url: String(input), init: init ?? {}, headers: new Headers(init?.headers) };
}

describe("serverApi", () => {
  it("P15 getCertificate calls the backend directly, signed, uncached at the fetch level", async () => {
    const result = await api.getCertificate(ID);
    expect(result.id).toBe(ID);
    expect(result.text).toBe("the certified words");
    const up = upstream();
    expect(up.url).toBe(`${BACKEND}/certificates/${ID}`);
    expect(up.init.cache).toBe("no-store");
    const token = up.headers.get("x-platform-token") ?? "";
    expect(verifiesWith(token, pair.publicB64)).toBe(true);
    expect(decodePart(token.split(".")[1])).toMatchObject({
      iss: "inkprint-frontend",
      aud: "inkprint",
      role: "frontend",
    });
  });

  it("P15 getCertificate is cached a level up: unstable_cache, revalidate 3600, keyed per id", async () => {
    expect(unstableCache).toHaveBeenCalledTimes(1);
    const [fn, keys, opts] = unstableCache.mock.calls[0];
    expect(keys).toEqual(["inkprint-certificate"]);
    expect(opts).toEqual({ revalidate: 3600 });
    // unstable_cache folds the function's arguments into the key: the id must be one.
    expect(fn.length).toBe(1);
  });

  it("each call carries a fresh token", async () => {
    await api.getCertificate(ID);
    await api.getCertificate(ID);
    expect(upstream(0).headers.get("x-platform-token")).not.toBe(
      upstream(1).headers.get("x-platform-token"),
    );
  });

  it("maps a backend 404 to ApiError(404) so the page can call notFound()", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ detail: "Certificate not found" }, { status: 404 }),
    );
    const { ApiError } = await import("@/lib/api-client");
    const err = await api.getCertificate(ID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).status).toBe(404);
  });

  it.each([
    ["missing", ""],
    ["malformed", "c2VjcmV0LWJ1dC1ub3QtYS1rZXk="],
  ])(
    "F7 a %s key throws ApiError(503) and sends nothing; the log names only the variable",
    async (reason, value) => {
      vi.stubEnv("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE", value);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const err = await api.getCertificate(ID).catch((e: unknown) => e);
      expect(err).toMatchObject({ name: "ApiError", status: 503 });
      expect(fetchMock).not.toHaveBeenCalled();
      const logged = log.mock.calls.flat().join(" ");
      expect(logged).toContain("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE");
      expect(logged).toContain(reason);
      if (value) expect(logged).not.toContain(value);
    },
  );
});
