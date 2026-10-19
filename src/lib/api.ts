import { MAX_TEXT_BYTES, textByteLength } from "@/lib/constants";
import { env } from "@/lib/env";
import {
  CertificateDetail,
  CertificateResponse,
  DiffResponse,
  LeakScanResponse,
  LeakScanResult,
  ManifestResponse,
  VerifyResponse,
} from "@/lib/schemas";

/**
 * Typed HTTP client for the inkprint backend.
 *
 * Every call parses its response through a Zod schema. Non-2xx responses
 * become `ApiError`. Network failures and timeouts also become `ApiError`
 * (status=0) so callers have a single error type to render.
 *
 * The backend runs on Render's free tier and cold-starts (~20s on the first
 * request of an idle window). Every outbound call is bounded by
 * `REQUEST_TIMEOUT_MS` so a hung backend surfaces a retryable error instead
 * of an indefinite spinner.
 */

/** Upper bound for any single backend request. Covers a cold start (~20s)
 * plus headroom, then fails loud rather than hanging forever. */
export const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
    this.name = "ApiError";
  }
}

/** True when the error is a client-side timeout (status 0, body "timeout"). */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0 && err.body === "timeout";
}

function apiUrl(path: string): string {
  return `${env.NEXT_PUBLIC_API_URL}${path}`;
}

/** Encode a single path segment built from external (user/route) input. */
function seg(value: string): string {
  return encodeURIComponent(value);
}

async function parseErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...init,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(0, "timeout");
    }
    throw new ApiError(0, err instanceof Error ? err.message : "network error");
  }
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorBody(response));
  }
  return response;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createCertificate(input: {
  text: string;
  author: string;
}): Promise<CertificateResponse> {
  // Fail closed at the choke point, not just at the disabled button: reject
  // oversized text here so a direct/programmatic call can't stream ~MiBs at the
  // cold-start backend either. Mirrors the backend's request-body limit
  // (MAX_TEXT_BYTES); status 413 = Payload Too Large, so existing ApiError
  // catch blocks render it as a normal (client-side, no network) failure.
  const bytes = textByteLength(input.text);
  if (bytes > MAX_TEXT_BYTES) {
    throw new ApiError(413, {
      detail: `text exceeds the ${MAX_TEXT_BYTES}-byte limit (got ${bytes})`,
    });
  }
  const response = await postJson("/certificates", input);
  return CertificateResponse.parse(await response.json());
}

// Certificates are immutable once issued (signed + sealed), so their fetches
// are safely cacheable. This turns a widely-shared/QR-linked certificate into
// an ISR-cached page instead of re-waking the cold-start-prone backend on
// every view. (revalidate: 1h — cheap safety margin over "never changes".)
const IMMUTABLE_CACHE: RequestInit = { next: { revalidate: 3600 } };

/** The certificate with its stored text (the digest preview and the compare
 * page's diff read it from here, never from the `/download` zip). */
export async function getCertificate(id: string): Promise<CertificateDetail> {
  const response = await request(`/certificates/${seg(id)}`, IMMUTABLE_CACHE);
  return CertificateDetail.parse(await response.json());
}

export async function getCertificateManifest(id: string): Promise<ManifestResponse> {
  const response = await request(`/certificates/${seg(id)}/manifest`, IMMUTABLE_CACHE);
  return ManifestResponse.parse(await response.json());
}

export async function verifyManifest(input: {
  manifest: Record<string, unknown>;
  text?: string;
}): Promise<VerifyResponse> {
  const response = await postJson("/verify", input);
  return VerifyResponse.parse(await response.json());
}

export async function diffText(input: { parent_id: string; text: string }): Promise<DiffResponse> {
  const response = await postJson("/diff", input);
  return DiffResponse.parse(await response.json());
}

export async function createLeakScan(input: {
  certificate_id: string;
  corpora?: string[];
}): Promise<LeakScanResponse> {
  const response = await postJson("/leak-scan", input);
  return LeakScanResponse.parse(await response.json());
}

export type { LeakScanResult } from "@/lib/schemas";

export async function getLeakScan(scan_id: string): Promise<LeakScanResult> {
  const response = await request(`/leak-scan/${seg(scan_id)}`);
  return LeakScanResult.parse(await response.json());
}
