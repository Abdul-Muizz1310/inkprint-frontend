# 🖼️ `inkprint-frontend`

> ⚡ **Next.js 16 UI for cryptographic content provenance.**
> Paste text. Get a certificate. Verify authorship. Detect training-data leaks.

🌐 [Live App](https://inkprint-frontend.vercel.app) · 🔙 [Backend API](https://inkprint-backend.onrender.com/health) · 🔙 [Backend Repo](https://github.com/Abdul-Muizz1310/inkprint-backend) · 🚀 [Quickstart](#-run-locally) · 🏗️ [Architecture](#️-architecture) · 🧪 [Testing](#-testing)

![next](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![react](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![ts](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![tailwind](https://img.shields.io/badge/Tailwind-v4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![zod](https://img.shields.io/badge/Zod-boundaries-3068b7?style=flat-square)
![rc](https://img.shields.io/badge/react--compiler-enabled-ff69b4?style=flat-square)
![vercel](https://img.shields.io/badge/Vercel-deployed-000000?style=flat-square&logo=vercel&logoColor=white)
![tests](https://img.shields.io/badge/tests-432%20unit-6e9f18?style=flat-square)
![biome](https://img.shields.io/badge/lint-Biome-60a5fa?style=flat-square)
![license](https://img.shields.io/badge/license-BUSL--1.1-lightgrey?style=flat-square)

---

```console
$ pnpm dev
  ▲ Next.js 16.0.0 (Turbopack)
  - Local:   http://localhost:3000
  - API:     https://inkprint-backend.onrender.com

[editor]       paste text + author → click Fingerprint
[certificate]  RSC fetch → CertificateCard renders instantly (no loading flicker)
[verify]       paste manifest → green/red itemised verdict
[compare]      diff new text against parent certificate → derivative score
[leak]         SSE terminal streaming Common Crawl ‖ HuggingFace ‖ The Stack v2
```

---

## 🎯 Why this exists

**The certificate is the payoff.** Users paste their text, get a cryptographically signed provenance certificate, and can immediately verify it, compare derivatives, or scan for training-data leaks — all in one interface.

- 🖼️ **The certificate page is a React Server Component.** `/certificates/[id]` fetches + parses on the server and hands a typed object to a pure presentational `CertificateCard`. No loading flicker on the one page where the visual has to land instantly.
- 🛡️ **Zod at every boundary.** Every response from the backend — including the opaque C2PA manifest (`z.record`) and the polled leak-scan result (status-enum + passthrough) — is parsed through a Zod schema before it reaches React. No raw `as` casts at the network edge. Schema drift fails loud at the boundary — caught a real 64-bit simhash overflow bug during the first live E2E, not as a mysterious `undefined` later.
- 🔏 **Signed, same-origin backend calls.** The browser never talks to the backend: it calls `/api/backend/…` on its own origin, and that server route checks the call against an allowlist, signs a fresh 60-second Ed25519 platform token with a server-only key, and streams the answer back — the leak-scan SSE event by event, the QR PNG and the certificate zip byte for byte. The certificate page's server render signs its own calls the same way.
- 🎯 **Live-backend E2E.** The Playwright happy path runs against the *real* production backend, through the signing proxy. That's how schema drift gets caught for free.
- 🧪 **Red-first Spec-TDD.** Every feature had a failing test before a line of implementation existed.

---

## ✨ Features

- 🖋️ Monospaced text editor with author field and one-click fingerprinting (Monaco was deferred — see `WHY.md`; plain `<textarea>` fallback ships)
- 📜 Server-rendered certificate page (RSC) — instant visual payoff
- ✅ Tamper verification with itemised green/red verdict breakdown
- 📊 Side-by-side diff view for derivative-work comparison
- 🔍 Live SSE-streaming leak-scan terminal (Common Crawl, HuggingFace, The Stack v2)
- 🛡️ Zod validation at every external boundary (API, env, SSE events)
- 📱 QR code display linking to the certificate permalink
- ⚛️ React 19 + React Compiler enabled
- 🖥️ Terminal-style UI chrome (shadcn base-nova)
- 💤 Backend health indicator with cold-start detection (probed through the proxy, like every other call)
- 🔏 Signing proxy `/api/backend/[...path]` (platform contract v2, DR-0030) — route allowlist, server-only key, unbuffered SSE

---

## 🏗️ Architecture

```mermaid
flowchart TD
    Browser([Browser]) -->|same origin| Proxy[/api/backend/...<br/>allowlist + signed token/]
    Browser --> RSC[Next.js 16 RSC<br/>on Vercel]
    Proxy -->|X-Platform-Token, streamed| Backend[inkprint-backend<br/>FastAPI on Render]
    RSC -->|X-Platform-Token, typed fetch + Zod| Backend
    Backend --> DB[(Neon pgvector)]
    Backend --> R2[☁️ Cloudflare R2]
```

### 📜 Certificate happy path

```mermaid
sequenceDiagram
    participant User as User
    participant Editor as Editor page (/)
    participant Proxy as /api/backend (signs)
    participant API as inkprint-backend
    participant Router as Next.js router
    participant RSC as /certificates/[id] (RSC)
    participant Card as CertificateCard

    User->>Editor: paste text + author
    Editor->>Proxy: POST /api/backend/certificates
    Proxy->>API: POST /certificates + fresh token
    API-->>Proxy: { certificate_id, manifest }
    Proxy-->>Editor: streamed back
    Editor->>Router: router.push(/certificates/[id])
    Router->>RSC: server fetch certificate
    RSC->>API: GET /certificates/{id} + its own token
    API-->>RSC: typed certificate payload
    RSC->>Card: render (no loading flicker)
    Card-->>User: signed certificate + QR code
```

### 🔍 Leak scan SSE flow

```mermaid
sequenceDiagram
    participant User as User
    participant Page as /leak/[id]
    participant Hook as useLeakStream
    participant ES as EventSource
    participant Proxy as /api/backend (signs)
    participant API as inkprint-backend

    User->>Page: navigate to leak scan
    Page->>Hook: mount(scan_id)
    Hook->>ES: new EventSource(/api/backend/leak-scan/{id}/stream)
    ES->>Proxy: GET /api/backend/leak-scan/{id}/stream
    Proxy->>API: GET /leak-scan/{id}/stream + fresh token
    loop each source scanned
        API-->>Proxy: event: progress { source, status, hits }
        Proxy-->>ES: piped unbuffered
        ES-->>Hook: onMessage(progress)
        Hook->>Hook: Zod parse event
        Hook-->>Page: update terminal output
    end
    API-->>Proxy: event: done { confidence, total_hits }
    Proxy-->>ES: piped unbuffered
    ES-->>Hook: close
    Hook-->>Page: phase = done, render final verdict
```

**Zod at every boundary:**
- 🌱 `env.ts` — validates `NEXT_PUBLIC_*` at import time
- 🌐 `api-client.ts` — schema-parses every fetch response (bound to the proxy in `api.ts`, to a signed direct transport in `server/backend-api.ts`)
- 📡 `sse.ts` — validates every SSE event payload

---

## 🗂️ Project structure

```
src/
├── app/
│   ├── page.tsx                      # Home: text editor + fingerprint button
│   ├── layout.tsx                    # Root layout + metadata
│   ├── certificates/[id]/
│   │   ├── page.tsx                  # RSC — server-fetched certificate view
│   │   ├── error.tsx                 # Error boundary
│   │   └── not-found.tsx             # 404 fallback
│   ├── verify/
│   │   └── page.tsx                  # Paste manifest, get itemised verdict
│   ├── compare/
│   │   └── page.tsx                  # Diff new text against parent certificate
│   ├── leak/[id]/
│   │   └── page.tsx                  # SSE streaming leak-scan terminal
│   └── api/backend/[...path]/
│       └── route.ts                  # Signing proxy: allowlist → token → stream back
├── components/
│   ├── certificate-card.tsx          # Styled certificate display (pure)
│   ├── editor.tsx                    # Text input + author + fingerprint action
│   ├── verdict-badge.tsx             # Green/red tamper verdict
│   ├── diff-view.tsx                 # Side-by-side diff (react-diff-viewer)
│   ├── leak-terminal.tsx             # Streaming SSE terminal output
│   ├── qr-display.tsx               # QR code render
│   ├── backend-status.tsx            # Cold / warm / down indicator
│   ├── legal-disclaimer.tsx          # Legal notice component
│   └── terminal/                     # Terminal window, nav, prompt, status bar
└── lib/
    ├── env.ts                        # Runtime env validation (Zod)
    ├── api-client.ts                 # typed client over a Transport — Zod-parsed, 30s timeout, ApiError
    ├── api.ts                        # browser binding: every call through /api/backend
    ├── backend-url.ts                # the proxy prefix (the browser never knows the backend URL)
    ├── server/                       # server-only (`import "server-only"`)
    │   ├── token-claims.ts           # contract-v2 claims, base64url, key parsing (pure)
    │   ├── platform-token.ts         # Ed25519 signing (node:crypto)
    │   ├── proxy-rules.ts            # route allowlist + header rules (pure)
    │   ├── backend-proxy.ts          # the proxy shell: refuse, sign, forward, stream
    │   └── backend-api.ts            # signed direct client for the certificate RSC
    ├── sse.ts                        # SSE EventSource wrapper with Zod validation
    ├── schemas.ts                    # Zod schemas for all API contracts
    ├── ids.ts                        # shared UUID gate (isUuid) for every id-taking path
    ├── constants.ts                  # MAX_TEXT_BYTES (mirrors backend body limit)
    ├── format.ts                     # Formatting utilities
    └── utils.ts                      # cn() (clsx + tailwind-merge)
```

> 📐 **Rule:** `app/` routes are thin RSC shells. Components are pure and dumb. All side effects live in `lib/`.

---

## 🗺️ Routes

| Route | Kind | Purpose |
|---|---|---|
| `/` | Client island in RSC shell | Editor — paste text + author, click Fingerprint |
| `/certificates/[id]` | **RSC** | Styled certificate view — the emotional payoff (no loading flicker) |
| `/verify` | Client | Paste a manifest, get a green/red itemised verdict |
| `/compare` | Client | Diff new text against a parent certificate, get a derivative verdict |
| `/leak/[id]` | RSC shell + client terminal | Streaming leak-scan terminal (SSE from backend) |

---

## 🛠️ Stack

| Concern | Choice |
|---|---|
| **Framework** | Next.js 16 (App Router, React Server Components, React Compiler) |
| **UI** | React 19 · TypeScript strict |
| **Styling** | Tailwind CSS v4 · shadcn/ui (base-nova) · lucide-react |
| **State** | Local React state (`useState`/`useEffect`) — no global store; RSC fetches on the server, client pages own one-shot form state |
| **Validation** | Zod (env, API, SSE — every external boundary) |
| **Diff** | react-diff-viewer-continued |
| **QR** | qrcode.react — client-rendered SVG encoding the `/verify?id=` link (single source of truth) |
| **Testing** | Vitest + Testing Library (432 unit tests incl. route-layer and the signing proxy, 95.87% line coverage over all src) · Playwright (e2e, live backend) |
| **Lint / Format** | Biome (replaces ESLint + Prettier) |
| **Hosting** | Vercel (auto-deploy on push to `main`) |

---

## 🚀 Run locally

```bash
# 1. clone & install
git clone https://github.com/Abdul-Muizz1310/inkprint-frontend.git
cd inkprint-frontend
pnpm install

# 2. env
cp .env.example .env.local
# defaults point at public backend — no local backend needed

# 3. dev
pnpm dev
# → http://localhost:3000
```

### 🌱 Environment

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | inkprint-backend base URL — used by the server (proxy + RSC), never by browser code |
| `NEXT_PUBLIC_SITE_URL` | Public canonical URL (OG tags, absolute links) |
| `INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE` | **Server-only.** Ed25519 private key (PKCS#8 DER, base64) that signs every backend call; the backend trusts its public half. Unset: the proxy answers `503` and the certificate page errors. |

The two public vars are validated at import time in [`src/lib/env.ts`](src/lib/env.ts) via Zod — missing vars crash boot, **parse, don't validate**. The signing key is read per request, so a missing key never crashes the server; CI fails the build if its name or the signing code reaches the client bundle.

### 📜 Scripts

```bash
pnpm dev          # Next.js dev server (Turbopack)
pnpm build        # production build
pnpm start        # production server
pnpm lint         # Biome check
pnpm format       # Biome write
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest (watch)
pnpm test --run   # Vitest (CI mode)
pnpm test:e2e     # Playwright against live backend
```

---

## 🧪 Testing

```bash
pnpm test                    # watch
pnpm test -- --run           # CI
pnpm test -- --coverage      # coverage report
pnpm test:e2e                # Playwright chromium (live backend)
```

| Metric | Value |
|---|---|
| **Unit tests** | 432 tests across app routes + components + lib (Vitest + jsdom; the proxy in Node, including one suite over real sockets with a local token-verifying backend) |
| **Line coverage** | **95.76%** (over all `src/`); 100% floors on `src/lib/server/**` and `src/app/api/**` |
| **E2E** | Playwright chromium against live production backend |
| **Methodology** | Red-first Spec-TDD — every test written before implementation |
| **Zod coverage** | Discriminated unions at env, API, SSE boundaries |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → vitest → next build (then fails if the signing code reached the client bundle) on every push to `main` and every PR.

---

## 📐 Engineering philosophy

| Principle | How it shows up |
|---|---|
| 🧪 **Spec-TDD** | Every unit test landed before the component it covers was written. Failing test before every feature. |
| 🛡️ **Negative-space programming** | Zod discriminated unions reject malformed payloads at every boundary. RSC error/not-found boundaries catch invalid certificate IDs. |
| 🧬 **Parse, don't validate** | Zod at every edge: env, REST, SSE. No `any`, no unsafe casts, no optional-chain bug masks. |
| 🏗️ **Separation of concerns** | `app/` thin RSC shells · `components/` pure + dumb · `lib/` owns side effects. |
| 🔤 **Typed everything** | TS strict; Zod-inferred types flow end-to-end; no untyped dicts across module boundaries. |
| 🌊 **Pure core, imperative shell** | `CertificateCard`, `VerdictBadge`, schemas = pure. SSE + Query + fetch = imperative shell, isolated in `lib/`. |

---

## 🚀 Deploy

Hosted on **Vercel**. Push to `main` → Vercel build → preview URL → promote to prod.

Required env vars at build time:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`

Required at runtime, server-only (never `NEXT_PUBLIC_`): `INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE`.

Next config: `reactCompiler: true`.

Rollback is a Vercel dashboard click.

---

## ⚖️ Legal disclaimer

**Not legal advice.** inkprint issues cryptographic provenance records. Its certificates may support first-authorship claims under the Berne Convention's fixation principle and may help satisfy the EU AI Act's Article 50 detectability requirements. The tool assists, it does not arbitrate — consult a qualified attorney for any formal use.

---

## 📄 License

[BUSL-1.1](LICENSE) — converts to Apache-2.0 on 2030-04-08. Licensor: Abdul-Muizz Anwar.

---

> 🖋️ **`inkprint --help`** · sign it, fingerprint it, prove it's yours
