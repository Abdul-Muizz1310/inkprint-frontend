import "server-only";
import { unstable_cache } from "next/cache";
import { ApiError, createApiClient, type Transport } from "@/lib/api-client";
import { env } from "@/lib/env";
import {
  loadSigningKey,
  mintPlatformToken,
  PLATFORM_TOKEN_HEADER,
  SIGNING_KEY_ENV,
} from "./platform-token";

/**
 * The backend client for server code: the certificate RSC (spec 04 §3). It
 * calls the backend directly, never through the app's own proxy route, with a
 * token minted for this one request. The key is resolved before the fetch, so a
 * missing or malformed key rejects with ApiError(503) and nothing is sent:
 * there is no unsigned path.
 */

const signedTransport: Transport = (path, init) => {
  const key = loadSigningKey(process.env[SIGNING_KEY_ENV]);
  if (!key.ok) {
    console.error(
      `[backend-api] ${SIGNING_KEY_ENV} is ${key.reason}; refusing to call the backend`,
    );
    return Promise.reject(new ApiError(503, { error: "proxy not configured" }));
  }
  return fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, [PLATFORM_TOKEN_HEADER]: mintPlatformToken(key.key) },
    // A fresh token per call makes every fetch a data-cache miss anyway (Next
    // keys the fetch cache on request headers); caching happens a level up.
    cache: "no-store",
  });
};

const client = createApiClient(signedTransport);

/**
 * Certificates are immutable once issued, so the parsed metadata is cached for
 * an hour per id (OPT-1): a widely shared, QR-linked certificate does not
 * re-wake the cold-start backend on every view. A rejection (404, 503) is never
 * cached.
 */
export const getCertificate = unstable_cache(
  async (id: string) => client.getCertificate(id),
  ["inkprint-certificate"],
  { revalidate: 3600 },
);
