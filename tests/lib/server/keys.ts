import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";

/**
 * Throwaway keys for the proxy tests, made fresh each run. Never a real key.
 * The formats are the deployed ones: the private half PKCS#8 DER base64
 * (`INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE`), the public half SPKI DER base64
 * (`INKPRINT_FRONTEND_SIGNING_KEY_PUBLIC` on the backend).
 */
export type TestKeyPair = { privateB64: string; publicB64: string };

export function ed25519Pair(): TestKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateB64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicB64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
}

export function rsaPrivateB64(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  return privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
}

export function x25519PrivateB64(): string {
  const { privateKey } = generateKeyPairSync("x25519");
  return privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
}

export function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** Verify a compact EdDSA JWS the way the backend does: against the SPKI DER public key. */
export function verifiesWith(token: string, publicB64: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, claims, signature] = parts;
  const key = createPublicKey({
    key: Buffer.from(publicB64, "base64"),
    format: "der",
    type: "spki",
  });
  return verify(
    null,
    Buffer.from(`${header}.${claims}`, "ascii"),
    key,
    Buffer.from(signature, "base64url"),
  );
}
