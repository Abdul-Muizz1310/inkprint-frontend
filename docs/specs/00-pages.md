# 00 — Pages (routes)

## Goal

Define the five public routes of the inkprint frontend, the data each needs, the server/client boundary, and the states each must handle. The `/certificates/[id]` page is the emotional payoff — the "certificate of authorship" visual that users screenshot and share.

Source of truth: [docs/projects/30-inkprint.md § Frontend UX](../../../docs/projects/30-inkprint.md). Backend contract: `https://inkprint-backend.onrender.com/openapi.json`.

## Routes

| Path | File | RSC? | Purpose |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Server shell, client editor | Landing + editor. Paste/upload text, fill author, click "Fingerprint", navigate to `/certificates/[id]`. |
| `/certificates/[id]` | `src/app/certificates/[id]/page.tsx` | Server (fetch on server, pass to client card) | Styled certificate view. The payoff. |
| `/verify` | `src/app/verify/page.tsx` | Client | Paste a manifest (+optional text), POST `/verify`, show itemized verdict. |
| `/compare` | `src/app/compare/page.tsx` | Client | Two-pane diff: parent cert id + new text → POST `/diff`, show highlighted diff + verdict badge. |
| `/leak/[id]` | `src/app/leak/[id]/page.tsx` | Client (SSE) | Streaming scan terminal for a given `scan_id`. |

Not in scope for S4: `/demo` (chromeless iframe embed) — can be added later via polish pass.

## Global invariants

