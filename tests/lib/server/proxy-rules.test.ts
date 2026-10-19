// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_TEXT_BYTES } from "@/lib/constants";
import {
  downstreamResponseHeaders,
  MAX_PROXY_BODY_BYTES,
  resolveUpstream,
  upstreamRequestHeaders,
} from "@/lib/server/proxy-rules";

const BASE = "https://inkprint-backend.onrender.com";
const ID = "550e8400-e29b-41d4-a716-446655440000";

function resolved(method: string, segments: string[], search = "", base = BASE): string | null {
  const result = resolveUpstream(base, method, segments, search);
  return result.ok ? result.url.href : null;
}

describe("resolveUpstream: the route allowlist", () => {
  it.each([
    ["GET", ["health"], "/health"],
    ["POST", ["certificates"], "/certificates"],
    ["GET", ["certificates", ID], `/certificates/${ID}`],
    ["GET", ["certificates", ID, "manifest"], `/certificates/${ID}/manifest`],
    ["GET", ["certificates", ID, "qr"], `/certificates/${ID}/qr`],
    ["GET", ["certificates", ID, "download"], `/certificates/${ID}/download`],
    ["POST", ["verify"], "/verify"],
    ["POST", ["diff"], "/diff"],
    ["POST", ["leak-scan"], "/leak-scan"],
    ["GET", ["leak-scan", ID], `/leak-scan/${ID}`],
    ["GET", ["leak-scan", ID, "stream"], `/leak-scan/${ID}/stream`],
  ])("P6 %s %j resolves onto the backend", (method, segments, path) => {
    expect(resolved(method, segments)).toBe(`${BASE}${path}`);
  });

  it("P6 accepts an upper-case UUID and keeps a base path", () => {
    const upper = ID.toUpperCase();
    expect(resolved("GET", ["certificates", upper], "", `${BASE}/api/`)).toBe(
      `${BASE}/api/certificates/${upper}`,
    );
  });

  it.each([
    ["no segments", "GET", []],
    ["search", "GET", ["search"]],
    ["certificates/batch", "POST", ["certificates", "batch"]],
    ["verify/batch", "POST", ["verify", "batch"]],
    ["dossiers/envelope", "POST", ["dossiers", "envelope"]],
    ["metrics", "GET", ["metrics"]],
    ["docs", "GET", ["docs"]],
    ["openapi.json", "GET", ["openapi.json"]],
    ["public-key.pem", "GET", ["public-key.pem"]],
    ["GET certificates", "GET", ["certificates"]],
    ["POST certificates/{id}", "POST", ["certificates", ID]],
    ["GET verify", "GET", ["verify"]],
    ["POST health", "POST", ["health"]],
    ["PUT certificates", "PUT", ["certificates"]],
    ["DELETE leak-scan/{id}", "DELETE", ["leak-scan", ID]],
    ["a non-UUID id", "GET", ["certificates", "not-a-uuid"]],
    ["a UUID without dashes", "GET", ["certificates", ID.replace(/-/g, "")]],
    ["an encoded traversal id", "GET", ["certificates", "%2e%2e"]],
    ["a dot-dot id", "GET", ["certificates", ".."]],
    ["a dot id", "GET", ["certificates", "."]],
    ["a slash in the id", "GET", ["certificates", `${ID}/x`]],
    ["a backslash", "GET", ["certificates", `${ID}\\x`]],
    ["an @", "GET", ["certificates", `evil.com@${ID}`]],
    ["a colon", "GET", ["certificates", `https:${ID}`]],
    ["a space", "GET", ["certificates", `${ID} `]],
    ["a NUL byte", "GET", ["certificates", `${ID}\u0000`]],
    ["a non-ASCII character", "GET", ["certificates", `${ID}é`]],
    ["an extra segment", "GET", ["certificates", ID, "qr", "x"]],
    ["an empty segment", "GET", ["certificates", ""]],
    ["an empty trailing segment", "GET", ["health", ""]],
    ["a protocol-relative first segment", "GET", ["", "evil.com", "health"]],
  ])("F3 refuses %s with 404", (_label, method, segments) => {
    expect(resolveUpstream(BASE, method, segments, "")).toEqual({
      ok: false,
      status: 404,
      error: "unknown backend route",
    });
  });

  it.each(["?x=1", "?", "x=1"])("F4 refuses a query string %j with 400", (search) => {
    expect(resolveUpstream(BASE, "GET", ["health"], search)).toEqual({
      ok: false,
      status: 400,
      error: "query not allowed",
    });
  });

  it("F3 refuses a result off the backend's origin (a base whose path turns protocol-relative)", () => {
    expect(
      resolveUpstream("https://inkprint-backend.onrender.com//evil.example", "GET", ["health"], "")
        .ok,
    ).toBe(false);
  });
});

