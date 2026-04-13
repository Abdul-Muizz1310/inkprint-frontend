import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createCertificate,
  createLeakScan,
  diffText,
  getCertificate,
  getCertificateDownload,
  getCertificateManifest,
  getCertificateQrUrl,
  getLeakScan,
  verifyManifest,
} from "@/lib/api";

const API = "https://inkprint-backend.onrender.com";

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
};

function mockFetch(body: unknown, init?: { status?: number; contentType?: string }) {
  const status = init?.status ?? 200;
  const contentType = init?.contentType ?? "application/json";
  return vi.fn(async () => {
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
  });

  describe("getCertificate", () => {
    it("parses a 200 response", async () => {
      vi.stubGlobal("fetch", mockFetch(validCertBody));
      const result = await getCertificate(validCertBody.id);
      expect(result.author).toBe(validCertBody.author);
    });

    it("throws on malformed body", async () => {
      vi.stubGlobal("fetch", mockFetch({ id: "not-a-uuid" }));
      await expect(getCertificate("x")).rejects.toThrow();
    });
  });

  describe("getCertificateDownload", () => {
    it("returns the raw text body", async () => {
      vi.stubGlobal("fetch", mockFetch("plain text content", { contentType: "text/plain" }));
      const result = await getCertificateDownload(validCertBody.id);
      expect(result).toBe("plain text content");
    });
  });

  describe("getCertificateManifest", () => {
    it("returns the manifest JSON object", async () => {
      vi.stubGlobal("fetch", mockFetch({ foo: "bar" }));
      const result = await getCertificateManifest(validCertBody.id);
      expect(result).toEqual({ foo: "bar" });
    });
  });

  describe("getCertificateQrUrl", () => {
    it("returns the QR URL without calling fetch", () => {
      const url = getCertificateQrUrl("abc");
      expect(url).toBe(`${API}/certificates/abc/qr`);
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
