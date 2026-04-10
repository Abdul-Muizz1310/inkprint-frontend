# 01 — Components

## Goal

Define the presentational + interactive components that the routes in [00-pages.md](00-pages.md) compose from, plus the shared `lib/` modules they depend on. Components are unit-testable in isolation with mocked data; pages only wire them up.

## Component inventory

| Component | Path | Kind | Consumed by |
|---|---|---|---|
| `Editor` | `src/components/editor.tsx` | Client | `/` |
| `CertificateCard` | `src/components/certificate-card.tsx` | Client | `/certificates/[id]` |
| `DiffView` | `src/components/diff-view.tsx` | Client | `/compare` |
| `LeakTerminal` | `src/components/leak-terminal.tsx` | Client | `/leak/[id]` |
| `QRDisplay` | `src/components/qr-display.tsx` | Client | `CertificateCard` |
| `LegalDisclaimer` | `src/components/legal-disclaimer.tsx` | Server | `/`, `/verify` |
| `VerdictBadge` | `src/components/verdict-badge.tsx` | Server | `/compare` |

Plus shadcn primitives under `src/components/ui/` (button, input, textarea, card, badge, tooltip, toast) — not hand-spec'd here, installed via `pnpm dlx shadcn@latest add ...` and excluded from Biome lint.

## Shared lib modules

| Module | Path | Purpose |
|---|---|---|
| env | `src/lib/env.ts` | Already shipped in S1. Zod-validated `NEXT_PUBLIC_*`. |
| utils | `src/lib/utils.ts` | Already shipped in S1. `cn()` classname helper. |
| schemas | `src/lib/schemas.ts` | Zod schemas mirroring the backend OpenAPI. |
| api | `src/lib/api.ts` | Typed HTTP client. One exported function per endpoint. |
| sse | `src/lib/sse.ts` | Thin typed wrapper around `EventSource` for leak-scan streaming. |
| format | `src/lib/format.ts` | `truncateMiddle`, `formatIssuedAt`, `formatHamming`, etc. |

---

## `src/lib/schemas.ts`

### Goal
One file, one source of truth for backend response shapes. Every API call parses through these. Unknown fields are `.passthrough()` — required fields must validate.

### Schemas (minimum for S4)

```ts
export const CertificateResponse = z.object({
  id: z.string().uuid(),
  author: z.string(),
  content_hash: z.string(),
  simhash: z.number().int(),
  content_len: z.number().int(),
  language: z.string().nullable(),
  issued_at: z.string().datetime({ offset: true }),
  signature: z.string(),
  manifest: z.record(z.string(), z.unknown()),
  storage_key: z.string(),
}).passthrough();

export const VerifyResponse = z.object({
  valid: z.boolean(),
  checks: z.record(z.string(), z.boolean()),
  warnings: z.array(z.string()),
});

export const DiffVerdict = z.enum([
  "identical", "near-duplicate", "derivative", "inspired", "unrelated",
]);

export const DiffResponse = z.object({
  hamming: z.number().int(),
  cosine: z.number(),
  verdict: DiffVerdict,
  overlap_pct: z.number().int(),
  changed_spans: z.array(z.unknown()).optional().default([]),
});

export const LeakScanResponse = z.object({
  scan_id: z.string().uuid(),
  status: z.enum(["pending", "running", "done", "failed"]),
});
```

### Test cases
- **Certificate happy**: full valid object → parses, every field present on output.
- **Certificate missing `id`**: parse throws with path `["id"]`.
- **Certificate `language: null`**: parses, `language` is `null`.
- **Certificate extra unknown field**: passes through (no throw).
- **Verify with non-bool in `checks`**: throws.
- **Diff with unknown verdict**: throws (enum is closed).
- **Diff missing `changed_spans`**: defaults to `[]`.
- **LeakScan with unknown status**: throws.

### Acceptance
- [ ] All 4 response schemas defined and exported
- [ ] Each throws loudly on malformed input
- [ ] No `any` anywhere

---

## `src/lib/api.ts`

