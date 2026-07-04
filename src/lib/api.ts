import { MAX_TEXT_BYTES, PREVIEW_CHARS, textByteLength } from "@/lib/constants";
import { env } from "@/lib/env";
import {
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

export async function getCertificate(id: string): Promise<CertificateResponse> {
  const response = await request(`/certificates/${seg(id)}`, IMMUTABLE_CACHE);
  return CertificateResponse.parse(await response.json());
}

export async function getCertificateDownload(id: string): Promise<string> {
  const response = await request(`/certificates/${seg(id)}/download`, IMMUTABLE_CACHE);
  return response.text();
}

/**
 * Fetch only the leading `maxChars` characters of a certificate body (OPT-2).
 *
 * The certificate page renders a short digest preview, but a body can be up to
 * `MAX_TEXT_BYTES` (~1 MiB). Downloading the whole document to slice 200 chars
 * is pure waste. When the backend supplies `content_preview` the page never
 * calls this at all; when it doesn't, this still avoids the full transfer two
 * complementary ways, neither of which needs a backend change:
 *
 *   1. A `Range: bytes=0-N` request. If the backend honors ranges it returns
 *      just the prefix (HTTP 206) — kilobytes, not a megabyte.
 *   2. Streaming the response and cancelling the reader as soon as we have
 *      enough decoded characters. This bounds the bytes actually pulled over
 *      the wire even when the backend ignores `Range` and answers 200 with the
 *      full body — the transfer is aborted at the network layer mid-stream.
 *
 * Deliberately uncached (`no-store`): Next's data cache buffers the *entire*
 * response to persist it, which would defeat the early-cancel above, and a
 * `Range`/206 partial isn't a sound cache entry. The response is already tiny,
 * so there's nothing worth caching — the immutable cert *metadata* fetch
 * (`getCertificate`) still carries the ISR cache (OPT-1).
 */
export async function getCertificateDownloadPreview(
  id: string,
  maxChars: number = PREVIEW_CHARS,
): Promise<string> {
  // UTF-8 encodes a char in at most 4 bytes; ask for enough window that a
  // Range-honoring backend returns >= maxChars even for all-4-byte text, plus
  // slack for a truncated trailing multibyte sequence.
  const byteWindow = maxChars * 4 + 64;
  const response = await request(`/certificates/${seg(id)}/download`, {
    headers: { Range: `bytes=0-${byteWindow - 1}` },
    cache: "no-store",
  });

  // Some runtimes/mocks expose no streamable body — fall back to buffering the
  // (Range-bounded) text and slicing.
  if (!response.body) {
    return (await response.text()).slice(0, maxChars);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let text = "";
  try {
    while (text.length < maxChars) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) text += decoder.decode(value, { stream: true });
    }
  } finally {
    // Stop pulling the moment we have enough — this is what caps the wire
    // transfer when the backend ignored `Range` and streamed the whole body.
    await reader.cancel().catch(() => {});
  }
  return text.slice(0, maxChars);
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
