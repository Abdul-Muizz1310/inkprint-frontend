import { env } from "@/lib/env";
import { proxyToBackend } from "@/lib/server/backend-proxy";

/**
 * Same-origin signing proxy to inkprint-backend (spec 04, DR-0030). The browser
 * calls `/api/backend/<path>`; this checks the route against the allowlist,
 * signs a fresh platform token and forwards to `${NEXT_PUBLIC_API_URL}/<path>`,
 * streaming the answer back (the leak-scan SSE included).
 */

// node:crypto signs the token.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A leak-scan stream can outlive a short function; its own reconnect covers a cut.
export const maxDuration = 300;

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, { params }: Context): Promise<Response> {
  const { path } = await params;
  return proxyToBackend(request, path, env.NEXT_PUBLIC_API_URL);
}

export const GET = forward;
export const POST = forward;
