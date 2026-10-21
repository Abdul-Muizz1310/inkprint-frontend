import { createApiClient, type Transport } from "@/lib/api-client";
import { proxyUrl } from "@/lib/backend-url";

/**
 * The backend client for browser code (spec 04 §3). It calls the same-origin
 * signing proxy `/api/backend/...`, which checks the route, signs each request
 * and forwards it; the browser holds no token, no key and not even the
 * backend's URL. This module must stay free of server-only imports.
 */

const proxyTransport: Transport = (path, init) => fetch(proxyUrl(path), init);

export { ApiError, isTimeoutError, REQUEST_TIMEOUT_MS } from "@/lib/api-client";
export type { LeakScanResult } from "@/lib/schemas";

export const {
  createCertificate,
  getCertificate,
  getCertificateManifest,
  verifyManifest,
  diffText,
  createLeakScan,
  getLeakScan,
} = createApiClient(proxyTransport);
