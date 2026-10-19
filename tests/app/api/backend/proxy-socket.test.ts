// @vitest-environment node
import { createPublicKey, verify } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { decodePart, ed25519Pair } from "../../../lib/server/keys";

/**
 * The composed flow over real sockets: the real route, real minting, real
 * `fetch`, and a local `node:http` backend that — like inkprint-backend under
 * contract v2 — answers 401 to a token that does not verify with the frontend's
 * public key or names another audience, and streams the leak-scan SSE with a
 * pause the test controls. Nothing leaves 127.0.0.1.
 */

const ID = "550e8400-e29b-41d4-a716-446655440000";
const pair = ed25519Pair();
const publicKey = createPublicKey({
  key: Buffer.from(pair.publicB64, "base64"),
  format: "der",
  type: "spki",
});
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

type Seen = {
  method: string;
  path: string;
  claims: Record<string, unknown> | null;
  xff: string | null;
};
const seen: Seen[] = [];
let release: () => void = () => {};
let server: Server;
let route: typeof import("@/app/api/backend/[...path]/route");

function verifiedClaims(token: string | undefined): Record<string, unknown> | null {
  const [h, c, s] = (token ?? "").split(".");
  if (!h || !c || !s) return null;
  const ok = verify(
    null,
    Buffer.from(`${h}.${c}`, "ascii"),
    publicKey,
    Buffer.from(s, "base64url"),
  );
  if (!ok) return null;
  const claims = decodePart(c);
  return claims.aud === "inkprint" && claims.iss === "inkprint-frontend" ? claims : null;
}

function backend(req: IncomingMessage, res: ServerResponse): void {
  const path = req.url ?? "";
  const claims = verifiedClaims(req.headers["x-platform-token"] as string | undefined);
  const xff = (req.headers["x-forwarded-for"] as string | undefined) ?? null;
  seen.push({ method: req.method ?? "", path, claims, xff });
  if (claims === null) {
    res
      .writeHead(401, { "content-type": "application/json" })
      .end('{"detail":"invalid_platform_token"}');
    return;
  }
  if (path === `/leak-scan/${ID}/stream`) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"type":"status","status":"running"}\n\n');
    new Promise<void>((resolve) => {
      release = resolve;
    }).then(() => res.end('data: {"type":"complete"}\n\n'));
    return;
  }
  if (path === `/certificates/${ID}/qr`) {
    res.writeHead(200, { "content-type": "image/png" }).end(PNG);
    return;
  }
  if (path === "/certificates" && req.method === "POST") {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      res.writeHead(201, { "content-type": "application/json" }).end(Buffer.concat(chunks));
    });
    return;
  }
  res.writeHead(404).end();
}

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

type Handler = typeof route.GET;
function request(path: string[], init: RequestInit = {}): Request {
  return new Request(`http://localhost:3000/api/backend/${path.join("/")}`, {
    ...init,
    headers: { "x-forwarded-for": "203.0.113.7", ...(init.headers ?? {}) },
  });
}

beforeAll(async () => {
  server = createServer(backend);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv("NEXT_PUBLIC_API_URL", `http://127.0.0.1:${port}`);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE", pair.privateB64);
  vi.resetModules();
  route = await import("@/app/api/backend/[...path]/route");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("proxy over real sockets", () => {
  it("P11 the leak-scan stream arrives event by event, not buffered until the end", async () => {
    const res = await route.GET(
      request(["leak-scan", ID, "stream"]) as Parameters<Handler>[0],
      ctx(["leak-scan", ID, "stream"]),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("no stream");

    const timeout = new Promise<"buffered">((resolve) =>
      setTimeout(() => resolve("buffered"), 2000),
    );
    const first = await Promise.race([reader.read(), timeout]);
    expect(first).not.toBe("buffered");
    if (first === "buffered") return;
    expect(new TextDecoder().decode(first.value)).toContain('"running"');

    release();
    let rest = "";
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      rest += new TextDecoder().decode(next.value);
    }
    expect(rest).toContain('"complete"');
  });

  it("P12 the QR PNG crosses the socket byte for byte", async () => {
    const res = await route.GET(
      request(["certificates", ID, "qr"]) as Parameters<Handler>[0],
      ctx(["certificates", ID, "qr"]),
    );
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("P10 a POST body reaches the backend unchanged and signed", async () => {
    const body = JSON.stringify({ text: "Café ☕", author: "a@b.c" });
    const res = await route.POST(
      request(["certificates"], {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
      }) as Parameters<Handler>[0],
      ctx(["certificates"]),
    );
    expect(res.status).toBe(201);
    expect(await res.text()).toBe(body);
  });

  it("every request the backend saw was signed for inkprint, fresh, and carried the visitor", () => {
    expect(seen.length).toBeGreaterThanOrEqual(3);
    const jtis = new Set<unknown>();
    for (const r of seen) {
      expect(r.claims, `${r.method} ${r.path}`).not.toBeNull();
      expect(r.claims).toMatchObject({
        role: "frontend",
        sub: "inkprint-frontend",
        service: "inkprint",
      });
      expect(r.xff).toBe("203.0.113.7");
      jtis.add(r.claims?.jti);
    }
    expect(jtis.size).toBe(seen.length);
  });
});
