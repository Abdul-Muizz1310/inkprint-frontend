/**
 * Canonical UUID (v4-shaped) validation, shared by every route and API call
 * that accepts a certificate / scan id from external input.
 *
 * Negative-space: an id that is not UUID-shaped can never be a real backend
 * resource, so we reject it before it is spliced into a URL or sent over the
 * wire. This is the single source of truth — `/compare`, `/leak/[id]`,
 * `/verify` and `/certificates/[id]` all gate on `isUuid`.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
