# 03 — Site metadata

## Goal

Define what a browser tab, a search result, a home-screen install and a link preview see for
every route in [00-pages.md](00-pages.md). One validated config drives all of it, so a bad origin
fails the build instead of shipping into every link preview.

## One config, parsed when it loads

`src/lib/site/config.ts` defines the site once: the brand name, the default title, the
description, the production origin, the accent, keywords, the share card's copy, and which
routes are public (listed in the sitemap) or private (disallowed in robots.txt). Everything
below is derived from it.

The production origin is `https://inkprint-frontend.vercel.app`. `NEXT_PUBLIC_SITE_URL`
(`src/lib/env.ts`) stays what it is: the origin the certificate card's verify and share links
point at, which is `localhost` in development and CI. It is never the `metadataBase`.

`defineSite` parses the config when the module loads and throws a `SiteConfigError` on:
- a `url` that is not a URL, is not `https:`, or is not a bare origin (a path or a trailing
  slash);
- a host on the never-use list (`knowledge/infrastructure/infra-never-use-hosts.md` in the
  workspace): strangers own those hosts, and a link preview must never point at one;
- a name longer than 12 characters (the manifest's `short_name`), a title longer than 70, or a
  description outside 50 to 160 characters (search results cut longer ones);
- an accent that is not `#rrggbb`;
- a highlight that does not occur in the headline;
- a route that does not start with `/`, or a sitemap route under a disallowed prefix.

## The head

The root layout exports `metadata` and `viewport` built from the config:
- `metadataBase` is the production origin, so every image URL is absolute;
- the title has a default (`inkprint — content provenance`) and the template `%s — inkprint`;
- description, application name, author, keywords, and `formatDetection` off (iOS must not
  turn numbers on a page into phone links);
- Open Graph: `type: website`, the site name and the locale. It has **no** title, description
  or url: Next fills `og:title` and `og:description` from each page's own, and a root `og:url`
  would claim that every page is the home page;
- `twitter:card` is `summary_large_image`. Next fills the Twitter title, description and
  image from Open Graph, so there is no separate `twitter-image`;
- no canonical at the root, for the same reason as `og:url`. The home page sets its own (`/`);
- viewport: `theme-color` `#0a0a0a` and `color-scheme: dark`.

## Page titles

Every page sets a short lowercase title; the template appends ` — inkprint`. No page sets
`openGraph` or `twitter` (a page-level `openGraph` would replace the root one and drop the share
image).

Every indexable page other than `/` describes itself and names itself as canonical through
`pageMetadata(site, route, { title, description })` (`src/lib/site/metadata.ts`, 2026-10-21). It
returns the title, the description and the route as canonical, and throws a `SiteConfigError`
when the module loads on an empty title, a title the template takes past 70 characters, or a
description outside 50 to 160 characters, so bad copy fails the build. Next fills
`og:description` and `twitter:description` from the description. No two indexable pages share a
description.

| Route | Title | Description | Indexed | Where it is set |
|---|---|---|---|---|
| `/` | the default title | the site's | yes | `page.tsx`: canonical `/` only |
| `/verify` | `verify a c2pa manifest` | `Paste a C2PA manifest or load one by certificate id, then check its Ed25519 signature, content hash and timestamp, with the original text if you have it.` | yes, canonical `/verify` | `verify/layout.tsx` (the page is a client component) |
| `/compare` | `derivative-work detection` | `Diff a new text against a certified parent with SimHash and embedding cosine: identical, near-duplicate, derivative, inspired or unrelated.` | yes, canonical `/compare` | `compare/layout.tsx` (the page is a client component) |
| `/certificates/[id]` | `certificate <first 8 of id>` | no | `generateMetadata`, from the param only |
| `/leak/[id]` | `leak scan <first 8 of id>` | no | `generateMetadata`, from the param only |

`/verify` and `/compare` are titled by the `//` comment line that heads each page, and that line
is the page's one `<h1>` (`<Prompt kind="comment" as="h1">`, 2026-10-21): it looks the same, and a
search engine reads the title the tab shows. The two dynamic titles are built from the route param and never fetch: a certificate is
already fetched by the page, and metadata must not add a second round-trip to a cold backend.

`/certificates/[id]` and `/leak/[id]` show a user's own certificate and leak scan, so they set
`robots: { index: false }`. They are **not** disallowed in robots.txt: link-preview bots such as
Twitterbot obey robots.txt, and a shared certificate must still get its preview.

## Structured data

`/` renders one `<script type="application/ld+json">` (`src/lib/site/structured-data.tsx`,
2026-10-21): a schema.org `@graph` of a `WebSite` (`<origin>/#website`: url, name, description,
`inLanguage: "en"`, the author as publisher), a `WebApplication` (`<origin>/#app`: url, name,
description, `applicationCategory: "DeveloperApplication"`, `operatingSystem: "Any"`,
`isAccessibleForFree: true`, part of the website, by the author) and the author as a `Person`
(`https://github.com/Abdul-Muizz1310#person`), all from the config. Search engines read the site
name from the `WebSite` node, so a result says `inkprint`, not `vercel.app`. No rating, review or
price is claimed. Every `<` in the JSON is escaped as `\u003c`, so no value can close the script
tag.

## Icons

The icon is the nav's brand tile: the lucide Feather glyph in `--accent-ink` (`#e0b55e`) on the
surface colour, with a faint accent glow. `src/app/icon.svg` is the source. The rasters are
rendered from it:
- `src/app/favicon.ico`: 16, 32 and 48 px (it replaces the stock create-next-app favicon);
- `src/app/apple-icon.png`: 180 px, full-bleed, because iOS rounds the corners itself;
- `public/icon-192.png` and `public/icon-512.png` for the manifest, plus
  `public/icon-maskable-512.png`, with the glyph inside the maskable safe zone.

## Manifest, robots, sitemap

- `manifest.webmanifest`: name, short name, description, `start_url` and `scope` `/`,
  `display: standalone`, dark background and theme colours, the three PNG icons.
- `robots.txt`: allow `/`, disallow only machine endpoints (`/api/`, the signing proxy of spec 04),
  point at the sitemap.
- `sitemap.xml`: absolute URLs of `/`, `/verify` and `/compare`.

## The share card

`opengraph-image` is a 1200×630 PNG rendered at build time with `next/og`: the brand tile, the
name, the `//` comment line (`a cryptographic provenance ledger for text`), the headline
(`prove who wrote it first.`) with the highlight (`first`) in the accent and underlined, and the
live host. It is set in Geist Mono, vendored as subset TTFs under `src/lib/site/fonts/` with its
OFL licence, because `next/og` cannot read the fonts `next/font` loads.

The headline is set at the largest size, from 96 px down to 48 px in steps of 8, at which it
wraps to at most two lines across the card's 1056 px. Every Geist Mono glyph is 0.6 em wide,
so the wrap is computed exactly, not measured. inkprint's headline fits at 96 px:
`prove who wrote it` (18 columns, the full line) and `first.`.

### Test cases

Unit tests live in `tests/lib/site/`; the E2E case in `tests/e2e/metadata.spec.ts`.

- **T-FE-01** `defineSite` accepts the real config and derives its origin.
- **T-FE-02** `defineSite` rejects each case in "One config", naming the reason.
- **T-FE-03** the root metadata: `metadataBase`, the title template, description, author,
  Open Graph with no title, description or url, the Twitter card, no `alternates`.
- **T-FE-04** the viewport colours.
- **T-FE-05** the manifest's fields, and every icon it lists exists in `public/` at its
  declared size.
- **T-FE-06** robots.txt allows the site and names the sitemap on the origin; the sitemap
  lists `/`, `/verify` and `/compare` as absolute URLs, once each.
- **T-FE-07** the icon files: `icon.svg` uses the accent, `favicon.ico` holds 16, 32 and 48,
  `apple-icon.png` is 180×180.
- **T-FE-08** the headline layout: highlight segments, the greedy wrap, the size chosen at each
  boundary (96 px for the real headline), and the share card's alt text.
- **T-FE-09** the page metadata in the table above; the certificate and leak titles come from
  the id without a fetch and are `noindex` with no canonical; the verify and compare layouts
  render their page, and each page's one `<h1>` is its comment line; no page sets `openGraph` or
  `twitter`; every sitemap route names itself as
  canonical, and no two of their descriptions are equal.
- **T-FE-10** (E2E) the home page carries the title, description, `og:image`, the Twitter
  card, the theme colour, the icons and the manifest; `/verify`'s own title flows into
  `og:title`; a leak-scan page is `noindex` and the home page is not; every metadata route
  answers with its content type. The backend is stubbed with `page.route`, so the spec makes no
  request to it. `og:image` is on the production origin in a production build; `next dev` (the
  Playwright webServer) puts file-based share images on its own origin by design, so the spec
  accepts exactly those two origins, requires `/opengraph-image` to serve a PNG, and leaves
  `metadataBase` to T-FE-03. The certificate page fetches on the server, where `page.route`
  cannot reach, so its `noindex` is covered by T-FE-09.

- **T-FE-11** `pageMetadata` returns the title, description and canonical; it accepts a title
  the template takes to exactly 70 characters and descriptions of exactly 50 and 160; it rejects
  an empty title, a title past 70 with the template, and a description under 50 or over 160,
  naming the page and the reason.
- **T-FE-12** the structured data: the graph above, derived from the config; its serialisation
  escapes `<` and parses back to the same value; it renders as one `application/ld+json`
  script.
- **T-FE-13** (E2E) `/` carries exactly one structured-data script whose `WebSite` node names
  the site on the production origin; `/verify` carries its own description in `description` and
  `og:description`, and a canonical ending in `/verify`.

### Acceptance

- [ ] A bad config fails `pnpm build`, never ships
- [ ] Every metadata route (`/opengraph-image`, `/icon.svg`, `/apple-icon.png`,
      `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`) is prerendered at build time
- [ ] `og:image` is absolute, on `https://inkprint-frontend.vercel.app`
- [ ] Every page title is `<page> — inkprint`, and the same text is its `og:title`
- [ ] Certificate and leak-scan pages are `noindex` and still previewable when shared
- [ ] The share card's headline fits on two lines, nothing clipped
