import "server-only";
import { loadSigningKey, mintPlatformToken, SIGNING_KEY_ENV } from "./platform-token";
import {
  downstreamResponseHeaders,
  MAX_PROXY_BODY_BYTES,
  resolveUpstream,
  upstreamRequestHeaders,
} from "./proxy-rules";

/**
 * The imperative shell of the backend proxy (spec 04 §2): check the route,
 * load the key, mint a token, forward, and stream the answer back. It never
 * sends an unsigned request and never reads the upstream body.
 */

// Statuses whose response must not carry a body (the Response constructor rejects one).
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function refuse(status: 400 | 404 | 413 | 502 | 503, error: string): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

async function readCappedBody(request: Request): Promise<ArrayBuffer | "too-large"> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_PROXY_BODY_BYTES) return "too-large";
  const body = await request.arrayBuffer();
  return body.byteLength > MAX_PROXY_BODY_BYTES ? "too-large" : body;
}

export async function proxyToBackend(
  request: Request,
  segments: readonly string[],
  backendBase: string,
): Promise<Response> {
  const { method } = request;
  const target = resolveUpstream(backendBase, method, segments, new URL(request.url).search);
  if (!target.ok) return refuse(target.status, target.error);

  const signingKey = loadSigningKey(process.env[SIGNING_KEY_ENV]);
  if (!signingKey.ok) {
    console.error(`[api/backend] ${SIGNING_KEY_ENV} is ${signingKey.reason}; refusing to proxy`);
    return refuse(503, "proxy not configured");
  }

  let body: ArrayBuffer | undefined;
  if (method !== "GET") {
    const read = await readCappedBody(request);
    if (read === "too-large") return refuse(413, "payload too large");
    body = read;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.url, {
      method,
      headers: upstreamRequestHeaders(request.headers, mintPlatformToken(signingKey.key)),
      body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch (err) {
    // A closed tab aborts the call too; that is no backend failure to report.
    if (!request.signal.aborted) {
      console.error(`[api/backend] ${method} ${target.url.pathname} failed:`, err);
    }
    return refuse(502, "backend unreachable");
  }

  // The body is handed over as a stream, never read here: SSE arrives event by
  // event, and the QR PNG and the zip arrive byte for byte.
  return new Response(NULL_BODY_STATUSES.has(upstream.status) ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamResponseHeaders(upstream.headers),
  });
}
