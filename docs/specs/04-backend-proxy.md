# 04 — Signed backend proxy (platform contract v2)

## Scope

inkprint-backend moves to the workspace platform contract v2 (its spec 09): every non-public route
demands an EdDSA JWT in `X-Platform-Token`, and once `DEMO_MODE` is off a call without one answers
`401`. The browser used to call the backend directly with no token. Decision DR-0030 (workspace
`knowledge/decisions/`): the frontend holds its own Ed25519 key, its server mints a fresh 60-second
token per upstream request, and the browser reaches the backend only through a same-origin proxy
that signs and forwards. Server code (the certificate RSC) calls the backend directly with a token
of its own.

| Piece | File |
|---|---|
| Token header, claims, base64url, key parsing (pure) | `src/lib/server/token-claims.ts` |
| Key loading and signing (`node:crypto`) | `src/lib/server/platform-token.ts` |
| Route allowlist and header rules (pure) | `src/lib/server/proxy-rules.ts` |
| The proxy (imperative shell) | `src/lib/server/backend-proxy.ts` |
| Route handler | `src/app/api/backend/[...path]/route.ts` |
| Typed backend client, transport-agnostic | `src/lib/api-client.ts` |
| Browser client (through the proxy) | `src/lib/api.ts`, `src/lib/sse.ts`, `src/components/backend-status.tsx` |
| Server client (direct, signed) | `src/lib/server/backend-api.ts` |

Every module under `src/lib/server/` starts with `import "server-only"`; Next fails the build if a
Client Component pulls one in. Vitest aliases it to Next's empty module.

## 1. The token (contract v2 §1, §4)

- **Key.** `INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE`: Ed25519 private key, PKCS#8 DER, base64
  (standard alphabet). Server-only, never `NEXT_PUBLIC_*`, read per request (a missing key never
  crashes the server). The backend holds the public half (SPKI DER, base64) as
  `INKPRINT_FRONTEND_SIGNING_KEY_PUBLIC`.
- **Parsing.** A leading byte-order mark and edge whitespace are stripped. Unset, empty or
  whitespace ⇒ **missing**; not strict base64, or not an Ed25519 PKCS#8 private key (RSA, X25519,
  an SPKI public key, junk) ⇒ **malformed**.
- **Header.** `{"alg":"EdDSA","typ":"JWT","kid":"inkprint-frontend-2026-10"}`.
- **Claims.** `{"iss":"inkprint-frontend","aud":"inkprint","sub":"inkprint-frontend","role":"frontend","service":"inkprint","iat":<now>,"exp":<now+60>,"jti":<uuid v4>}`,
  `iat` whole seconds (floor), exactly 60 s of life, a new `jti` per upstream request.
- **Encoding.** Compact JWS, base64url without padding, signature `crypto.sign(null, input, key)`.

## 2. The proxy route

