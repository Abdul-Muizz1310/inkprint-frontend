import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHealth } from "@/lib/smoke";

describe("checkHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns skipped when the url is undefined (env var unset)", async () => {
    const fetchImpl = vi.fn();
    const result = await checkHealth(undefined, fetchImpl);
    expect(result).toEqual({ kind: "skipped", reason: "health check URL env var is unset" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns ok when the response is 2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const result = await checkHealth("https://inkprint-backend.onrender.com/health", fetchImpl);
    expect(result).toEqual({ kind: "ok", status: 200 });
    expect(fetchImpl).toHaveBeenCalledWith("https://inkprint-backend.onrender.com/health");
  });

  it("returns unhealthy when the response is non-2xx (e.g. billing-suspended 503)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const result = await checkHealth("https://inkprint-backend.onrender.com/health", fetchImpl);
    expect(result).toEqual({ kind: "unhealthy", status: 503 });
  });

  it("returns unreachable when fetch rejects (network error / DNS failure)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const result = await checkHealth("https://inkprint-backend.onrender.com/health", fetchImpl);
    expect(result).toEqual({ kind: "unreachable", error: "fetch failed" });
  });
});
