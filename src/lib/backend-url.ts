/**
 * Where browser code reaches the backend (spec 04 §3): the same-origin signing
 * proxy `src/app/api/backend/[...path]/route.ts`. The browser never calls the
 * backend's origin, holds no token and does not even know the backend's URL.
 */

export const BACKEND_PROXY_PREFIX = "/api/backend";

/** The proxy URL for a backend path such as `/health` or `/certificates/<id>`. */
export function proxyUrl(path: string): string {
  return `${BACKEND_PROXY_PREFIX}${path}`;
}
