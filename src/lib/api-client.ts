import { MAX_TEXT_BYTES, textByteLength } from "@/lib/constants";
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
 * Typed HTTP client for the inkprint backend, independent of where the backend
 * is (spec 04 §3): `createApiClient` binds every endpoint to a `Transport`.
 * `api.ts` binds it to the same-origin signing proxy for browser code;
 * `server/backend-api.ts` to a direct, signed transport for server code. This
 * module imports neither, so a client bundle that uses it never reaches the
 * signing code.
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

/** What a transport receives: the request minus where it goes. */
export type TransportInit = {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly cache?: RequestCache;
  readonly signal?: AbortSignal;
};

/** Sends one request for a backend `path` such as `/certificates/<id>`. */
export type Transport = (path: string, init: TransportInit) => Promise<Response>;

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

async function request(
  transport: Transport,
  path: string,
  init: TransportInit = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await transport(path, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...init,
    });
  } catch (err) {
    // A transport that refuses to send (the server client without its key)
    // already speaks ApiError.
    if (err instanceof ApiError) throw err;
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

async function postJson(transport: Transport, path: string, body: unknown): Promise<Response> {
  return request(transport, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type { LeakScanResult } from "@/lib/schemas";

/** Every inkprint endpoint, bound to one transport. */
export function createApiClient(transport: Transport) {
  async function createCertificate(input: {
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
    const response = await postJson(transport, "/certificates", input);
    return CertificateResponse.parse(await response.json());
  }

  /** The certificate with its stored text (the digest preview and the compare
   * page's diff read it from here, never from the `/download` zip). */
  async function getCertificate(id: string): Promise<CertificateDetail> {
    const response = await request(transport, `/certificates/${seg(id)}`);
    return CertificateDetail.parse(await response.json());
  }

  async function getCertificateManifest(id: string): Promise<ManifestResponse> {
    const response = await request(transport, `/certificates/${seg(id)}/manifest`);
    return ManifestResponse.parse(await response.json());
  }

  async function verifyManifest(input: {
    manifest: Record<string, unknown>;
    text?: string;
  }): Promise<VerifyResponse> {
    const response = await postJson(transport, "/verify", input);
    return VerifyResponse.parse(await response.json());
  }

  async function diffText(input: { parent_id: string; text: string }): Promise<DiffResponse> {
    const response = await postJson(transport, "/diff", input);
    return DiffResponse.parse(await response.json());
  }

  async function createLeakScan(input: {
    certificate_id: string;
    corpora?: string[];
  }): Promise<LeakScanResponse> {
    const response = await postJson(transport, "/leak-scan", input);
    return LeakScanResponse.parse(await response.json());
  }

  async function getLeakScan(scan_id: string): Promise<LeakScanResult> {
    const response = await request(transport, `/leak-scan/${seg(scan_id)}`);
    return LeakScanResult.parse(await response.json());
  }

  return {
    createCertificate,
    getCertificate,
    getCertificateManifest,
    verifyManifest,
    diffText,
    createLeakScan,
    getLeakScan,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