### Goal
Typed wrappers over `fetch` against `env.NEXT_PUBLIC_API_URL`. Every response is parsed through the matching Zod schema. Errors become typed `ApiError` instances.

### Shape
```ts
export class ApiError extends Error {
  constructor(public status: number, public body: unknown) { super(`API ${status}`); }
}

export async function createCertificate(input: {text: string; author: string}): Promise<CertificateResponse>
export async function getCertificate(id: string): Promise<CertificateResponse>
export async function getCertificateDownload(id: string): Promise<string>
export async function getCertificateManifest(id: string): Promise<Record<string, unknown>>
export async function verifyManifest(input: {manifest: Record<string, unknown>; text?: string}): Promise<VerifyResponse>
export async function diffText(input: {parent_id: string; text: string}): Promise<DiffResponse>
export async function createLeakScan(input: {certificate_id: string; corpora?: string[]}): Promise<LeakScanResponse>
export async function getLeakScan(scan_id: string): Promise<LeakScanResult>  // loose type ok for S4
```

### Invariants
- `Content-Type: application/json` set on every POST.
- Non-2xx → throw `ApiError(status, body)`. The caller decides what to render.
- `getCertificateDownload` returns `response.text()` (backend returns plain text).
- `getCertificateQrUrl(id)` — **not** a fetch; returns the full URL string so `<img src>` can consume it directly.
- Never mutates inputs. Never logs secrets (there aren't any on the client, but the pattern stands).

### Test cases
- **createCertificate happy**: mock `fetch` → 201 + JSON body → returns parsed object.
- **createCertificate 422**: mock → 422 + error body → throws `ApiError` with `status=422` and body present.
- **createCertificate 500**: throws `ApiError(500, ...)`.
- **createCertificate network failure**: `fetch` rejects → rethrown as `ApiError(0, "network")` (or similar sentinel).
- **getCertificate parses into CertificateResponse**: happy 200 passes Zod.
- **getCertificate malformed body**: Zod throws (not ApiError — test asserts the thrown type).
- **getCertificateDownload returns string**: mock `text/plain` body.
- **verifyManifest body is forwarded**: assert fetch mock called with JSON-stringified body.
- **diffText body is forwarded**.
- **createLeakScan returns 202 body** parsed.
- **All API functions prefix with env.NEXT_PUBLIC_API_URL**: parametric assertion.

### Acceptance
- [ ] Every endpoint listed has one exported function
- [ ] Every response goes through a Zod schema
- [ ] `ApiError` carries status + body
- [ ] Zero direct `fetch()` calls anywhere outside this file (grep test in CI optional)

---

## `src/lib/format.ts`

### Goal
Pure, side-effect-free string formatters. Unit-testable with no mocks.

### Functions
```ts
truncateMiddle(s: string, first: number, last: number): string   // "abcd…wxyz"
formatIssuedAt(iso: string): string                               // "10 April 2026, 12:34:56 UTC"
formatKeyId(keyId: string | undefined | null): string             // first 16 chars or "—"
```

### Test cases
- **truncateMiddle short string**: input shorter than `first + last + 1` → returned unchanged.
- **truncateMiddle long string**: `(sha256, 6, 4)` → `"e3b0c4…b855"`.
- **truncateMiddle with first=0**: `"…xyz"`.
- **formatIssuedAt valid UTC**: `"2026-04-10T12:34:56Z"` → contains `"UTC"` and `"2026"` and a time.
- **formatIssuedAt with offset**: `"2026-04-10T12:34:56+02:00"` → converts to UTC, not local.
- **formatIssuedAt invalid input**: throws or returns `"—"` (decide: return `"—"` + never throw).
- **formatKeyId happy**: 64-char key → 16 chars.
- **formatKeyId empty**: `""` → `"—"`.
- **formatKeyId null / undefined**: `"—"`.

### Acceptance
- [ ] Every function is pure, deterministic, and has ≥3 tests
- [ ] No date-fns, no moment — `Intl.DateTimeFormat` only

---

## `Editor` (`src/components/editor.tsx`)

### Goal
Monaco editor + author input + fingerprint button. Owns the submit flow. Emits navigation on success.

### Props
```ts
type EditorProps = {
  maxBytes?: number; // default 1_048_576
};
```

### Behaviour
- Renders `@monaco-editor/react` in controlled mode. Fallback: plain `<textarea>` while Monaco loads (loading state).
- Character counter updates on every change.
- `Fingerprint` button disabled when: text empty, author empty, in-flight, over `maxBytes`.
- On click: calls `createCertificate` via `@/lib/api`, on 201 navigates via `next/navigation`'s `useRouter().push`.
- Errors surfaced via a `sonner` toast (or inline alert if we skip sonner in S4 — decision in S4).

### Test cases
- All listed under `/` in [00-pages.md](00-pages.md).
- Additionally:
  - **Paste event with huge text** triggers the max-bytes disabled state immediately, not only on next keystroke.
  - **Monaco fails to load** (simulate via module mock) → fallback textarea is used, flow still works.

### Acceptance
- [ ] Tests for all listed cases pass
- [ ] Monaco is lazily loaded (does not block initial paint)
- [ ] No hydration warnings

---

## `CertificateCard` (`src/components/certificate-card.tsx`)

### Goal
The visual payoff. Pure presentational component that takes a parsed `CertificateResponse` + first-200-char digest + a verification URL, renders the styled card.

### Props
```ts
type CertificateCardProps = {
  cert: CertificateResponse;
  digestPreview: string;           // first 200 chars of the original text
  verifyUrl: string;               // e.g. ${env.NEXT_PUBLIC_SITE_URL}/verify?id=...
  qrUrl: string;                   // image src for the QR
};
```

### Layout
- Serif headline "Certificate of Authorship"
- Watermark SVG at 10% opacity (positioned absolute, pointer-events-none)
- 4 metadata rows (grid 2-col: label in muted, value in foreground)
  - Author
  - Hash — monospace, truncated via `truncateMiddle(hash, 6, 4)`, copy-on-click
  - Issued at — via `formatIssuedAt`
  - Key ID — via `formatKeyId(cert.manifest.signer?.key_id)`
- QR 120×120 top-right (absolute)
- Digest box — `<pre>` with `max-h-32 overflow-y-auto`
- Footer: "Verify at {verifyUrl}" — copy on click
- Actions row: Download manifest, Share

### Test cases
- All 9 listed under `/certificates/[id]` in [00-pages.md](00-pages.md).
- Additionally:
  - **Snapshot test** of the rendered HTML structure (guard against accidental layout break).
  - **Serif font class** is present on the headline.
  - **Watermark is rendered but aria-hidden**.

### Acceptance
- [ ] All listed cases pass
- [ ] Snapshot stable
- [ ] Keyboard-accessible (buttons reachable via Tab, copy works via Enter)

---

## `QRDisplay` (`src/components/qr-display.tsx`)

### Goal
Render a QR code for a given URL. Default: client-side via `qrcode.react`. Optionally accept a pre-fetched `src` to use an `<img>` against the backend's `/qr` endpoint.

### Props
```ts
type QRDisplayProps = {
  value: string;        // the URL to encode
  size?: number;        // default 120
  src?: string;         // optional <img src> override
  alt?: string;
};
```

### Test cases
- **Renders SVG with `qrcode.react`** when no `src` provided.
- **Renders `<img>`** when `src` provided.
- **size prop** controls width+height attributes.
- **alt text** present on `<img>` path.

### Acceptance
- [ ] Both render paths work and are tested
- [ ] Fixed dimensions (no layout shift)

---

## `DiffView` (`src/components/diff-view.tsx`)

### Goal
Thin wrapper around `react-diff-viewer-continued` that applies inkprint styling and accepts the two text strings plus the verdict metadata.

### Props
```ts
type DiffViewProps = {
  original: string;
  current: string;
  stats: { overlap_pct: number; hamming: number; cosine: number };
  verdict: DiffVerdict;
};
```

### Test cases
- **Identical input** → renders without "changed" markers.
- **Changed spans** → renders with highlighted lines (assert via `getByText` on a unique changed token).
- **Verdict badge integration**: test that the `VerdictBadge` is rendered next to the stats.
- **Empty strings**: renders with graceful empty state.

### Acceptance
- [ ] Renders the library output + stats row + verdict badge
- [ ] No `dangerouslySetInnerHTML`

---

## `VerdictBadge` (`src/components/verdict-badge.tsx`)

### Goal
Given a `DiffVerdict`, render a coloured pill label. Pure function of props.

### Mapping
- `identical` → green
- `near-duplicate` → blue
- `derivative` → amber
- `inspired` → violet
- `unrelated` → neutral

### Test cases
- **Each of the 5 verdicts** → produces the expected label + colour class.

### Acceptance
- [ ] All 5 mappings tested
- [ ] Colours are tokenised (CSS vars), not hard-coded hex

---

## `LeakTerminal` (`src/components/leak-terminal.tsx`)

### Goal
Owns the SSE connection for a leak scan. Appends events to a terminal box, renders hit cards once done. Uses `@/lib/sse`.

### Props
```ts
type LeakTerminalProps = {
  scanId: string;
};
```

### Behaviour
- On mount: `openLeakScanStream(scanId)` → EventSource-like.
- Appends `data` strings (parsed as JSON → typed event union).
- On `done`/`failed` or error → closes stream, calls `getLeakScan(scanId)` for final state.
- On unmount → closes stream.

### Event type
```ts
type LeakEvent =
  | { type: "started" }
  | { type: "scanning"; corpus: string; snapshot?: string }
  | { type: "hit"; corpus: string; url: string; excerpt: string; score: number }
  | { type: "done" }
  | { type: "failed"; reason: string };
```

### Test cases
- All under `/leak/[id]` in [00-pages.md](00-pages.md).
- Additionally:
  - **Unknown event type** → logged, not rendered (no crash).
  - **Reconnect on transient error** — **out of scope for S4**; fall back to polling once instead.

### Acceptance
- [ ] Connects, appends events, closes properly
- [ ] Unmount always closes the source
- [ ] Fallback to polling works
- [ ] Unknown events don't crash

---

## `src/lib/sse.ts`

### Goal
A tiny wrapper that turns `new EventSource(url)` into a typed callback API. Exists mainly to make `LeakTerminal` unit-testable.

### Shape
```ts
export type LeakStreamHandlers = {
  onEvent(event: LeakEvent): void;
  onError(err: Event): void;
  onOpen?(): void;
};

export function openLeakScanStream(scanId: string, handlers: LeakStreamHandlers): () => void;
// Returns a close() function.
```

### Test cases
- **Happy dispatch**: mock `EventSource`, emit 3 messages → `onEvent` called 3 times with parsed `LeakEvent` objects.
- **Malformed JSON** → `onError` called, no crash.
- **close() actually closes** the underlying EventSource (assert on mock).
- **onOpen** fires when the mocked source opens.

### Acceptance
- [ ] 4 tests above pass
- [ ] Usable with both the real DOM `EventSource` and a jsdom mock

---

## `LegalDisclaimer` (`src/components/legal-disclaimer.tsx`)

### Goal
Stateless server component rendering a short legal notice card. Hard-coded copy from [30-inkprint.md:136](../../../docs/projects/30-inkprint.md#L136) + `:559`. Rendered on `/` and `/verify`.

### Test cases
- **Renders the "Not legal advice" phrase**
- **Renders the Berne + EU AI Act references**
- **Accessible**: role="note" or equivalent

### Acceptance
- [ ] Present on both pages (regression test in 00-pages)
- [ ] No interactivity required

---

## Cross-cutting acceptance

- [ ] No component imports `fetch` directly — all HTTP goes through `@/lib/api`
- [ ] No `any`
- [ ] All dates go through `@/lib/format`, not ad-hoc `toLocaleString`
- [ ] All tests in `tests/components/` and `tests/lib/`, mirroring source paths
- [ ] Coverage ≥80% on touched files at the end of S4
