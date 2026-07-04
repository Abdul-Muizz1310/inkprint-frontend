import { z } from "zod";

/**
 * Zod mirrors of the inkprint-backend OpenAPI response shapes.
 * Source of truth: https://inkprint-backend.onrender.com/openapi.json
 *
 * Unknown fields pass through (backend may add fields); required fields
 * must validate or parsing throws.
 */

export const CertificateResponse = z
  .object({
    id: z.string(),
    author: z.string(),
    content_hash: z.string(),
    // The backend's simhash is a 64-bit unsigned integer that routinely
    // exceeds Number.MAX_SAFE_INTEGER. We keep it as `number` (JS loses
    // precision but that's fine for display) and do NOT assert `.int()`
    // because Zod v4 rejects values outside the safe-integer range.
    simhash: z.number(),
    content_len: z.number().int(),
    language: z.string().nullable(),
    issued_at: z.string(),
    signature: z.string(),
    manifest: z.record(z.string(), z.unknown()),
    storage_key: z.string(),
    // Optional server-rendered preview of the document's leading characters.
    // When present, the certificate page renders the digest preview from this
    // field instead of downloading the entire (up to ~1 MiB) document body.
    // Absent on backends that don't yet expose it → callers fall back to the
    // full download. Typed + parsed here so consumers never `as`-cast it.
    content_preview: z.string().optional(),
  })
  .passthrough();
export type CertificateResponse = z.infer<typeof CertificateResponse>;

export const VerifyResponse = z.object({
  valid: z.boolean(),
  checks: z.record(z.string(), z.boolean()),
  warnings: z.array(z.string()),
});
export type VerifyResponse = z.infer<typeof VerifyResponse>;

export const DiffVerdict = z.enum([
  "identical",
  "near-duplicate",
  "derivative",
  "inspired",
  "unrelated",
]);
export type DiffVerdict = z.infer<typeof DiffVerdict>;

export const DiffResponse = z.object({
  hamming: z.number().int(),
  cosine: z.number(),
  verdict: DiffVerdict,
  overlap_pct: z.number().int(),
  changed_spans: z.array(z.unknown()).optional().default([]),
});
export type DiffResponse = z.infer<typeof DiffResponse>;

export const LeakScanResponse = z.object({
  scan_id: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
});
export type LeakScanResponse = z.infer<typeof LeakScanResponse>;

/**
 * The manifest is an opaque C2PA JSON object. We do not own its internal
 * schema (the backend / C2PA spec does), but we still refuse anything that
 * isn't a JSON object at the boundary — never a raw `as` cast.
 */
export const ManifestResponse = z.record(z.string(), z.unknown());
export type ManifestResponse = z.infer<typeof ManifestResponse>;

/**
 * Polled leak-scan result. `status` is validated against the same enum as
 * the create response; `hits` (present once the scan is done) is an opaque
 * array whose element shape the backend owns. `.passthrough()` keeps any
 * extra fields the backend adds without silently dropping them.
 *
 * (A full discriminated-union per status would require the backend to
 * document a distinct shape per state, which it does not; parsing the
 * discriminant + the one field the UI reads is the honest boundary here.)
 */
export const LeakScanResult = z
  .object({
    scan_id: z.string(),
    status: z.enum(["pending", "running", "done", "failed"]),
    hits: z.array(z.unknown()).optional(),
  })
  .passthrough();
export type LeakScanResult = z.infer<typeof LeakScanResult>;

/**
 * Streaming event union for the /leak-scan/{id}/stream SSE feed.
 * The backend emits JSON-encoded messages; this is the shape we expect.
 */
export const LeakEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started") }),
  z.object({
    type: z.literal("scanning"),
    corpus: z.string(),
    snapshot: z.string().optional(),
  }),
  z.object({
    type: z.literal("hit"),
    corpus: z.string(),
    url: z.string(),
    excerpt: z.string(),
    score: z.number(),
  }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("failed"), reason: z.string() }),
]);
export type LeakEvent = z.infer<typeof LeakEvent>;
