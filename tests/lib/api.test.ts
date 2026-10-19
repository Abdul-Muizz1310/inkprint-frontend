import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createCertificate,
  createLeakScan,
  diffText,
  getCertificate,
  getCertificateManifest,
  getLeakScan,
  isTimeoutError,
  verifyManifest,
} from "@/lib/api";
import { MAX_TEXT_BYTES } from "@/lib/constants";

// Browser calls go through the same-origin signing proxy (spec 04), never to
// the backend's origin.
const API = "/api/backend";

const validCertBody = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  author: "test@example.com",
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

function mockFetch(body: unknown, init?: { status?: number; contentType?: string }) {
  const status = init?.status ?? 200;
  const contentType = init?.contentType ?? "application/json";
  return vi.fn(async (_url?: string | URL, _init?: RequestInit) => {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": contentType },
    });
  });
}

describe("api.ts", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("createCertificate", () => {
    it("returns a parsed certificate on 201", async () => {
      const fetchMock = mockFetch(validCertBody, { status: 201 });
      vi.stubGlobal("fetch", fetchMock);

      const result = await createCertificate({ text: "hi", author: "a@b.c" });

      expect(result.id).toBe(validCertBody.id);
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/certificates`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({ text: "hi", author: "a@b.c" }),
        }),
      );
    });

    it("throws ApiError on 422", async () => {
      const fetchMock = mockFetch({ detail: [{ msg: "bad" }] }, { status: 422 });
      vi.stubGlobal("fetch", fetchMock);

      await expect(createCertificate({ text: "", author: "" })).rejects.toBeInstanceOf(ApiError);
    });

    it("throws ApiError on 500", async () => {
      vi.stubGlobal("fetch", mockFetch({ detail: "boom" }, { status: 500 }));
      await expect(createCertificate({ text: "hi", author: "a@b.c" })).rejects.toMatchObject({
        status: 500,
      });
    });

    it("throws ApiError on network failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("network down");
        }),
      );
      await expect(createCertificate({ text: "hi", author: "a@b.c" })).rejects.toBeInstanceOf(
        ApiError,
      );
    });

    it("throws ApiError with 'network error' when fetch throws a non-Error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw "string error";
        }),
      );
      const err = await createCertificate({ text: "hi", author: "a@b.c" }).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.body).toBe("network error");
    });

    // 1 MiB cap (02 LOW): the real defense is failing closed at this boundary,
    // not the Editor's disabled button. A direct call with oversized text must
    // be rejected *before* any bytes hit the cold-start backend.
    describe("MAX_TEXT_BYTES enforcement", () => {
      it("rejects text over the byte cap with ApiError(413) and never calls fetch", async () => {
        const fetchMock = mockFetch(validCertBody, { status: 201 });
        vi.stubGlobal("fetch", fetchMock);

        const oversized = "a".repeat(MAX_TEXT_BYTES + 1);
        const err = await createCertificate({ text: oversized, author: "a@b.c" }).catch((e) => e);

        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(413);
        // Fail closed: no network round-trip for a payload we already know is
        // over the limit.
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("rejects a multibyte payload whose .length is under the cap but bytes are over", async () => {
        const fetchMock = mockFetch(validCertBody, { status: 201 });
        vi.stubGlobal("fetch", fetchMock);

        // "€" is 3 UTF-8 bytes; .length is well under the cap, bytes are over.
        const text = "€".repeat(MAX_TEXT_BYTES / 2);
        const err = await createCertificate({ text, author: "a@b.c" }).catch((e) => e);

        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(413);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("allows text exactly at the cap through to the backend", async () => {
        const fetchMock = mockFetch(validCertBody, { status: 201 });
        vi.stubGlobal("fetch", fetchMock);

        const atCap = "a".repeat(MAX_TEXT_BYTES);
        await createCertificate({ text: atCap, author: "a@b.c" });
        expect(fetchMock).toHaveBeenCalledOnce();
      });
    });
  });

  describe("getCertificate", () => {
    it("parses a 200 response, with the certificate's text", async () => {
      vi.stubGlobal("fetch", mockFetch(validCertBody));
      const result = await getCertificate(validCertBody.id);
      expect(result.author).toBe(validCertBody.author);
      expect(result.text).toBe("the certified words");
    });

    it("throws when the backend sends no text (parse, don't cast)", async () => {
      const { text: _text, ...withoutText } = validCertBody;
      vi.stubGlobal("fetch", mockFetch(withoutText));
      await expect(getCertificate(validCertBody.id)).rejects.toThrow();
    });

    it("throws on malformed body", async () => {
      vi.stubGlobal("fetch", mockFetch({ id: "not-a-uuid" }));
      await expect(getCertificate("x")).rejects.toThrow();
    });
  });

  describe("getCertificateManifest", () => {
    it("returns the Zod-parsed manifest object", async () => {
      vi.stubGlobal("fetch", mockFetch({ foo: "bar" }));
      const result = await getCertificateManifest(validCertBody.id);
      expect(result).toEqual({ foo: "bar" });
    });

    it("throws when the manifest is not a JSON object (parse, don't cast)", async () => {
      // A bare array is valid JSON but not a manifest record — the raw `as`
      // cast this replaced would have let it through untyped.
      vi.stubGlobal("fetch", mockFetch(["not", "an", "object"]));
      await expect(getCertificateManifest(validCertBody.id)).rejects.toThrow();
    });
  });

  describe("verifyManifest", () => {
    it("forwards the manifest + text body", async () => {
      const fetchMock = mockFetch({ valid: true, checks: {}, warnings: [] });
      vi.stubGlobal("fetch", fetchMock);

      const result = await verifyManifest({
        manifest: { a: 1 },
        text: "original",
      });
      expect(result.valid).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/verify`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ manifest: { a: 1 }, text: "original" }),
        }),
      );
    });
  });

  describe("diffText", () => {
    it("returns a parsed diff response", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch({
          hamming: 4,
          cosine: 0.9,
          verdict: "near-duplicate",
          overlap_pct: 88,
          changed_spans: [],
        }),
      );
      const result = await diffText({
        parent_id: "550e8400-e29b-41d4-a716-446655440000",
        text: "new",
      });
      expect(result.verdict).toBe("near-duplicate");
    });
  });

  describe("createLeakScan", () => {
    it("returns a 202 body", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(
          {
            scan_id: "550e8400-e29b-41d4-a716-446655440000",
            status: "pending",
          },
          { status: 202 },
        ),
      );
      const result = await createLeakScan({
        certificate_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.status).toBe("pending");
    });
  });

  describe("getLeakScan", () => {
    it("returns a parsed leak scan result", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch({
          scan_id: "550e8400-e29b-41d4-a716-446655440000",
          status: "done",
          hits: [],
        }),
      );
      const result = await getLeakScan("550e8400-e29b-41d4-a716-446655440000");
      expect(result.scan_id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.status).toBe("done");
    });

    it("throws ApiError on 404", async () => {
      vi.stubGlobal("fetch", mockFetch({ detail: "not found" }, { status: 404 }));
      await expect(getLeakScan("missing")).rejects.toBeInstanceOf(ApiError);
    });

    it("throws when the status is not a known enum value (Zod boundary)", async () => {
      // Previously an `as LeakScanResult` cast, so a bogus status masqueraded
      // as typed and drove the terminal's UI branching.
      vi.stubGlobal(
        "fetch",
        mockFetch({ scan_id: "550e8400-e29b-41d4-a716-446655440000", status: "exploded" }),
      );
      await expect(getLeakScan("550e8400-e29b-41d4-a716-446655440000")).rejects.toThrow();
    });
  });

  describe("request timeout (REL-1)", () => {
    it("maps a fetch TimeoutError to ApiError(0, 'timeout')", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new DOMException("The operation timed out.", "TimeoutError");
        }),
      );
      const err = await getCertificate(validCertBody.id).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(0);
      expect(err.body).toBe("timeout");
      expect(isTimeoutError(err)).toBe(true);
    });

    it("isTimeoutError is false for a normal network error", async () => {
      const err = new ApiError(0, "network error");
      expect(isTimeoutError(err)).toBe(false);
    });

    it("passes an abort signal to fetch", async () => {
      const fetchMock = mockFetch(validCertBody);
      vi.stubGlobal("fetch", fetchMock);
      await getCertificate(validCertBody.id);
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  // OPT-1 moved server-side: a browser `fetch` ignores Next's `next` options,
  // and the server client signs each call, so the certificate cache lives in
  // `src/lib/server/backend-api.ts` (unstable_cache). The browser client must
  // not pretend to cache.
  describe("no Next cache options in the browser client", () => {
    it.each([
      ["getCertificate", () => getCertificate(validCertBody.id)],
      ["getCertificateManifest", () => getCertificateManifest(validCertBody.id)],
      ["getLeakScan", () => getLeakScan(validCertBody.id)],
    ])("%s sends no `next` init", async (_name, run) => {
      const fetchMock = mockFetch({ ...validCertBody, scan_id: validCertBody.id, status: "done" });
      vi.stubGlobal("fetch", fetchMock);
      await run().catch(() => {});
      const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit & { next?: unknown };
      expect(init.next).toBeUndefined();
    });
  });

  describe("every call goes through the proxy (P14)", () => {
    it.each([
      [
        "createCertificate",
        () => createCertificate({ text: "hi", author: "a@b.c" }),
        "/certificates",
      ],
      [
        "getCertificate",
        () => getCertificate(validCertBody.id),
        `/certificates/${validCertBody.id}`,
      ],
      [
        "getCertificateManifest",
        () => getCertificateManifest(validCertBody.id),
        `/certificates/${validCertBody.id}/manifest`,
      ],
      ["verifyManifest", () => verifyManifest({ manifest: {} }), "/verify"],
      ["diffText", () => diffText({ parent_id: validCertBody.id, text: "x" }), "/diff"],
      ["createLeakScan", () => createLeakScan({ certificate_id: validCertBody.id }), "/leak-scan"],
      ["getLeakScan", () => getLeakScan(validCertBody.id), `/leak-scan/${validCertBody.id}`],
    ])("%s calls its route through /api/backend", async (_name, run, path) => {
      const fetchMock = mockFetch({});
      vi.stubGlobal("fetch", fetchMock);
      await run().catch(() => {});
      expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/backend${path}`);
    });
  });

  describe("URL encoding (security)", () => {
    it("encodeURIComponent-escapes path segments built from ids", async () => {
      const fetchMock = mockFetch({ detail: "x" }, { status: 404 });
      vi.stubGlobal("fetch", fetchMock);
      await getLeakScan("a/b?c#d").catch(() => {});
      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toBe(`${API}/leak-scan/${encodeURIComponent("a/b?c#d")}`);
      expect(calledUrl).not.toContain("a/b?c#d");
    });
  });

  describe("parseErrorBody", () => {
    it("returns null when response body is not valid JSON", async () => {
      // Force a non-ok response with non-JSON body to exercise the catch in parseErrorBody
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          return new Response("not json at all", {
            status: 400,
            headers: { "content-type": "text/plain" },
          });
        }),
      );
      try {
        await createCertificate({ text: "hi", author: "a@b.c" });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        // When json() fails, parseErrorBody returns null
        expect((err as InstanceType<typeof ApiError>).body).toBeNull();
      }
    });
  });
});
