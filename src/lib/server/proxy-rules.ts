import "server-only";
import { MAX_TEXT_BYTES } from "@/lib/constants";
import { UUID_RE } from "@/lib/ids";
import { PLATFORM_TOKEN_HEADER } from "./platform-token";

/**
 * What the backend proxy forwards (spec 04 §2): the route allowlist and the
 * header allowlists in both directions. Pure; the proxy itself is
 * `backend-proxy.ts`.
 */

export type ProxyMethod = "GET" | "POST";

/** A literal path segment, or a canonical UUID in that position. */
type Part = string | typeof ID;
const ID = Symbol("uuid");

type AllowedRoute = { readonly method: ProxyMethod; readonly parts: readonly Part[] };

/** Exactly the backend routes the UI uses, plus the QR image. Nothing else is reachable. */
export const ALLOWED_ROUTES: readonly AllowedRoute[] = [
  { method: "GET", parts: ["health"] },
  { method: "POST", parts: ["certificates"] },
  { method: "GET", parts: ["certificates", ID] },
  { method: "GET", parts: ["certificates", ID, "manifest"] },
  { method: "GET", parts: ["certificates", ID, "qr"] },
  { method: "GET", parts: ["certificates", ID, "download"] },
  { method: "POST", parts: ["verify"] },
  { method: "POST", parts: ["diff"] },
  { method: "POST", parts: ["leak-scan"] },
  { method: "GET", parts: ["leak-scan", ID] },
  { method: "GET", parts: ["leak-scan", ID, "stream"] },
];

/** A request body larger than this is refused: twice the text cap leaves room for the JSON envelope. */
export const MAX_PROXY_BODY_BYTES = 2 * MAX_TEXT_BYTES;

/** Request headers copied from the browser. Never cookies, never `authorization`. */
export const PROXY_REQUEST_HEADERS = [
  "content-type",
  "accept",
  "last-event-id",
  "x-request-id",
] as const;

/** Response headers copied from the backend. */
export const PROXY_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "retry-after",
  "x-request-id",
  "last-event-id",
] as const;

export type Resolution =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string };

const UNKNOWN: Resolution = { ok: false, status: 404, error: "unknown backend route" };
const QUERY: Resolution = { ok: false, status: 400, error: "query not allowed" };

function matches(route: AllowedRoute, method: string, segments: readonly string[]): boolean {
  if (route.method !== method || route.parts.length !== segments.length) return false;
  return route.parts.every((part, i) =>
    part === ID ? UUID_RE.test(segments[i]) : part === segments[i],
  );
}

/**
 * The backend URL for an allowlisted `method` + `segments`, or why not: an
 * unknown route is 404, any query string 400 (no allowlisted route takes one).
 * As defence in depth the result must stay on the backend's origin.
 */
export function resolveUpstream(
  backendBase: string,
  method: string,
  segments: readonly string[],
  search: string,
): Resolution {
  if (!ALLOWED_ROUTES.some((route) => matches(route, method, segments))) return UNKNOWN;
  if (search !== "") return QUERY;
  const base = new URL(backendBase);
  const prefix = base.pathname.replace(/\/+$/, "");
  const url = new URL(`${prefix}/${segments.join("/")}`, base.origin);
  return url.origin === base.origin && url.pathname.startsWith(`${prefix}/`)
    ? { ok: true, url }
    : UNKNOWN;
}

function clientAddress(incoming: Headers): string | null {
  for (const name of ["x-forwarded-for", "x-real-ip"]) {
    const value = incoming.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

/** Headers for the upstream request: the allowlist, the fresh token, the visitor's address. */
export function upstreamRequestHeaders(incoming: Headers, token: string): Headers {
  const out = new Headers();
  for (const name of PROXY_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) out.set(name, value);
  }
  out.set(PLATFORM_TOKEN_HEADER, token);
  const client = clientAddress(incoming);
  if (client !== null) out.set("x-forwarded-for", client);
  return out;
}

/** Headers for the browser: the allowlist; an event stream also opts out of every buffer. */
export function downstreamResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const name of PROXY_RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value !== null) out.set(name, value);
  }
  if (out.get("content-type")?.startsWith("text/event-stream")) {
    if (!out.has("cache-control")) out.set("cache-control", "no-cache, no-transform");
    out.set("x-accel-buffering", "no");
  }
  return out;
}
