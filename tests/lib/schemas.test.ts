import { describe, expect, it } from "vitest";
import {
  CertificateResponse,
  DiffResponse,
  DiffVerdict,
  LeakScanResponse,
  VerifyResponse,
} from "@/lib/schemas";

const validCert = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  author: "test@example.com",
  content_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  simhash: 1234567890,
  content_len: 42,
  language: "en",
  issued_at: "2026-04-10T12:34:56Z",
  signature: "base64-sig",
  manifest: { signer: { key_id: "abc" } },
  storage_key: "certs/abc.txt",
};

describe("CertificateResponse", () => {
  it("parses a valid certificate", () => {
    const parsed = CertificateResponse.parse(validCert);
    expect(parsed.id).toBe(validCert.id);
    expect(parsed.author).toBe(validCert.author);
  });

  it("throws on missing id", () => {
    const { id: _id, ...rest } = validCert;
    expect(() => CertificateResponse.parse(rest)).toThrow();
  });

  it("allows language: null", () => {
    const parsed = CertificateResponse.parse({ ...validCert, language: null });
    expect(parsed.language).toBeNull();
  });

  it("passes through unknown extra fields", () => {
    expect(() =>
      CertificateResponse.parse({ ...validCert, extra_future_field: "x" }),
    ).not.toThrow();
  });
});

describe("VerifyResponse", () => {
  it("parses a valid verify response", () => {
    const parsed = VerifyResponse.parse({
      valid: true,
      checks: { signature: true, hash: true, timestamp: true },
      warnings: [],
    });
    expect(parsed.valid).toBe(true);
    expect(parsed.checks.signature).toBe(true);
  });

  it("throws when checks contains a non-boolean", () => {
    expect(() =>
      VerifyResponse.parse({
        valid: true,
        checks: { signature: "yes" },
        warnings: [],
      }),
    ).toThrow();
  });
});

describe("DiffResponse", () => {
  it("parses a valid diff response", () => {
    const parsed = DiffResponse.parse({
      hamming: 3,
      cosine: 0.95,
      verdict: "derivative",
      overlap_pct: 72,
      changed_spans: [],
    });
    expect(parsed.verdict).toBe("derivative");
  });

  it("throws on unknown verdict", () => {
    expect(() =>
      DiffResponse.parse({
        hamming: 0,
        cosine: 1,
        verdict: "mystery",
        overlap_pct: 100,
        changed_spans: [],
      }),
    ).toThrow();
  });

  it("defaults changed_spans to []", () => {
    const parsed = DiffResponse.parse({
      hamming: 0,
      cosine: 1,
      verdict: "identical",
      overlap_pct: 100,
    });
    expect(parsed.changed_spans).toEqual([]);
  });
});

describe("LeakScanResponse", () => {
  it("parses a valid leak-scan response", () => {
    const parsed = LeakScanResponse.parse({
      scan_id: "550e8400-e29b-41d4-a716-446655440000",
      status: "pending",
    });
    expect(parsed.status).toBe("pending");
  });

  it("throws on unknown status", () => {
    expect(() =>
      LeakScanResponse.parse({
        scan_id: "550e8400-e29b-41d4-a716-446655440000",
        status: "exploded",
      }),
    ).toThrow();
  });
});

describe("DiffVerdict", () => {
  it.each([
    ["identical"],
    ["near-duplicate"],
    ["derivative"],
    ["inspired"],
    ["unrelated"],
  ])("accepts %s", (v) => {
    expect(() => DiffVerdict.parse(v)).not.toThrow();
  });
});
