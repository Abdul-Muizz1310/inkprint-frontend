import { describe, expect, it } from "vitest";
import { formatIssuedAt, formatKeyId, truncateMiddle } from "@/lib/format";

describe("truncateMiddle", () => {
  it("returns short strings unchanged", () => {
    expect(truncateMiddle("hello", 6, 4)).toBe("hello");
  });

  it("truncates long strings with a middle ellipsis", () => {
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(truncateMiddle(hash, 6, 4)).toBe("e3b0c4…b855");
  });

  it("handles first=0", () => {
    expect(truncateMiddle("abcdefghij", 0, 3)).toBe("…hij");
  });
});

describe("formatIssuedAt", () => {
  it("formats a valid Z timestamp and includes UTC", () => {
    const out = formatIssuedAt("2026-04-10T12:34:56Z");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/UTC/);
  });

  it("converts an offset timestamp to UTC (not local)", () => {
    const out = formatIssuedAt("2026-04-10T14:34:56+02:00");
    // +02:00 → 12:34:56 UTC
    expect(out).toMatch(/12:34:56/);
    expect(out).toMatch(/UTC/);
  });

  it("returns dash on invalid input, never throws", () => {
    expect(formatIssuedAt("not a date")).toBe("—");
  });
});

describe("formatKeyId", () => {
  it("returns first 16 chars of a long key", () => {
    const key = "abcdefghijklmnopqrstuvwxyz0123456789";
    expect(formatKeyId(key)).toBe("abcdefghijklmnop");
  });

  it("returns dash for empty string", () => {
    expect(formatKeyId("")).toBe("—");
  });

  it("returns dash for null", () => {
    expect(formatKeyId(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatKeyId(undefined)).toBe("—");
  });
});