- All routes that read env vars do so via `@/lib/env` (Zod-validated — fails loud at import time).
- All routes that call the backend do so via `@/lib/api` (typed wrappers; never `fetch()` inline in components).
- All backend schemas are parsed with Zod at the edge. Unknown/extra fields are allowed (`z.object(...).passthrough()`) but required fields must validate or the call throws.
- Legal disclaimer (from [30-inkprint.md:559](../../../docs/projects/30-inkprint.md#L559)) appears on `/` **and** `/verify`. Mandatory.
- Every non-trivial page has explicit `loading`, `error`, and (where applicable) `empty` states. No spinner-with-no-context.
- No `any`. No untyped fetch.

---

## `/` — Editor + landing

### Goal
User arrives, pastes text, fills author, clicks "Fingerprint", lands on the certificate page.

### Layout
- Header: logo (serif wordmark "inkprint"), tagline ("Content provenance & AI-training-data detection"), link to GitHub.
- Editor block (client component — `<Editor/>`):
  - Monaco editor, 20 rows, placeholder "Paste or type your text…"
  - Live character count + detected language badge (detected client-side via `franc` or similar, deferred to S4 if complex — acceptable fallback: show only char count).
  - `Author` text input (email or `did:key` format, free text).
  - `Fingerprint` button — disabled while text empty, author empty, or a request is in-flight.
- Below: the legal disclaimer card (non-dismissible).

### Data flow
1. User fills editor + author.
2. Click "Fingerprint" → `POST /certificates` body `{ text, author }`.
3. On 201 → `router.push("/certificates/" + response.id)`.
4. On 4xx → inline error toast, keep text in editor.
5. On 5xx / network → inline error, retry button.

### Test cases
- **Happy path**: text + author present → button enables → click → POST fires → navigates to `/certificates/:id`. (Unit: render, type, click, assert router push with correct id from mocked API.)
- **Empty text**: button disabled. Pressing Enter does nothing.
- **Empty author**: button disabled.
- **In-flight**: button shows spinner + disabled + "Fingerprinting…" label; second click is a no-op.
- **4xx error**: API returns 422 → inline error surfaces the first validation message, text/author preserved.
- **5xx error**: API returns 500 → generic error with "Try again" button, text/author preserved.
- **Network error** (fetch rejects) → same "Try again" path.
- **Text over max bytes** (client-side guard ≥1 MiB UTF-8) → button disabled, helper text "Text too large (max 1 MiB)".
- **Legal disclaimer is present in the DOM** — regression test: `getByText(/not legal advice/i)` is present.

### Acceptance
- [ ] `/` renders with editor, author input, fingerprint button, disclaimer
- [ ] Button disabled states enumerated above
- [ ] Happy path navigates to `/certificates/:id`
- [ ] Errors surfaced inline (not alert(), not console)
- [ ] No server component touches `fetch()` on this page (all interactivity is client)

---

## `/certificates/[id]` — the certificate view (emotional payoff)

### Goal
Render a pre-fetched certificate as a shareable "Certificate of Authorship" card. This is the screenshot moment.

### Layout (spec from [30-inkprint.md:498](../../../docs/projects/30-inkprint.md#L498))
- Serif headline: **"Certificate of Authorship"** — in a serif display font (`next/font/google` → `EB_Garamond` or `Playfair_Display`). Body is Inter/Geist sans.
- Watermark SVG of the inkprint logo behind the content at 10% opacity.
- Four metadata rows (grid of label + value):
  - **Author** — `response.author`
  - **Hash** — `response.content_hash` in monospace, truncated with middle ellipsis for display (`e3b0c4…b855` pattern), copy-on-click.
  - **Issued at** — `response.issued_at` formatted via `Intl.DateTimeFormat("en-GB", {dateStyle: "long", timeStyle: "medium", timeZone: "UTC"})` + " UTC".
  - **Key ID** — first 16 chars of the manifest's `signer.key_id` (defensive: fall back to "—" if missing).
- QR code top-right, 120×120, generated from `GET /certificates/{id}/qr` (PNG) or `qrcode.react` client-side encoding `${NEXT_PUBLIC_SITE_URL}/verify?id={id}`.
- Below metadata: "Content digest (first 200 chars)" box — monospace, max-height with overflow-y scroll. Content comes from `GET /certificates/{id}/download` (first 200 chars, server-side).
- Footer: "Verify at `${NEXT_PUBLIC_SITE_URL}/verify?id={id}`" (copy-on-click).
- Two buttons:
  - **Download manifest** — triggers download of `GET /certificates/{id}/manifest` as `inkprint-{id}.json`.
  - **Share** — copies `${NEXT_PUBLIC_SITE_URL}/certificates/{id}` to clipboard.

### Data flow
- **Server component** fetches in parallel via the typed API client:
  - `GET /certificates/{id}` → parsed `CertificateResponse`
  - `GET /certificates/{id}/download` → first 200 chars (truncated server-side before passing to client)
- Passes parsed data to a **client `<CertificateCard/>`** which owns the interactive bits (copy, share, download-manifest click handler that does its own `GET /certificates/{id}/manifest` and blob-downloads it).

### Test cases
- **Happy render**: mocked cert → all 4 rows present, QR renders, digest box shows ≤200 chars, footer has cert id.
- **Hash truncation**: 64-char hash renders truncated to pattern `first6…last4`.
- **Issued-at formatting**: `2026-04-10T12:34:56Z` → displays `"10 April 2026, 12:34:56 UTC"` (or locale-equivalent; assertion checks for "UTC" suffix).
- **Missing language**: `language: null` → no badge, no crash.
- **Missing key_id in manifest**: renders "—" in the Key ID row, no crash.
- **Copy hash**: click the truncated hash → `navigator.clipboard.writeText` called with the **full** hash (not truncated).
- **Copy share**: click share button → `navigator.clipboard.writeText` called with full URL including cert id.
- **Download manifest**: click download → fetches `/certificates/{id}/manifest`, creates a blob URL, triggers an `<a download>` click, revokes the URL. Assert fetch call happened with correct path; assert the anchor `download` attribute is `inkprint-{id}.json`.
- **Certificate not found** (`GET /certificates/{id}` returns 404) → Next.js `notFound()` → renders `not-found.tsx`.
- **Backend 500** → renders `error.tsx` with "Could not load certificate" + retry.

### Acceptance
- [ ] Renders every element from the spec at [30-inkprint.md:498](../../../docs/projects/30-inkprint.md#L498)
- [ ] QR code visible top-right, 120×120
- [ ] Hash copy-on-click copies full hash, not the truncated display
- [ ] Download manifest produces a file named `inkprint-{id}.json`
- [ ] 404 and 500 paths are tested and visually distinct
- [ ] No layout shift on initial render (QR has fixed dimensions)

---

## `/verify`

### Goal
Paste a C2PA-style manifest JSON (and optionally the original text), get a green/red verdict with every check itemized.

### Layout
- Heading "Verify a certificate".
- Two-panel form:
  - Left: `<textarea>` for manifest JSON (monospace). "Load from cert id" helper — input a uuid, fetch `/certificates/{id}/manifest`, paste into textarea.
  - Right: optional `<textarea>` for the original text (enables text-hash check).
  - `Verify` button, disabled while manifest textarea empty or JSON unparseable.
- Below: the result panel — hidden until first verify call returns.
  - Big green check or red X.
  - Itemized `checks` list: one row per key in the `checks` object (e.g. `signature: ✓`, `hash: ✓`, `timestamp: ✓`).
  - `warnings` list (yellow) if present.
- Legal disclaimer card at the bottom.

### Data flow
- Client-only page. On submit:
  - Parse the manifest textarea via `JSON.parse` in a try/catch. On parse error → show inline parse error, don't call API.
  - `POST /verify` with `{ manifest, text?: original }`.
  - On 200 → render `VerifyResponse` (`valid`, `checks`, `warnings`).
  - On 422 → show the validation error.
  - On 5xx → show error + retry.

### Test cases
- **Happy valid**: mocked `{valid: true, checks: {signature: true, hash: true, timestamp: true}, warnings: []}` → green verdict, 3 ✓ rows.
- **Happy invalid**: mocked `{valid: false, checks: {signature: false, hash: true, timestamp: true}, warnings: ["signature mismatch"]}` → red verdict, 1 ✗ row, 1 yellow warning.
- **Unparseable manifest**: invalid JSON in textarea → inline "Invalid JSON" error, API not called (assert fetch mock not called).
- **Empty manifest**: verify button disabled.
- **Load-from-cert-id**: enter a uuid → click helper → mocked `/certificates/{id}/manifest` response populates the textarea.
- **Load-from-cert-id: 404** → inline "Certificate not found".
- **Backend 500** → error panel with retry.
- **Legal disclaimer present**.

### Acceptance
- [ ] Manifest JSON parse errors caught client-side before any API call
- [ ] Every check in the backend response renders as its own row
- [ ] Green/red verdict is unambiguous (aria-label'd for screen readers)
- [ ] Warnings render yellow, clearly distinct from failed checks
- [ ] Legal disclaimer present

---

## `/compare`

### Goal
Given a parent certificate id and a new piece of text, fetch the diff verdict from the backend and render a visual diff + verdict badge.

### Layout
- Heading "Compare to a certificate".
- Form: `parent_id` input (uuid), `<textarea>` for new text, `Compare` button.
- Result panel:
  - Verdict badge: `identical | near-duplicate | derivative | inspired | unrelated` — colour-coded.
  - Stats row: `overlap_pct%`, `hamming`, `cosine` (2 decimals).
  - Diff view: `react-diff-viewer-continued` rendering `originalText` vs `newText`. For v0.1 we get the original text via `GET /certificates/{parent_id}/download`.

### Data flow
- Client-only page. On submit:
  1. Parallel: `GET /certificates/{parent_id}/download` (original text) + `POST /diff` `{parent_id, text: new}`.
  2. When both resolve → render.

### Test cases
- **Happy verdict: derivative** — mocked diff response → badge is amber "derivative", stats displayed, diff view present.
- **Happy verdict: identical** — badge green, stats show `overlap_pct=100`, diff view shows no changes.
- **Happy verdict: unrelated** — badge grey, stats low.
- **Parent not found**: `/download` 404 → inline error, don't render diff.
- **Invalid parent_id** (not uuid) → button disabled / client-side form error.
- **Empty new text**: button disabled.
- **Backend 500 on diff**: error + retry.
- **Both requests in flight**: single combined loading state, not two spinners.

### Acceptance
- [ ] All 5 verdicts render with distinct colours
- [ ] Diff view shows changed spans
- [ ] Parent-not-found fails fast without hanging
- [ ] Loading state is single and combined

---

## `/leak/[id]` — streaming scan terminal

### Goal
Show a live-updating terminal of leak-scan events for a given `scan_id`, following SSE from `GET /leak-scan/{scan_id}/stream`.

### Layout
- Heading: `Leak scan {scan_id}` (monospace).
- Status chip: `pending | running | done | failed`.
- Terminal box — monospace, dark, append-only. Each SSE event is a new line.
- Hit cards below — each hit from the response: corpus name, snapshot id, confidence, first 3 result URLs with excerpts.
- When status becomes `done` or `failed`, the SSE source closes. If the user arrives at a already-finished scan, fall back to `GET /leak-scan/{scan_id}` once and render.

### Data flow
- Client-only page.
- On mount: open `EventSource` at `${NEXT_PUBLIC_API_URL}/leak-scan/${id}/stream`.
- For each `message` event: `JSON.parse` and push to a zustand/local-state events array; update status.
- On `error`: close source, fall back to `GET /leak-scan/{id}` once, render final state or error panel.
- On unmount: close source.

### Test cases
- **Happy stream**: mock EventSource → dispatch 4 events (`started`, `scanning corpus_a`, `hit found`, `done`) → terminal shows 4 lines, status becomes `done`, hit cards render.
- **Scan already finished**: mock EventSource to error immediately → fallback to mocked `GET /leak-scan/{id}` → final state renders.
- **Invalid scan_id** (not uuid) → render `notFound()`.
- **Backend 404** on fallback → "Scan not found" error.
- **User navigates away mid-stream** → EventSource.close() called (assert on the mock).
- **Very long stream** (≥100 events) → terminal remains scrolled to bottom unless user has scrolled up (nice-to-have, not blocking S4).

### Acceptance
- [ ] SSE connects and appends events in order
- [ ] Status chip transitions match backend
- [ ] EventSource is closed on unmount and on `done`/`failed`
- [ ] Fallback to polling works when SSE fails
- [ ] Hit cards render corpus, snapshot, confidence, URL list

---

## Out of scope for S4

- `/demo` (chromeless iframe embed) — future polish pass
- Dark-mode polish beyond the CSS vars already in place
- i18n
- Authentication (the MVP is intentionally public)
- Rate-limit feedback UX (backend rate-limits; we surface 429s generically)
