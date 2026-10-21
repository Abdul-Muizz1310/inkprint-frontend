// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  base64url,
  parseKeyEnv,
  signingInput,
  TOKEN_HEADER,
  TOKEN_TTL_SECONDS,
  tokenClaims,
} from "@/lib/server/token-claims";
import { ed25519Pair } from "./keys";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("base64url", () => {
  it.each([
    ["", ""],
    ["f", "Zg"],
    ["fo", "Zm8"],
    ["foo", "Zm9v"],
    ["foob", "Zm9vYg"],
    ["fooba", "Zm9vYmE"],
    ["foobar", "Zm9vYmFy"],
  ])("P1 encodes the RFC 4648 vector %j without padding", (input, expected) => {
    expect(base64url(bytes(input))).toBe(expected);
  });

  it("P1 uses the URL-safe alphabet (- and _, never + or /)", () => {
    expect(base64url(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe("-_-_");
  });
});

describe("token header and claims (contract v2 §1)", () => {
  it("P2 the header is exactly EdDSA / JWT / the frontend's key id", () => {
    expect(JSON.stringify(TOKEN_HEADER)).toBe(
      '{"alg":"EdDSA","typ":"JWT","kid":"inkprint-frontend-2026-10"}',
    );
  });

  it("P3 the claims for a given now: iss, aud, sub, role, service, whole-second iat, 60 s, jti", () => {
    const claims = tokenClaims(1_760_000_000_999, "8a6e0804-2bd0-4672-b79d-d97027f9071a");
    expect(JSON.stringify(claims)).toBe(
      JSON.stringify({
        iss: "inkprint-frontend",
        aud: "inkprint",
        sub: "inkprint-frontend",
        role: "frontend",
        service: "inkprint",
        iat: 1_760_000_000,
        exp: 1_760_000_060,
        jti: "8a6e0804-2bd0-4672-b79d-d97027f9071a",
      }),
    );
    expect(TOKEN_TTL_SECONDS).toBe(60);
  });

  it("P3 aud is a single string naming inkprint, never a list or another service", () => {
    const { aud, service } = tokenClaims(0, "j");
    expect(aud).toBe("inkprint");
    expect(service).toBe("inkprint");
  });

  it("P4 the signing input is base64url(header) . base64url(claims)", () => {
    const claims = tokenClaims(0, "j");
    const [h, c, ...rest] = signingInput(TOKEN_HEADER, claims).split(".");
    expect(rest).toEqual([]);
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual(TOKEN_HEADER);
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toEqual(claims);
    expect(h).not.toMatch(/[=+/]/);
    expect(c).not.toMatch(/[=+/]/);
  });
});

describe("parseKeyEnv", () => {
  const { privateB64 } = ed25519Pair();

  it("P5 decodes strict base64 to DER bytes", () => {
    const parsed = parseKeyEnv(privateB64);
    expect(parsed.kind).toBe("der");
    if (parsed.kind === "der") {
      expect(Buffer.from(parsed.der).toString("base64")).toBe(privateB64);
    }
  });

  it("P5 strips a byte-order mark and a trailing CRLF first", () => {
    expect(parseKeyEnv(`﻿${privateB64}\r\n`).kind).toBe("der");
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["only whitespace", " \r\n\t"],
    ["only a byte-order mark", "﻿"],
  ])("F1 %s is missing", (_label, raw) => {
    expect(parseKeyEnv(raw)).toEqual({ kind: "missing" });
  });

  it.each([
    ["a character outside base64", `${privateB64.slice(0, -4)}*AAA`],
    ["the URL-safe alphabet", privateB64.replace(/\+/g, "-").replace(/\//g, "_").concat("-_AA")],
    ["an inner line break", `${privateB64.slice(0, 20)}\n${privateB64.slice(20)}`],
    ["a length that is not a multiple of 4", privateB64.slice(0, -1)],
    ["padding in the middle", `AA==${privateB64}`],
  ])("F1 %s is malformed", (_label, raw) => {
    expect(parseKeyEnv(raw)).toEqual({ kind: "malformed" });
  });
});
