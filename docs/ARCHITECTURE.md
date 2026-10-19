# Architecture

## Overview

`inkprint-frontend` is a Next.js 16 App Router application deployed to Vercel.
It has no database of its own — every call crosses a typed boundary to the
[inkprint-backend](https://github.com/Abdul-Muizz1310/inkprint-backend) FastAPI
service on Render, which owns Postgres (Neon pgvector), R2 blob storage, and
Ed25519 signing.

```mermaid
graph TD
  Browser[Browser]
  subgraph Vercel
    RSC["/certificates/[id]<br/>RSC server component"]
    Client["Editor / Verify / Compare / Leak<br/>client components"]
    Lib["@/lib/api-client<br/>@/lib/schemas (Zod)<br/>@/lib/sse"]
    Proxy["/api/backend/[...path]<br/>allowlist + signed token"]
    Signed["@/lib/server/backend-api<br/>signed direct client"]
  end
  subgraph Render
    API[FastAPI<br/>inkprint-backend]
  end
  subgraph Neon
    DB[(Postgres + pgvector)]
  end
  R2[Cloudflare R2]

  Browser --> RSC
  Browser --> Client
  RSC --> Signed
  Signed --> Lib
  Client --> Lib
  Lib -->|same-origin fetch + Zod parse| Proxy
  Lib -.SSE.-> Proxy
  Proxy -->|X-Platform-Token, streamed| API
  Signed -->|X-Platform-Token| API
  API --> DB
  API --> R2
```

## Layering

The codebase follows a strict layered structure. Nothing reaches across layers;
a component never touches `fetch`, and the API module never knows what a React
component is.

```
src/
├── app/            # routes (RSC by default; "use client" only where needed)
│   ├── page.tsx                       # / — landing + editor
│   ├── certificates/[id]/
│   │   ├── page.tsx                   # RSC — fetch cert (with its text); slice the 200-char digest from it
│   │   ├── not-found.tsx              # 404 surface
│   │   └── error.tsx                  # 5xx surface with reset()
│   ├── verify/page.tsx                # client — manifest paste + check
│   ├── compare/page.tsx               # client — parent id + new text → diff
│   └── leak/[id]/page.tsx             # RSC UUID gate → mounts <LeakTerminal/>
│
├── components/     # presentational + interactive components
│   ├── certificate-card.tsx           # the emotional payoff
│   ├── editor.tsx                     # textarea + author + submit
│   ├── diff-view.tsx                  # react-diff-viewer-continued wrapper
│   ├── leak-terminal.tsx              # owns the SSE connection
│   ├── qr-display.tsx                 # QR via qrcode.react (client-rendered SVG, single source of truth)
│   ├── verdict-badge.tsx              # 5 diff verdicts, colour-coded
│   └── legal-disclaimer.tsx           # "Not legal advice" note
│
└── lib/            # shared, pure, no-React
    ├── env.ts                         # Zod-validated NEXT_PUBLIC_* (fails loud at import time)
    ├── schemas.ts                     # Zod mirrors of every backend response (incl. manifest + leak result) + LeakEvent union
    ├── api-client.ts                  # typed client over a Transport; Zod-parses every response, 30s AbortSignal timeout, ApiError for every failure
    ├── api.ts                         # browser binding: every call through the /api/backend signing proxy
    ├── backend-url.ts                 # the proxy prefix
    ├── server/                        # server-only: token claims, Ed25519 signing, proxy allowlist + shell, signed RSC client (spec 04)
    ├── ids.ts                         # shared UUID gate (isUuid) — the single validation choke-point for id-taking paths
    ├── sse.ts                         # typed EventSource wrapper for leak-scan stream
    ├── format.ts                      # pure formatters (truncateMiddle, formatIssuedAt, formatKeyId)
    └── utils.ts                       # cn() classname helper
```

## Data flow — the fingerprint happy path

```mermaid
sequenceDiagram
  participant U as User
  participant E as Editor (client)
  participant API as @/lib/api
  participant P as /api/backend (signs)
  participant BE as inkprint-backend
  participant R as Next.js router
  participant RSC as /certificates/[id] RSC

  U->>E: paste text + author
  U->>E: click "Fingerprint"
  E->>API: createCertificate({text, author})
  API->>P: POST /api/backend/certificates
  P->>BE: POST /certificates + fresh platform token
  BE-->>P: 201 CertificateResponse
  P-->>API: streamed back
  API->>API: Zod parse → typed
  API-->>E: typed CertificateResponse
  E->>R: router.push(`/certificates/${id}`)
  R->>RSC: navigate
  RSC->>API: getCertificate(id) via the signed server client
  API->>BE: GET /certificates/{id} + its own platform token
  BE-->>API: JSON
  API->>API: Zod parse → typed
  Note over RSC,BE: digest = cert.text sliced to 200 chars<br/>(/download is a zip and is never read as text)
  API-->>RSC: parsed cert + 200-char preview
  RSC-->>U: styled CertificateCard
```

## Why RSC for `/certificates/[id]`

The certificate page is the only page where visual impact matters more than
interactivity. A fetch-on-client + loading-flicker pattern would undercut the
payoff. RSC pre-fetches both endpoints in parallel on the server, so the page
arrives fully-rendered during the router transition. The only interactive parts
of the card — copy-hash, share, download-manifest — are isolated inside
`CertificateCard` as a client island.

Certificates are immutable once issued, so the server client caches the parsed
`getCertificate` result for an hour per id with `unstable_cache` (a fetch-level
`next: { revalidate }` cannot work: every call carries a fresh platform token,
and Next keys its fetch cache on request headers). A widely-shared or QR-linked
certificate therefore does not re-wake the cold-start-prone free-tier backend on
every view.

The digest comes from the certificate's `text`, which `GET /certificates/{id}`
returns exactly as submitted: one cached round-trip, no second fetch. It used to
read a prefix of `/download`, but that route serves a zip archive
(`manifest.json`, `public_key.pem`, `content.txt`), and read as text it rendered
raw `PK…` bytes; `/compare` had the same bug when diffing against the parent.

## Why Zod at every API boundary

The backend is a separate service with its own versioning; a field rename or
type change there should not cascade silently through the frontend. Every
response goes through a Zod schema in [src/lib/schemas.ts](../src/lib/schemas.ts).
A concrete payoff: the backend emits 64-bit unsigned integers for the
`simhash` field, which exceeds `Number.MAX_SAFE_INTEGER`. Zod v4's `.int()`
rejected it, which broke fingerprinting on the very first live request — but
it broke *loudly* at the Zod parse, not as a mysterious `undefined` three layers
deep. Fix was one-line.

## Testing boundary

- **Unit/integration (`tests/lib/**`, `tests/components/**`, `tests/app/**`)** —
  mocked `fetch`, mocked `EventSource`, mocked `next/navigation`. Runs in jsdom
  via vitest. Red before green per Spec-TDD. The **route layer is covered here**:
  `tests/app/` drives the RSC compose logic (UUID gate → parallel fetch → 404 /
  error branching for `certificates/[id]` and `leak/[id]`) and the client pages'
  wiring (`verify` deep-link auto-load + UUID gate, `compare` UUID gate + diff),
  so the router→network layer no longer depends on a test that never runs in CI.
- **E2E (`tests/e2e/cert-flow.spec.ts`)** — Playwright against the **live**
  backend. No mocks. Catches CORS regressions, schema drift, and real cold-start
  behaviour for free. Still deferred from CI (the Render free tier cold-start
  takes 20–30s on the first POST of a session), but it is now a *supplementary*
  live smoke, not the only thing exercising `src/app/`.

## Deployment topology

```
GitHub (Abdul-Muizz1310/inkprint-frontend @ main)
  │
  │ push
  ▼
Vercel build (pnpm install → lint → typecheck → vitest → next build)
  │
  ▼
https://inkprint-frontend.vercel.app
  │
  │ browser fetch (CORS-allowed)
  ▼
https://inkprint-backend.onrender.com
  │
  ├─▶ Neon Postgres (pgvector branch `inkprint`)
  └─▶ Cloudflare R2 (certificate archive)
```

The frontend is stateless. Rollbacks are a Vercel dashboard click; promotions
happen on every merge to `main`.
