# Why inkprint-frontend

## The obvious version

A Next.js form that POSTs text to the backend and renders the JSON response as
a table. One page, one table, done.

## Why I built it differently

The JSON-as-a-table version wastes the only emotional moment the product has.
Provenance tools live or die on the *certificate* — the thing a user screenshots
and shares. So `/certificates/[id]` is a React Server Component that fetches the
certificate **and** the first 200 chars of original text in parallel, then hands
a parsed `CertificateResponse` to a pure presentational `CertificateCard`: serif
headline, watermark SVG, QR, truncated-hash copy-on-click, download-manifest,
share. Every fetch goes through a Zod-parsed typed client, so backend drift
fails loud at the edge — exactly how the simhash 64-bit integer issue got caught
during the very first live E2E, not in a production incident a week later. The
tradeoff I rejected: fetch-on-client with TanStack Query on the certificate
page. Simpler to wire, but it adds a loading flicker on the one page where the
payoff needs to land instantly. RSC hides the latency inside the router
transition, which is worth the extra server surface.

## What I'd change if I did it again

Monaco. The spec allows a textarea fallback and I took it — Monaco's lazy-load
plus SSR was a rabbit hole on Spec-TDD day one, and the MVP fingerprints just
fine without it. But a syntax-highlighted editor would pull the perceived
quality up a full grade, and that's the entire point of the frontend.
