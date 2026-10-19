import { defineSite } from "./define";

/** Everything a tab, a search result, an install and a link preview say about inkprint. */
export const SITE = defineSite({
  name: "inkprint",
  title: "inkprint — content provenance",
  description:
    "Issue a cryptographically signed provenance certificate for any document. Prove who wrote it, what changed, and whether it leaked into AI training data.",
  url: "https://inkprint-frontend.vercel.app",
  accent: "#e0b55e",
  keywords: [
    "content provenance",
    "C2PA",
    "Ed25519",
    "authorship",
    "certificate",
    "AI training data",
  ],
  card: {
    comment: "a cryptographic provenance ledger for text",
    headline: "prove who wrote it first.",
    highlight: "first",
  },
  // Certificates and leak scans are a user's own records: their pages set noindex instead.
  // `/api/` is the signing proxy (spec 04): a machine endpoint.
  routes: { sitemap: ["/", "/verify", "/compare"], disallow: ["/api/"] },
});
