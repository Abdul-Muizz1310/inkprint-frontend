// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { decodePart, ed25519Pair, verifiesWith } from "../../../lib/server/keys";

/**
 * The composed proxy: the real route module, the real token minting and the
 * real allowlist and header rules. Only `fetch` stands in for the backend, so
 * nothing here opens a socket (proxy-socket.test.ts does that).
 */

const BACKEND = "http://backend.test";
const ID = "550e8400-e29b-41d4-a716-446655440000";
const pair = ed25519Pair();

type RouteModule = typeof import("@/app/api/backend/[...path]/route");
type Handler = RouteModule["GET"];

let route: RouteModule;
let fetchMock: Mock<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>;

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function call(
  handler: Handler,
  path: string[],
  init: RequestInit & { query?: string } = {},
): Promise<Response> {
  const { query = "", ...rest } = init;
  const url = `http://localhost:3000/api/backend/${path.join("/")}${query}`;
  return handler(new Request(url, rest) as Parameters<Handler>[0], ctx(path));
}

function upstreamCall(index = 0): { url: string; init: RequestInit; headers: Headers } {
  const [input, init] = fetchMock.mock.calls[index];
  return {
    url: input instanceof URL ? input.href : String(input),
    init: init ?? {},
    headers: new Headers(init?.headers),
  };
}

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BACKEND);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE", pair.privateB64);
  fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  route = await import("@/app/api/backend/[...path]/route");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("segment config", () => {
  it("P13 exports GET and POST only, on the Node runtime, dynamic, 300 s", () => {
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    const exported = route as Record<string, unknown>;
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      expect(exported[method]).toBeUndefined();
    }
    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.maxDuration).toBe(300);
  });
});

describe("forwarding", () => {
  it("P9 GET reaches the backend with a valid contract-v2 token and the fetch options", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"id":"x"}', {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "req-9" },
      }),
    );
    const res = await call(route.GET, ["certificates", ID], {
      headers: {
        accept: "application/json",
        "x-request-id": "req-9",
        "x-forwarded-for": "203.0.113.7",
        cookie: "session=secret",
        authorization: "Bearer leaked",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const up = upstreamCall();
    expect(up.url).toBe(`${BACKEND}/certificates/${ID}`);
    expect(up.init.method).toBe("GET");
    expect(up.init.body).toBeUndefined();
    expect(up.init.cache).toBe("no-store");
    expect(up.init.redirect).toBe("manual");
    expect(up.init.signal).toBeInstanceOf(AbortSignal);

    const token = up.headers.get("x-platform-token") ?? "";
    expect(verifiesWith(token, pair.publicB64)).toBe(true);
    const claims = decodePart(token.split(".")[1]);
    expect(claims).toMatchObject({
      iss: "inkprint-frontend",
      aud: "inkprint",
      sub: "inkprint-frontend",
      role: "frontend",
      service: "inkprint",
    });
    expect(Number(claims.exp) - Number(claims.iat)).toBe(60);

    expect(up.headers.get("accept")).toBe("application/json");
    expect(up.headers.get("x-request-id")).toBe("req-9");
    expect(up.headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(up.headers.has("cookie")).toBe(false);
    expect(up.headers.has("authorization")).toBe(false);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("x-request-id")).toBe("req-9");
    expect(await res.text()).toBe('{"id":"x"}');
  });

  it("P9 mints a fresh token for every upstream request", async () => {
    await call(route.GET, ["health"]);
    await call(route.GET, ["health"]);
    const a = upstreamCall(0).headers.get("x-platform-token");
    const b = upstreamCall(1).headers.get("x-platform-token");
    expect(a).not.toBe(b);
  });

  it("P9 passes the upstream status and only the allowlisted response headers", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"error":"rate limit exceeded"}', {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "30",
          "set-cookie": "tracking=1",
          server: "uvicorn",
        },
      }),
    );
    const res = await call(route.POST, ["certificates"], { method: "POST", body: "{}" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.has("set-cookie")).toBe(false);
    expect(res.headers.has("server")).toBe(false);
  });

  it("P10 POST forwards its body byte for byte", async () => {
    const body = JSON.stringify({ text: "Café ☕ — signed.", author: "a@b.c" });
    await call(route.POST, ["certificates"], {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
    const up = upstreamCall();
    expect(up.url).toBe(`${BACKEND}/certificates`);
    expect(up.init.method).toBe("POST");
    expect(up.headers.get("content-type")).toBe("application/json");
    const sent = up.init.body as ArrayBuffer;
    expect(sent).toBeInstanceOf(ArrayBuffer);
    expect(Buffer.from(sent).equals(Buffer.from(body, "utf8"))).toBe(true);
  });

  it("P11 streams SSE: the first event arrives while the upstream is still open", async () => {
    const encoder = new TextEncoder();
    let upstream: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        upstream = controller;
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );

    const res = await call(route.GET, ["leak-scan", ID, "stream"], {
      headers: { accept: "text/event-stream", "last-event-id": "6" },
    });
    expect(upstreamCall().headers.get("last-event-id")).toBe("6");
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");

    const reader = res.body?.getReader();
    if (!reader || !upstream) throw new Error("no stream");
    const first = 'data: {"type":"status","status":"running"}\n\n';
    upstream.enqueue(encoder.encode(first));

    const timeout = new Promise<"buffered">((resolve) =>
      setTimeout(() => resolve("buffered"), 1000),
    );
    const chunk = await Promise.race([reader.read(), timeout]);
    expect(chunk).not.toBe("buffered");
    if (chunk === "buffered") return;
    expect(new TextDecoder().decode(chunk.value)).toBe(first);

    upstream.enqueue(encoder.encode('data: {"type":"complete"}\n\n'));
    upstream.close();
    const rest = await reader.read();
    expect(new TextDecoder().decode(rest.value)).toContain("complete");
    expect((await reader.read()).done).toBe(true);
  });

  it("P11 closing the client request aborts the upstream call", async () => {
    const client = new AbortController();
    await call(route.GET, ["leak-scan", ID, "stream"], { signal: client.signal });
    const signal = upstreamCall().init.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    client.abort();
    expect(signal.aborted).toBe(true);
  });

  it("P12 a QR PNG comes back byte for byte as image/png", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x80]);
    fetchMock.mockResolvedValueOnce(
      new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    );
    const res = await call(route.GET, ["certificates", ID, "qr"]);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
  });

  it("P12 the zip keeps its type and its attachment filename", async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0xfe, 0xca]);
    const disposition = `attachment; filename="${ID}.zip"`;
    fetchMock.mockResolvedValueOnce(
      new Response(zip, {
        status: 200,
        headers: { "content-type": "application/zip", "content-disposition": disposition },
      }),
    );
    const res = await call(route.GET, ["certificates", ID, "download"]);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toBe(disposition);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(zip);
  });

  it("F9 an upstream redirect comes back without being followed or exposing its location", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 307, headers: { location: `${BACKEND}/elsewhere` } }),
    );
    const res = await call(route.GET, ["health"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(307);
    expect(res.headers.has("location")).toBe(false);
  });

  it("F9 a 204 comes back without a body", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await call(route.POST, ["verify"], { method: "POST", body: "{}" });
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });
});