describe("request headers", () => {
  it("P7 copies the four allowlisted headers, sets the token and the visitor's address", () => {
    const incoming = new Headers({
      "content-type": "application/json",
      accept: "text/event-stream",
      "last-event-id": "4",
      "x-request-id": "req-1",
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "198.51.100.1",
    });
    const out = upstreamRequestHeaders(incoming, "tok");
    expect(Object.fromEntries(out)).toEqual({
      "content-type": "application/json",
      accept: "text/event-stream",
      "last-event-id": "4",
      "x-request-id": "req-1",
      "x-platform-token": "tok",
      "x-forwarded-for": "203.0.113.7",
    });
  });

  it("P7 falls back to x-real-ip, else omits x-forwarded-for", () => {
    expect(
      upstreamRequestHeaders(new Headers({ "x-real-ip": "198.51.100.1" }), "t").get(
        "x-forwarded-for",
      ),
    ).toBe("198.51.100.1");
    expect(upstreamRequestHeaders(new Headers(), "t").has("x-forwarded-for")).toBe(false);
  });

  it("F5 never forwards credentials, origin, referer, host or the browser's own token", () => {
    const incoming = new Headers({
      cookie: "s=1",
      authorization: "Bearer leaked",
      origin: "https://evil.example",
      referer: "https://evil.example/x",
      host: "evil.example",
      "x-platform-token": "forged",
    });
    const out = upstreamRequestHeaders(incoming, "fresh");
    for (const name of ["cookie", "authorization", "origin", "referer", "host"]) {
      expect(out.has(name)).toBe(false);
    }
    expect(out.get("x-platform-token")).toBe("fresh");
  });
});

describe("response headers", () => {
  it("P8 copies only the six allowlisted headers", () => {
    const upstream = new Headers({
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${ID}.zip"`,
      "cache-control": "max-age=60",
      "retry-after": "30",
      "x-request-id": "r",
      "last-event-id": "9",
    });
    expect(Object.fromEntries(downstreamResponseHeaders(upstream))).toEqual(
      Object.fromEntries(upstream),
    );
  });

  it("P8 an event stream gains no-cache/no-transform and x-accel-buffering: no", () => {
    const out = downstreamResponseHeaders(
      new Headers({ "content-type": "text/event-stream; charset=utf-8" }),
    );
    expect(out.get("cache-control")).toBe("no-cache, no-transform");
    expect(out.get("x-accel-buffering")).toBe("no");
  });

  it("P8 keeps an event stream's own cache-control", () => {
    const out = downstreamResponseHeaders(
      new Headers({ "content-type": "text/event-stream", "cache-control": "no-store" }),
    );
    expect(out.get("cache-control")).toBe("no-store");
  });

  it("F6 never forwards cookies, redirects, lengths, encodings or server banners", () => {
    const upstream = new Headers({
      "set-cookie": "t=1",
      location: "https://evil.example",
      "content-length": "10",
      "content-encoding": "gzip",
      server: "uvicorn",
      "x-powered-by": "x",
    });
    expect([...downstreamResponseHeaders(upstream).keys()]).toEqual([]);
  });
});

describe("body cap", () => {
  it("is twice the text cap: room for the JSON envelope, nowhere near Vercel's limit", () => {
    expect(MAX_PROXY_BODY_BYTES).toBe(2 * MAX_TEXT_BYTES);
  });
});
