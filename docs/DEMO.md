# Demo script

A 60-to-90-second live walkthrough for interviews. The flow is designed to
land the emotional payoff (the certificate page) inside the first 30 seconds,
then layer in the differentiators.

**Live URLs:**
- Frontend — https://inkprint-frontend.vercel.app
- Backend  — https://inkprint-backend.onrender.com

Prerequisite: the Render backend should have had at least one request in the
last 15 minutes so its cold-start doesn't eat 20s. A quick `curl
https://inkprint-backend.onrender.com/health` from another tab a minute before
the demo is enough.

---

## 1. The 10-second hook (0:00 → 0:10)

1. Open https://inkprint-frontend.vercel.app in a fresh browser tab.
2. Say:
   > "This is inkprint. It gives any piece of text a cryptographically signed
   > provenance certificate that proves who wrote it first, and later tells you
   > whether it leaked into an AI training corpus."

Do **not** spend time on the landing copy. The point of the landing page is
to get them to the certificate.

## 2. Issue a certificate (0:10 → 0:30)

1. Paste a paragraph into the editor. Use a prepared fixture, not something
   typed live — this is a demo, not a practice run. Suggested fixture:
   > *"The inkprint demo creates a signed certificate for this exact paragraph.
   > Every byte is canonicalised, hashed with SHA-256, and sealed with an
   > Ed25519 signature against a public key anyone can verify offline."*
2. Put your email in the author field.
3. Click **Fingerprint**.
4. Wait for the router transition (typically ~2s warm, ~20s cold).
5. Land on `/certificates/[id]`.

## 3. The payoff (0:30 → 0:50)

The certificate page does the selling for you. Point at each element in order:

1. **Serif headline** — "Certificate of Authorship". Not a JSON blob.
2. **Author, Hash, Issued At, Key ID** — four rows. Click the truncated hash to
   copy the full value.
3. **QR code** — scannable, encodes the verify URL.
4. **Content digest** — monospace preview of the signed text.
5. **Verify footer** — points at `/verify?id=...` so anyone can check the
   signature without trusting inkprint.
6. **Download manifest** — click it. A `inkprint-<id>.json` file lands in
   Downloads. Open it in a second tab if you want to show the C2PA structure.
7. **Share** — copies the certificate URL to the clipboard.

Say:
> "This is a C2PA-aligned manifest — the content-credential schema that the
> EU AI Act's August 2026 detectability requirements are going to cite. The
> signature verifies offline against `/public-key.pem`, so inkprint could
> disappear tomorrow and these certificates stay valid."

## 4. Verify it (0:50 → 1:05)

1. Open `/verify` in a new tab.
2. Paste the downloaded manifest JSON into the left pane.
3. Click **Verify**.
4. Green verdict with itemised checks: signature ✓, hash ✓, timestamp ✓.

Say:
> "Every check is done client-side against the published public key. No trust
> in inkprint required."

## 5. Compare a derivative (1:05 → 1:20)

1. Open `/compare`.
2. Paste the certificate id from step 2 into the parent id field.
3. Paste a *lightly edited* version of the original text into the new-text
   field. (Swap one word, add one sentence.)
4. Click **Compare**.
5. Point at the verdict badge: "near-duplicate" or "derivative", colour-coded,
   with the overlap percent next to it.

Say:
> "SimHash plus cosine similarity against the stored embedding. The backend
> classifies five verdicts — identical, near-duplicate, derivative, inspired,
> unrelated. The cutoffs are tuned on a 100-pair eval set."

## 6. Training-corpus leak scan (1:20 → 1:30) — optional

Only show this if the backend has a pre-seeded `scan_id` ready. Cold scans take
too long for a live demo.

1. Open `/leak/<pre-seeded-scan-id>`.
2. The terminal appends events as they stream from the backend: `started →
   scanning common_crawl → hit found → done`.

Say:
> "The scan probe hits Common Crawl's CDX index and HuggingFace's datasets
> search for near-duplicate matches. This is the part that answers 'did my
> words end up in somebody's training set' — which is the core question of the
> EU AI Act's detectability clause."

## 7. The close

> "All of this — the certificate, the verify page, the diff, the leak scan —
> is wrapped around standards I didn't invent: C2PA, SimHash, Ed25519, Common
> Crawl. The product is the assembly. The legal framing is Berne-Convention
> fixation plus EU AI Act Article 50. The code is BUSL-1.1 in both repos."

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Fingerprint" hangs past 25s | Backend cold start on Render free | Wait. Don't refresh. The request is in flight. |
| "Unexpected error" on fingerprint | Backend changed a schema | Check `curl /openapi.json` vs `src/lib/schemas.ts`. |
| Certificate page 404s | Race between POST and router push | Refresh — the cert exists, the navigation raced. |
| QR code missing | `/certificates/{id}/qr` 500 | Known backend flake on first scan; reload page. |

## What not to demo

- The Monaco editor — we ship a textarea fallback. Don't say "Monaco" out loud.
- `/search` — exists on the backend, not wired into the frontend for v0.1.0.
- Dark mode — the palette is defined but the toggle isn't built.
- Mobile — the layout works but isn't tuned. Demo on a laptop.
