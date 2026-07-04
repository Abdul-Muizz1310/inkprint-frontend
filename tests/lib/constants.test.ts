import { describe, expect, it } from "vitest";
import { MAX_TEXT_BYTES, textByteLength } from "@/lib/constants";

/**
 * The 1 MiB cap is a contract with inkprint-backend's request-body limit.
 * Pinning it here means the front-end and backend limits can only drift with
 * a failing test — not a silent magic number buried in the Editor component.
 */
describe("MAX_TEXT_BYTES", () => {
  it("is exactly 1 MiB (mirrors the backend request-body limit)", () => {
    expect(MAX_TEXT_BYTES).toBe(1_048_576);
    expect(MAX_TEXT_BYTES).toBe(1024 * 1024);
  });
});

/**
 * The cap is expressed in UTF-8 wire bytes, not UTF-16 code units. These are
 * behavioral (non-tautological) tests: they assert the measurement the guard
 * and the Editor counter both depend on, so a regression to `.length` (which
 * undercounts multibyte text and would let an over-limit payload through)
 * fails here rather than silently in production.
 */
describe("textByteLength", () => {
  it("counts one byte per ASCII character", () => {
    expect(textByteLength("hello")).toBe(5);
    expect(textByteLength("")).toBe(0);
  });

  it("counts UTF-8 bytes, not UTF-16 code units, for multibyte text", () => {
    // "é" is 2 UTF-8 bytes; "€" is 3; "𝔸" (astral) is 4 bytes but .length===2.
    expect(textByteLength("é")).toBe(2);
    expect(textByteLength("€")).toBe(3);
    expect(textByteLength("𝔸")).toBe(4);
    // The failure this guards: JS .length would report 2 for the astral char.
    expect(textByteLength("𝔸")).not.toBe("𝔸".length);
  });

  it("a string one code unit under the cap can still exceed the byte cap", () => {
    // MAX_TEXT_BYTES worth of 3-byte chars is far past the limit in bytes even
    // though its .length is a third of it — proving byte-accounting matters.
    const s = "€".repeat(MAX_TEXT_BYTES / 2);
    expect(s.length).toBeLessThan(MAX_TEXT_BYTES);
    expect(textByteLength(s)).toBeGreaterThan(MAX_TEXT_BYTES);
  });
});