`/api/backend/<path>` forwards to `${NEXT_PUBLIC_API_URL}/<path>`. It exports `GET` and `POST`
only (Next answers 405 to anything else), `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
`maxDuration = 300` (the leak-scan stream's own reconnect covers a cut).

### Route allowlist

The proxy forwards exactly the backend routes the UI uses (plus the QR image and the certificate
zip, the public verification downloads), never an arbitrary path. `{id}` must be a canonical UUID.

| Method | Path |
|---|---|
| `GET` | `health` |
| `POST` | `certificates` |
| `GET` | `certificates/{id}`, `certificates/{id}/manifest`, `certificates/{id}/qr`, `certificates/{id}/download` |
| `POST` | `verify` |
| `POST` | `diff` |
| `POST` | `leak-scan` |
| `GET` | `leak-scan/{id}`, `leak-scan/{id}/stream` |

Not forwarded, on purpose: `certificates/batch`, `verify/batch`, `dossiers/envelope` (bastion's),
`search`, `metrics`, `docs`, `openapi.json`. Anything off the list — another method, an extra or
missing segment, a non-UUID id, any encoded or traversal form — answers **404**
`{"error":"unknown backend route"}` with no upstream call. A query string answers **400**
`{"error":"query not allowed"}` (no allowlisted route takes one). As defence in depth the
resolved URL must be on the backend's origin.

### Request (browser → backend)

- Headers copied when present: `content-type`, `accept`, `last-event-id`, `x-request-id`. Never
  `cookie`, `authorization`, `origin`, `referer`, `host`, or the browser's own `x-platform-token`.
- Added: `x-platform-token` (fresh), `x-forwarded-for` (incoming `x-forwarded-for`, else
  `x-real-ip`, else omitted) so the backend's per-visitor rate limit sees the visitor.
- Body: `POST` bodies are read as bytes and forwarded unchanged, capped at `2 × MAX_TEXT_BYTES`
  (a declared or actual larger body ⇒ **413** `{"error":"payload too large"}`, no upstream call).
- `fetch` options: `cache: "no-store"`, `redirect: "manual"`, `signal: request.signal`.

### Response (backend → browser)

- `new Response(upstream.body, …)`: never read or buffered, so `text/event-stream` arrives event by
  event and binary bodies (QR PNG, the certificate zip) arrive byte for byte.
- Status passes through; a `204`/`205`/`304` carries no body.
- Headers copied: `content-type`, `content-disposition`, `cache-control`, `retry-after`,
  `x-request-id`, `last-event-id`. Never `set-cookie`, `location`, `content-length`,
  `content-encoding`, `server`, `x-powered-by`.
- An event stream additionally gets `cache-control: no-cache, no-transform` (unless the backend set
  one) and `x-accel-buffering: no`, so no intermediary buffers it.

### Errors

| Condition | Answer | Upstream call |
|---|---|---|
| Route not on the allowlist | 404 `{"error":"unknown backend route"}` | none |
| Query string present | 400 `{"error":"query not allowed"}` | none |
| Body over the cap | 413 `{"error":"payload too large"}` | none |
| Key missing or malformed | 503 `{"error":"proxy not configured"}`; logs the variable's name and which, never the value | none |
| Upstream unreachable | 502 `{"error":"backend unreachable"}`, logged | attempted |
| The browser went away first | 502, not logged | aborted |

The proxy never sends an unsigned request.

## 3. Callers

- Browser: every `@/lib/api` function calls `/api/backend/<path>` on its own origin;
  `openLeakScanStream` opens `new EventSource("/api/backend/leak-scan/{id}/stream")` (an
  `EventSource` cannot send headers, so the stream must go through the proxy); `BackendStatus` pings
  `/api/backend/health`, so the pill reports the path every other call takes.
- Server: the certificate RSC uses `serverApi` (`src/lib/server/backend-api.ts`), which calls
  `${NEXT_PUBLIC_API_URL}` directly with a freshly minted token, never through its own proxy. A
  missing or malformed key throws before any request: there is no unsigned path. A fresh token per
  call makes every fetch a data-cache miss (Next keys its fetch cache on request headers), so the
  immutable certificate read is cached one level up, as a parsed value, with `unstable_cache`
  (revalidate 3600 s, keyed by id); errors are never cached.

`robots.txt` disallows `/api/` (spec 03): the proxy is a machine endpoint.

## 4. Bundle boundary

After `pnpm build`, `.next/static` contains neither `INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE` nor
`createPrivateKey`; CI's build job greps for both and fails if either is found.

## Test cases

Unit and composed tests (Vitest, Node environment, keys generated per run, `fetch` stubbed):
`tests/lib/server/*.test.ts`, `tests/app/api/backend/route.test.ts`. A composed test over real
sockets: `tests/app/api/backend/proxy-socket.test.ts` starts a local `node:http` backend that
verifies each token with the public key and streams SSE with pauses. Browser-side cases in
`tests/lib/api.test.ts`, `tests/lib/sse.test.ts`, `tests/components/backend-status.test.tsx`.

### Pass

- **P1** `base64url` matches RFC 4648 §10 vectors, unpadded, `-` and `_`.
- **P2** the header is exactly §1's.
- **P3** the claims for a given `now`: `iss`, `aud`, `sub`, `role`, `service`, `iat = floor(now/1000)`,
  `exp = iat + 60`, the given `jti`.
- **P4** a minted token verifies with `node:crypto` against the public key in the backend's format;
  header and claims decode to P2/P3; two mints differ in `jti`.
- **P5** the key loads from PKCS#8 DER base64, also wrapped in a BOM and a trailing CRLF.
- **P6** every allowlisted method and path resolves onto the backend base (with or without a base
  path).
- **P7** request headers: the four allowlisted copied, token set, `x-forwarded-for` from
  `x-forwarded-for`, else `x-real-ip`, else absent.
- **P8** response headers: only the six allowlisted copied; an event stream gains
  `cache-control: no-cache, no-transform` and `x-accel-buffering: no`.
- **P9** `GET` through the route reaches the backend with a token that verifies, the claims of §1,
  the allowlisted headers, `no-store`, `manual`, the request's signal; status and body come back.
- **P10** `POST` forwards its body byte for byte.
- **P11** SSE: the first event reaches the client while the upstream stream is still open; over a
  real socket, events arrive one at a time with the upstream's pauses between them.
- **P12** binary: the QR PNG and the zip come back byte for byte with their content types and the
  zip's `content-disposition`.
- **P13** the route exports `GET`, `POST`, `runtime`, `dynamic`, `maxDuration = 300`.
- **P14** browser callers use `/api/backend/…` (every `@/lib/api` function, the event stream, the
  health pill); none uses `NEXT_PUBLIC_API_URL`.
- **P15** `serverApi` calls the backend URL directly with a valid token and `no-store`;
  `getCertificate` is wrapped in `unstable_cache` with revalidate 3600 and its id in the key.

### Failure (negative space)

- **F1** a missing key (unset, empty, whitespace) is reported as missing; a malformed one (non-base64,
  inner line break, bad length, junk, SPKI public key, RSA, X25519) as malformed.
- **F2** a token does not verify against another key, nor after its claims change.
- **F3** the allowlist refuses: no segments, `search`, `certificates/batch`, `verify/batch`,
  `dossiers/envelope`, `metrics`, `docs`, `openapi.json`, `GET certificates`, `POST
  certificates/{id}`, `GET verify`, `POST health`, a non-UUID id, an id with `%2e%2e`, `..`, `.`,
  `/`, `\`, `@`, `:`, a space, a NUL, a non-ASCII character, an extra segment, an empty segment.
- **F4** through the route each F3 case answers 404 with no upstream call; a query answers 400; a
  body over the cap (declared or actual) answers 413 with no upstream call.
- **F5** request headers never carry `cookie`, `authorization`, `origin`, `referer`, `host` or the
  browser's `x-platform-token`.
- **F6** response headers never carry `set-cookie`, `location`, `content-length`,
  `content-encoding`, `server`, `x-powered-by`.
- **F7** a missing or malformed key answers 503 with no upstream call and logs the name, never the
  value; `serverApi` throws and sends nothing.
- **F8** an unreachable upstream answers 502 and logs; an aborted browser request answers 502
  without a log.
- **F9** an upstream redirect comes back as a redirect without its `location`; a 204 has no body.