describe("refusals", () => {
  it.each<[string, "GET" | "POST", string[]]>([
    ["certificates/batch", "POST", ["certificates", "batch"]],
    ["verify/batch", "POST", ["verify", "batch"]],
    ["dossiers/envelope", "POST", ["dossiers", "envelope"]],
    ["search", "GET", ["search"]],
    ["metrics", "GET", ["metrics"]],
    ["GET certificates", "GET", ["certificates"]],
    ["a non-UUID id", "GET", ["certificates", "nope"]],
    ["an encoded traversal", "GET", ["%2e%2e", "admin"]],
    ["a dot-dot segment", "GET", ["certificates", "..", "health"]],
    ["no segments", "GET", []],
  ])("F4 %s → 404 and no upstream call", async (_label, method, path) => {
    const handler = method === "GET" ? route.GET : route.POST;
    const res = await handler(
      new Request("http://localhost:3000/api/backend/x", {
        method,
        body: method === "POST" ? "{}" : undefined,
      }) as Parameters<Handler>[0],
      ctx(path),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "unknown backend route" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("F4 a query string → 400 and no upstream call", async () => {
    const res = await call(route.GET, ["leak-scan", ID], { query: "?since=0" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "query not allowed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("F4 a declared body over the cap → 413 and no upstream call", async () => {
    const { MAX_PROXY_BODY_BYTES } = await import("@/lib/server/proxy-rules");
    const res = await call(route.POST, ["certificates"], {
      method: "POST",
      body: "{}",
      headers: { "content-length": String(MAX_PROXY_BODY_BYTES + 1) },
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload too large" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("F4 an actual body over the cap → 413 and no upstream call", async () => {
    const { MAX_PROXY_BODY_BYTES } = await import("@/lib/server/proxy-rules");
    const res = await call(route.POST, ["certificates"], {
      method: "POST",
      body: "x".repeat(MAX_PROXY_BODY_BYTES + 1),
    });
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("F7 a missing key → 503, no upstream call, and the log names the variable", async () => {
    vi.stubEnv("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(route.GET, ["certificates", ID]);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "proxy not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE");
    expect(logged).toContain("missing");
  });

  it("F7 a malformed key → 503, no upstream call, and the log never holds the value", async () => {
    const bad = "c2VjcmV0LWJ1dC1ub3QtYS1rZXk=";
    vi.stubEnv("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE", bad);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(route.POST, ["certificates"], { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("INKPRINT_FRONTEND_SIGNING_KEY_PRIVATE");
    expect(logged).toContain("malformed");
    expect(logged).not.toContain(bad);
  });

  it("F8 an unreachable backend → 502, logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await call(route.GET, ["certificates", ID]);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "backend unreachable" });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("F8 a fetch aborted because the browser left is not logged as a backend failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      client.abort();
      throw new DOMException("This operation was aborted", "AbortError");
    });
    const res = await call(route.GET, ["leak-scan", ID, "stream"], { signal: client.signal });
    expect(res.status).toBe(502);
    expect(log).not.toHaveBeenCalled();
  });
});
