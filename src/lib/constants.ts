/**
 * Shared client/server constants.
 *
 * `MAX_TEXT_BYTES` mirrors the inkprint-backend request-body limit (1 MiB).
 * It is the single source of truth for the size cap and is enforced in three
 * places off this one constant:
 *   1. the Editor disables submit above it (UX affordance);
 *   2. `createCertificate` in api.ts *rejects* oversized text before any
 *      network call (the real fail-closed defense — a disabled button is not a
 *      guarantee, a direct API call is);
 *   3. `tests/lib/constants.test.ts` pins the value and asserts (2) behaves,
 *      so the front-end and backend limits can only drift with a failing test.
 *
 * The one thing the front-end *cannot* self-verify is that the backend
 * enforces the same ceiling — that requires reading the backend's own limit
 * (see needs_user). This constant is the contract we hold ourselves to.
 */
export const MAX_TEXT_BYTES = 1_048_576; // 1 MiB

/**
 * Number of leading characters shown in the certificate page's digest preview.
 * Single source of truth: the api layer sizes its prefix fetch off this and the
 * page slices to it, so the preview length and the bytes pulled over the wire
 * can't drift apart. See `getCertificateDownloadPreview` (OPT-2).
 */
export const PREVIEW_CHARS = 200;

/**
 * UTF-8 byte length of a string — the unit the cap is expressed in (the wire
 * payload is UTF-8, not UTF-16 code units, so `.length` would undercount
 * multibyte text). Single source of truth for byte measurement across the
 * Editor's live counter and the api-layer guard.
 */
export function textByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
