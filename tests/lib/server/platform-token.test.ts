// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loadSigningKey, mintPlatformToken, SIGNING_KEY_ENV } from "@/lib/server/platform-token";
import { decodePart, ed25519Pair, rsaPrivateB64, verifiesWith, x25519PrivateB64 } from "./keys";

const pair = ed25519Pair();
const other = ed25519Pair();

function key() {
  const loaded = loadSigningKey(pair.privateB64);
  if (!loaded.ok) throw new Error("test key did not load");
  return loaded.key;
}

describe("loadSigningKey", () => {
  it("names the server-only variable", () => {
    expect(SIGNING_KEY_ENV).toBe("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE");
  });

  it("P5 loads an Ed25519 PKCS#8 key, also wrapped in a BOM and a CRLF", () => {
    expect(loadSigningKey(pair.privateB64).ok).toBe(true);
    expect(loadSigningKey(`﻿${pair.privateB64}\r\n`).ok).toBe(true);
  });

  it.each([undefined, "", "  "])("F1 %j is missing", (raw) => {
    expect(loadSigningKey(raw)).toEqual({ ok: false, reason: "missing" });
  });

  it.each([
    ["not base64", "%%%%"],
    ["junk bytes", Buffer.from("not a key at all").toString("base64")],
    ["an SPKI public key", pair.publicB64],
    ["an RSA key", rsaPrivateB64()],
    ["an X25519 key", x25519PrivateB64()],
  ])("F1 %s is malformed", (_label, raw) => {
    expect(loadSigningKey(raw)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("mintPlatformToken", () => {
  const NOW = 1_760_000_000_500;

  it("P4 verifies against the public key in the backend's format, with the §1 claims", () => {
    const token = mintPlatformToken(key(), NOW, "11111111-1111-4111-8111-111111111111");
    const [header, claims] = token.split(".");
    expect(verifiesWith(token, pair.publicB64)).toBe(true);
    expect(decodePart(header)).toEqual({
      alg: "EdDSA",
      typ: "JWT",
      kid: "inkprint-frontend-2026-10",
    });
    expect(decodePart(claims)).toEqual({
      iss: "inkprint-frontend",
      aud: "inkprint",
      sub: "inkprint-frontend",
      role: "frontend",
      service: "inkprint",
      iat: 1_760_000_000,
      exp: 1_760_000_060,
      jti: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("P4 two mints carry different UUID v4 jtis", () => {
    const a = decodePart(mintPlatformToken(key(), NOW).split(".")[1]);
    const b = decodePart(mintPlatformToken(key(), NOW).split(".")[1]);
    expect(a.jti).not.toBe(b.jti);
    expect(String(a.jti)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("F2 does not verify against another key, nor after its claims change", () => {
    const token = mintPlatformToken(key(), NOW);
    expect(verifiesWith(token, other.publicB64)).toBe(false);
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ aud: "magpie" })).toString("base64url");
    expect(verifiesWith(`${h}.${forged}.${s}`, pair.publicB64)).toBe(false);
  });
});
